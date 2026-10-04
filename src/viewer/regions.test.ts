import { readFileSync } from 'node:fs'
import { type Object3D, Raycaster, Vector3 } from 'three'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { findPainSources } from '../search/painSearch'
import { NEARBY_RADIUS, nearbyNodes } from './nearby'
import { classifyRegion, computeLandmarks, type Landmarks, type Region } from './regions'

let model: Object3D
let landmarks: Landmarks

beforeAll(async () => {
  const file = readFileSync('public/models/lower-limb.glb')
  const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer, '')
  model = gltf.scene
  model.updateMatrixWorld(true)
  landmarks = computeLandmarks(model)
})

type Vec = [number, number, number]

// Casts a ray at the real model and classifies the first surface it hits.
function regionAt(origin: Vec, direction: Vec): { region?: Region; hit?: string } {
  const raycaster = new Raycaster(new Vector3(...origin), new Vector3(...direction).normalize())
  const hit = raycaster.intersectObject(model, true)[0]
  if (!hit?.face) return {}
  const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
  return { region: classifyRegion(hit.point, normal, landmarks), hit: hit.object.userData.name }
}

// Directions in the model frame: +Y up, +Z front, -X lateral (right leg).
const FROM_BELOW: Vec = [0, 1, 0]
const FROM_ABOVE: Vec = [0, -1, 0]
const FROM_BEHIND: Vec = [0, 0, 1]
const FROM_FRONT: Vec = [0, 0, -1]
const FROM_LATERAL: Vec = [1, 0, 0]
const FROM_MEDIAL: Vec = [-1, 0, 0]

describe('classifyRegion on the lower leg model', () => {
  it.each<[Region, Vec, Vec]>([
    ['sole', [-0.09, -1, 0], FROM_BELOW],
    ['heel', [-0.077, 0.035, -1], FROM_BEHIND],
    ['achilles', [-0.078, 0.14, -1], FROM_BEHIND],
    ['calf', [-0.07, 0.3, -1], FROM_BEHIND],
    ['shin', [-0.075, 0.3, 1], FROM_FRONT],
    ['leg_lateral', [-1, 0.28, -0.03], FROM_LATERAL],
    ['leg_medial', [1, 0.28, -0.03], FROM_MEDIAL],
    ['popliteal', [-0.075, 0.43, -1], FROM_BEHIND],
    ['knee', [-0.085, 0.445, 1], FROM_FRONT],
    // Rays from above start just over the foot: higher up they would hit the pelvis first.
    ['dorsum', [-0.085, 0.15, 0.04], FROM_ABOVE],
    ['toes', [-0.08, 0.15, 0.115], FROM_ABOVE],
    ['toes', [-0.08, -1, 0.115], FROM_BELOW],
    ['ankle', [-1, 0.07, -0.04], FROM_LATERAL],
    ['foot_lateral', [-1, 0.025, 0.03], FROM_LATERAL],
    ['thigh_front', [-0.085, 0.56, 1], FROM_FRONT],
    ['thigh_back', [-0.09, 0.62, -1], FROM_BEHIND],
    ['thigh_lateral', [-1, 0.62, -0.02], FROM_LATERAL],
    ['thigh_medial', [1, 0.62, -0.02], FROM_MEDIAL],
    ['buttock', [-0.08, 0.88, -1], FROM_BEHIND],
    ['hip', [-1, 0.86, 0], FROM_LATERAL],
    ['groin', [-0.07, 0.83, 1], FROM_FRONT],
    ['abdomen', [-0.03, 1.08, 1], FROM_FRONT],
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
  const region = classifyRegion(hit.point, normal, landmarks)
  return findPainSources(nearbyNodes(model, hit.point, NEARBY_RADIUS), region)
}

const muscleIds = (sources: { muscle: { id: string } }[]) => sources.map((s) => s.muscle.id)

describe('pain search on the lower leg model', () => {
  it('traces sole pain to the calf muscles through the plantar fascia and Achilles tendon', () => {
    const { local, distant } = painSourcesAt([-0.09, -1, 0], FROM_BELOW)
    expect(local.length).toBeGreaterThan(0)
    expect(muscleIds(distant)).toEqual(expect.arrayContaining(['gastrocnemius', 'soleus']))
  })

  it('traces pain at the front of the knee to the quadriceps', () => {
    const { distant } = painSourcesAt([-0.085, 0.445, 1], FROM_FRONT)
    expect(muscleIds(distant)).toEqual(expect.arrayContaining(['rectus_femoris', 'vastus_medialis']))
  })

  it('does not trace calf or knee-pit pain to the foot muscles', () => {
    for (const origin of [[-0.07, 0.3, -1], [-0.075, 0.43, -1]] as Vec[]) {
      const { distant } = painSourcesAt(origin, FROM_BEHIND)
      expect(muscleIds(distant)).not.toEqual(expect.arrayContaining(['flexor_digitorum_brevis']))
      expect(muscleIds(distant)).not.toEqual(expect.arrayContaining(['abductor_hallucis']))
    }
  })
})
