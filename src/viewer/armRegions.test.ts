import { readFileSync } from 'node:fs'
import { type Object3D, Raycaster, Vector3 } from 'three'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { findPainSources } from '../search/painSearch'
import { type ArmLandmarks, classifyArmRegion, computeArmLandmarks } from './armRegions'
import { nearbyNodes, nearbyRadius } from './nearby'
import type { Region } from './regions'

let model: Object3D
let landmarks: ArmLandmarks

beforeAll(async () => {
  const file = readFileSync('public/models/upper-limb.glb')
  const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer, '')
  model = gltf.scene
  model.updateMatrixWorld(true)
  landmarks = computeArmLandmarks(model)
})

type Vec = [number, number, number]

function regionAt(origin: Vec, direction: Vec): { region?: Region; hit?: string } {
  const raycaster = new Raycaster(new Vector3(...origin), new Vector3(...direction).normalize())
  const hit = raycaster.intersectObject(model, true)[0]
  if (!hit?.face) return {}
  const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
  return { region: classifyArmRegion(hit.point, normal, landmarks), hit: hit.object.userData.name }
}

// Directions in the model frame: +Y up, +Z front (palm side), -X lateral (right arm).
const FROM_BEHIND: Vec = [0, 0, 1]
const FROM_FRONT: Vec = [0, 0, -1]
const FROM_LATERAL: Vec = [1, 0, 0]

describe('classifyArmRegion on the upper limb model', () => {
  it.each<[Region, Vec, Vec]>([
    ['shoulder', [-1, 1.38, -0.03], FROM_LATERAL],
    ['upper_arm_front', [-0.2, 1.25, 1], FROM_FRONT],
    ['upper_arm_back', [-0.2, 1.25, -1], FROM_BEHIND],
    ['upper_arm_lateral', [-1, 1.22, -0.03], FROM_LATERAL],
    ['elbow_back', [-0.23, 1.1, -1], FROM_BEHIND],
    ['elbow_lateral', [-1, 1.09, -0.02], FROM_LATERAL],
    ['elbow_front', [-0.235, 1.09, 1], FROM_FRONT],
    ['forearm_front', [-0.25, 0.98, 1], FROM_FRONT],
    ['forearm_back', [-0.245, 0.98, -1], FROM_BEHIND],
    ['wrist', [-0.265, 0.865, 1], FROM_FRONT],
    ['palm', [-0.272, 0.8, 1], FROM_FRONT],
    ['hand_back', [-0.272, 0.8, -1], FROM_BEHIND],
    ['fingers', [-0.286, 0.72, 1], FROM_FRONT],
    ['thumb', [-0.33, 0.78, 1], FROM_FRONT],
    ['chest', [-0.08, 1.28, 1], FROM_FRONT],
    ['upper_back', [-0.08, 1.3, -1], FROM_BEHIND],
    ['lower_back', [-0.08, 1.05, -1], FROM_BEHIND],
  ])('%s', (expected, origin, direction) => {
    const { region, hit } = regionAt(origin, direction)
    expect(region, `hit: ${hit}`).toBe(expected)
  })
})

// The whole pain search as the app runs it: hit, region, nearby structures, sources.
function painSourcesAt(origin: Vec, direction: Vec) {
  const raycaster = new Raycaster(new Vector3(...origin), new Vector3(...direction).normalize())
  const hit = raycaster.intersectObject(model, true)[0]
  const normal = hit.face!.normal.clone().transformDirection(hit.object.matrixWorld)
  const region = classifyArmRegion(hit.point, normal, landmarks)
  return findPainSources(nearbyNodes(model, hit.point, nearbyRadius(region)), region)
}

const muscleIds = (sources: { muscle: { id: string } }[]) => sources.map((s) => s.muscle.id)
const localIds = (local: { id: string }[]) => local.map((m) => m.id)

describe('pain search on the upper limb model', () => {
  it('traces palm pain to the palmaris longus through the palmar aponeurosis', () => {
    const { distant } = painSourcesAt([-0.272, 0.8, 1], FROM_FRONT)
    expect(muscleIds(distant)).toContain('palmaris_longus')
  })

  // At the level of the carpal bones, over the flexor retinaculum.
  it('traces palm-side wrist pain to the thenar muscles through the flexor retinaculum', () => {
    const { local, distant } = painSourcesAt([-0.26, 0.85, 1], FROM_FRONT)
    expect(localIds(local)).toContain('palmaris_longus')
    expect(muscleIds(distant)).toContain('opponens_pollicis')
  })

  it('does not count the extensor tendons behind the wrist as local to palm-side pain', () => {
    const { local } = painSourcesAt([-0.265, 0.865, 1], FROM_FRONT)
    expect(localIds(local)).not.toEqual(expect.arrayContaining(['extensor_digitorum']))
    expect(localIds(local)).not.toEqual(expect.arrayContaining(['extensor_carpi_radialis_longus']))
  })
})
