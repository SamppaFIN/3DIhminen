import { readFileSync } from 'node:fs'
import { type Object3D, Raycaster, Vector3 } from 'three'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { findPainSources } from '../search/painSearch'
import { computeArmLandmarks, trunkRegion } from './armRegions'
import { nearbyNodes, nearbyRadius } from './nearby'
import type { Region } from './regions'
import { computeTrunkLandmarks, type TrunkLandmarks } from './trunkRegions'

let trunk: Object3D
let elbowY: number
let landmarks: TrunkLandmarks

async function load(path: string): Promise<Object3D> {
  const file = readFileSync(path)
  const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer, '')
  gltf.scene.updateMatrixWorld(true)
  return gltf.scene
}

beforeAll(async () => {
  trunk = await load('public/models/trunk.glb')
  elbowY = computeArmLandmarks(await load('public/models/upper-limb.glb')).elbowY
  landmarks = computeTrunkLandmarks(trunk)
})

type Vec = [number, number, number]

function regionAt(origin: Vec, direction: Vec): { region?: Region; hit?: string } {
  const raycaster = new Raycaster(new Vector3(...origin), new Vector3(...direction).normalize())
  const hit = raycaster.intersectObject(trunk, true)[0]
  if (!hit) return {}
  return { region: trunkRegion(hit.point, elbowY, landmarks.neckY), hit: hit.object.userData.name }
}

// Directions in the model frame: +Y up, +Z front, -X the right side.
const FROM_BEHIND: Vec = [0, 0, 1]
const FROM_FRONT: Vec = [0, 0, -1]

describe('trunk regions on the trunk model', () => {
  it.each<[Region, Vec, Vec]>([
    ['neck', [-0.03, 1.5, -1], FROM_BEHIND],
    ['chest', [-0.06, 1.2, 1], FROM_FRONT],
    ['upper_back', [-0.04, 1.3, -1], FROM_BEHIND],
    ['abdomen', [-0.04, 0.95, 1], FROM_FRONT],
    ['lower_back', [-0.04, 1.0, -1], FROM_BEHIND],
  ])('%s', (expected, origin, direction) => {
    const { region, hit } = regionAt(origin, direction)
    expect({ region, hit }).toEqual({ region: expected, hit: expect.any(String) })
  })

  it('finds the neck above the first thoracic vertebra', () => {
    expect(landmarks.neckY).toBeGreaterThan(elbowY)
  })
})

// The whole pain search as the app runs it: hit, region, nearby structures, sources.
function painSourcesAt(origin: Vec, direction: Vec) {
  const raycaster = new Raycaster(new Vector3(...origin), new Vector3(...direction).normalize())
  const hit = raycaster.intersectObject(trunk, true)[0]
  const region = trunkRegion(hit.point, elbowY, landmarks.neckY)
  return findPainSources(nearbyNodes(trunk, hit.point, nearbyRadius(region)), region)
}

const muscleIds = (sources: { muscle: { id: string } }[]) => sources.map((s) => s.muscle.id)
const localIds = (local: { id: string }[]) => local.map((m) => m.id)

describe('pain search on the trunk model', () => {
  it('traces lower back pain over the thoracolumbar fascia to the abdominal muscles that arise from it', () => {
    const { distant } = painSourcesAt([-0.04, 1.0, -1], FROM_BEHIND)
    expect(muscleIds(distant)).toEqual(expect.arrayContaining(['transversus_abdominis', 'obliquus_internus_abdominis']))
  })

  // The flat muscles' meshes include their aponeuroses, which cover the rectus abdominis.
  it('finds the abdominal wall under abdominal pain and the pyramidalis through the linea alba', () => {
    const { local, distant } = painSourcesAt([-0.01, 0.95, 1], FROM_FRONT)
    expect(localIds(local)).toEqual(expect.arrayContaining(['rectus_abdominis', 'obliquus_externus_abdominis']))
    expect(muscleIds(distant)).toContain('pyramidalis')
  })

  it('finds the splenius capitis under neck pain', () => {
    const { local } = painSourcesAt([-0.03, 1.5, -1], FROM_BEHIND)
    expect(localIds(local)).toContain('splenius_capitis')
  })
})
