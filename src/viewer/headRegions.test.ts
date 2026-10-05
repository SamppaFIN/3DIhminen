import { readFileSync } from 'node:fs'
import { type Object3D, Raycaster, Vector3 } from 'three'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { findPainSources } from '../search/painSearch'
import { computeArmLandmarks } from './armRegions'
import { classifyHeadRegion, computeHeadLandmarks, type HeadLandmarks } from './headRegions'
import { nearbyNodes, nearbyRadius } from './nearby'
import type { Region } from './regions'
import { computeTrunkLandmarks } from './trunkRegions'

let head: Object3D
let landmarks: HeadLandmarks
let trunk: { elbowY: number; neckY: number; atlasZ: number }

async function load(path: string): Promise<Object3D> {
  const file = readFileSync(path)
  const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer, '')
  gltf.scene.updateMatrixWorld(true)
  return gltf.scene
}

beforeAll(async () => {
  head = await load('public/models/head-neck.glb')
  landmarks = computeHeadLandmarks(head)
  const { elbowY } = computeArmLandmarks(await load('public/models/upper-limb.glb'))
  trunk = { elbowY, ...computeTrunkLandmarks(await load('public/models/trunk.glb')) }
})

type Vec = [number, number, number]

function hitAt(origin: Vec, direction: Vec) {
  const raycaster = new Raycaster(new Vector3(...origin), new Vector3(...direction).normalize())
  return raycaster.intersectObject(head, true)[0]
}

// Directions in the model frame: +Y up, +Z front, -X the right side.
const FROM_BEHIND: Vec = [0, 0, 1]
const FROM_FRONT: Vec = [0, 0, -1]
const FROM_RIGHT: Vec = [1, 0, 0]

describe('head and neck regions on the head and neck model', () => {
  it.each<[Region, Vec, Vec]>([
    ['face', [-0.02, 1.62, 1], FROM_FRONT],
    ['temple', [-1, 1.61, 0], FROM_RIGHT],
    ['jaw', [-1, 1.53, 0.03], FROM_RIGHT],
    ['head_back', [-0.02, 1.62, -1], FROM_BEHIND],
    ['neck_front', [-0.005, 1.47, 1], FROM_FRONT],
    ['neck_side', [-1, 1.48, 0], FROM_RIGHT],
    ['neck', [-0.02, 1.53, -1], FROM_BEHIND],
  ])('%s', (expected, origin, direction) => {
    const hit = hitAt(origin, direction)
    expect(hit, 'no hit').toBeDefined()
    expect(classifyHeadRegion(hit.point, landmarks, trunk), `hit: ${hit.object.userData.name}`).toBe(expected)
  })

  it('uses the same regions on the left side of the skull', () => {
    const hit = hitAt([1, 1.61, 0], [-1, 0, 0])
    expect(classifyHeadRegion(hit.point, landmarks, trunk), `hit: ${hit.object.userData.name}`).toBe('temple')
  })
})

// The whole pain search as the app runs it: hit, region, nearby structures, sources.
function painSourcesAt(origin: Vec, direction: Vec) {
  const hit = hitAt(origin, direction)
  const region = classifyHeadRegion(hit.point, landmarks, trunk)
  return findPainSources(nearbyNodes(head, hit.point, nearbyRadius(region)), region)
}

const localIds = (local: { id: string }[]) => local.map((m) => m.id)

describe('pain search on the head and neck model', () => {
  it('finds the masseter under jaw pain', () => {
    expect(localIds(painSourcesAt([-1, 1.53, 0.03], FROM_RIGHT).local)).toContain('masseter')
  })

  it('finds the temporalis under temple pain', () => {
    expect(localIds(painSourcesAt([-1, 1.61, 0], FROM_RIGHT).local)).toContain('temporalis')
  })

  it('finds the sternocleidomastoid under pain on the side of the neck', () => {
    expect(localIds(painSourcesAt([-1, 1.48, 0], FROM_RIGHT).local)).toContain('sternocleidomastoideus')
  })
})
