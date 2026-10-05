import { readFileSync } from 'node:fs'
import { Box3, Group, type Object3D, Raycaster, Vector3 } from 'three'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { beforeAll, describe, expect, it } from 'vitest'
import { mirrorRightSide, mirrorX, sideOfPoint } from './mirror'
import { classifyRegion, computeLandmarks } from './regions'

async function load(path: string): Promise<Object3D> {
  const file = readFileSync(path)
  const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer, '')
  gltf.scene.updateMatrixWorld(true)
  return gltf.scene
}

// A body with its mirrored left side, as the viewer combines them.
function withLeftSide(scene: Object3D): { root: Group; left: Group } {
  const left = mirrorRightSide(scene)
  const root = new Group()
  root.add(scene, left)
  root.updateMatrixWorld(true)
  return { root, left }
}

const nodesNamed = (root: Object3D, name: string) => {
  const found: Object3D[] = []
  root.traverse((object) => {
    if (object.userData.name === name) found.push(object)
  })
  return found
}

let leg: { root: Group; left: Group }
let head: { root: Group; left: Group }

beforeAll(async () => {
  leg = withLeftSide(await load('public/models/lower-limb.glb'))
  head = withLeftSide(await load('public/models/head-neck.glb'))
})

describe('mirrorRightSide', () => {
  it('copies a right-side part to the left, mirrored across the midline, with the same name', () => {
    const [right, left] = nodesNamed(leg.root, 'Femur.r')
    expect([right.userData.side, left.userData.side]).toEqual(['right', 'left'])
    const r = new Box3().setFromObject(right)
    const l = new Box3().setFromObject(left)
    expect(l.min.x).toBeCloseTo(-r.max.x, 5)
    expect(l.max.y).toBeCloseTo(r.max.y, 5)
  })

  it('does not copy parts that span the midline', () => {
    expect(nodesNamed(leg.root, 'Sacrum')).toHaveLength(1)
    expect(nodesNamed(leg.root, 'Sacrum')[0].userData.side).toBeUndefined()
  })

  it('does not copy parts whose left counterpart is already in the model', () => {
    expect(nodesNamed(head.root, 'Temporal bone.r')).toHaveLength(1)
    expect(nodesNamed(head.root, 'Temporalis muscle.r')).toHaveLength(2)
  })

  it('keeps the groups that highlighting and layers look for', () => {
    expect(head.left.children.map((g) => g.userData.name)).toEqual(['Muscles', 'Bones'])
  })
})

describe('regions on the left side', () => {
  it('classifies a left calf point like the right one once mirrored', () => {
    const landmarks = computeLandmarks(leg.root.children[0])
    const hit = new Raycaster(new Vector3(0.07, 0.3, -1), new Vector3(0, 0, 1)).intersectObject(leg.left, true)[0]
    expect(sideOfPoint(hit.point)).toBe('left')
    const normal = hit.face!.normal.clone().transformDirection(hit.object.matrixWorld)
    expect(classifyRegion(mirrorX(hit.point), mirrorX(normal), landmarks)).toBe('calf')
  })
})
