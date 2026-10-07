// The fighters: the Lihastohtori whole-body figure cut into ten rigid parts (tk3-figure.glb,
// scripts/build-tk3-figure.mjs) and swung around anatomical joints. All fighters and loose body
// parts share one instanced mesh per part, so a screen full of them costs eleven draw calls.
// Model frame: metres, +Y up, +Z front, the figure's left side at +X.

import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Color,
  DynamicDrawUsage,
  Euler,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  type Scene,
  Vector3,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

export const PARTS = ['torso', 'head', 'upperArm.l', 'foreArm.l', 'upperArm.r', 'foreArm.r', 'thigh.l', 'shin.l', 'thigh.r', 'shin.r'] as const
export type PartName = (typeof PARTS)[number]
export const P = Object.fromEntries(PARTS.map((name, i) => [name, i])) as Record<PartName, number>

// Finnish names for the kill messages.
export const PART_LABEL: Record<PartName, string> = {
  torso: 'Vartalo', head: 'Pää', 'upperArm.l': 'Olkavarsi', 'foreArm.l': 'Käsi', 'upperArm.r': 'Olkavarsi',
  'foreArm.r': 'Käsi', 'thigh.l': 'Reisi', 'shin.l': 'Sääri', 'thigh.r': 'Reisi', 'shin.r': 'Sääri',
}

const HIPS = new Vector3(0, 0.95, 0)
// Joint each part turns around, and the part it hangs from (-1 = torso root, -2 = hips root).
const JOINTS: Record<PartName, { pivot: Vector3; parent: number }> = {
  torso: { pivot: new Vector3(0, 0.95, 0), parent: -1 },
  head: { pivot: new Vector3(0, 1.42, -0.01), parent: 0 },
  'upperArm.l': { pivot: new Vector3(0.215, 1.34, -0.045), parent: 0 },
  'foreArm.l': { pivot: new Vector3(0.235, 1.085, -0.04), parent: 2 },
  'upperArm.r': { pivot: new Vector3(-0.215, 1.34, -0.045), parent: 0 },
  'foreArm.r': { pivot: new Vector3(-0.235, 1.085, -0.04), parent: 4 },
  'thigh.l': { pivot: new Vector3(0.09, 0.95, -0.01), parent: -2 },
  'shin.l': { pivot: new Vector3(0.09, 0.4, 0), parent: 6 },
  'thigh.r': { pivot: new Vector3(-0.09, 0.95, -0.01), parent: -2 },
  'shin.r': { pivot: new Vector3(-0.09, 0.4, 0), parent: 8 },
}

// Euler angles (x, y, z) per part, plus the yaw of the hips relative to the torso.
export type Pose = { angles: Float32Array; hipsYaw: number; lift: number }
export const newPose = (): Pose => ({ angles: new Float32Array(PARTS.length * 3), hipsYaw: 0, lift: 0 })

export type FigureData = {
  geometries: BufferGeometry[]
  centres: Vector3[] // Bounding-box centre of each part, model frame.
  radii: number[] // Half the smallest extent: how far the part rests above the floor.
}

// The meshopt-compressed file stores positions as normalised integers, often interleaved; the
// game wants plain floats it can transform and merge.
function dequantize(source: BufferGeometry) {
  const position = source.getAttribute('position')
  const floats = new Float32Array(position.count * 3)
  for (let i = 0; i < position.count; i++) {
    floats[i * 3] = position.getX(i)
    floats[i * 3 + 1] = position.getY(i)
    floats[i * 3 + 2] = position.getZ(i)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(floats, 3))
  if (source.index) geometry.setIndex(Array.from(source.index.array))
  return geometry
}

export async function loadFigure(url: string): Promise<FigureData> {
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const gltf = await loader.loadAsync(url)
  const geometries: BufferGeometry[] = []
  const centres: Vector3[] = []
  const radii: number[] = []
  gltf.scene.updateMatrixWorld(true)
  for (const name of PARTS) {
    const mesh = gltf.scene.getObjectByName(name.replace('.', '_'))
    if (!(mesh instanceof Mesh)) throw new Error(`tk3-figure.glb: part ${name} missing`)
    const geometry = mergeVertices(dequantize(mesh.geometry as BufferGeometry).applyMatrix4(mesh.matrixWorld))
    geometry.computeVertexNormals()
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    const size = box.getSize(new Vector3())
    geometries.push(geometry)
    centres.push(box.getCenter(new Vector3()))
    radii.push(Math.min(size.x, size.y, size.z) / 2)
  }
  return { geometries, centres, radii }
}

const tmp = {
  local: PARTS.map(() => new Matrix4()),
  world: PARTS.map(() => new Matrix4()),
  hips: new Matrix4(),
  root: new Matrix4(),
  rotation: new Matrix4(),
  euler: new Euler(),
  a: new Matrix4(),
  b: new Matrix4(),
  colour: new Color(),
}

// World matrices of every part for a fighter whose root is `base` (position, yaw, scale).
export function solvePose(base: Matrix4, pose: Pose, out: Matrix4[] = tmp.world) {
  const { local, rotation, euler, a, b, hips } = tmp
  const lift = a.makeTranslation(0, pose.lift, 0)
  hips.multiplyMatrices(base, lift)
  hips.multiply(b.makeTranslation(HIPS.x, HIPS.y, HIPS.z))
  hips.multiply(rotation.makeRotationY(pose.hipsYaw))
  hips.multiply(b.makeTranslation(-HIPS.x, -HIPS.y, -HIPS.z))
  const root = tmp.root.multiplyMatrices(base, lift)
  PARTS.forEach((name, i) => {
    const { pivot, parent } = JOINTS[name]
    euler.set(pose.angles[i * 3], pose.angles[i * 3 + 1], pose.angles[i * 3 + 2], 'YXZ')
    local[i].makeTranslation(pivot.x, pivot.y, pivot.z)
    local[i].multiply(rotation.makeRotationFromEuler(euler))
    local[i].multiply(b.makeTranslation(-pivot.x, -pivot.y, -pivot.z))
    const parentMatrix = parent === -1 ? root : parent === -2 ? hips : out[parent]
    out[i].multiplyMatrices(parentMatrix, local[i])
  })
  return out
}

// Where the muzzle sits relative to the right forearm, and the gun's own shape.
const GUN_OFFSET = new Matrix4().makeTranslation(-0.255, 0.66, 0.05)
export const MUZZLE_OFFSET = new Vector3(-0.255, 0.48, 0.05)

export class FigureRenderer {
  meshes: InstancedMesh[]
  gun: InstancedMesh
  private counts: number[]
  private gunCount = 0

  constructor(scene: Scene, data: FigureData, capacity: number) {
    const material = new MeshLambertMaterial({ color: '#ffffff' })
    this.meshes = data.geometries.map((geometry) => {
      const mesh = new InstancedMesh(geometry, material, capacity)
      mesh.instanceMatrix.setUsage(DynamicDrawUsage)
      mesh.setColorAt(0, new Color())
      mesh.castShadow = true
      mesh.frustumCulled = false
      scene.add(mesh)
      return mesh
    })
    this.gun = new InstancedMesh(new BoxGeometry(0.07, 0.36, 0.1), new MeshLambertMaterial({ color: '#2a2a2e' }), capacity)
    this.gun.instanceMatrix.setUsage(DynamicDrawUsage)
    this.gun.castShadow = true
    this.gun.frustumCulled = false
    scene.add(this.gun)
    this.counts = this.meshes.map(() => 0)
  }

  begin() {
    this.counts.fill(0)
    this.gunCount = 0
  }

  addPart(part: number, matrix: Matrix4, colour: Color) {
    const mesh = this.meshes[part]
    const i = this.counts[part]
    if (i >= mesh.instanceMatrix.count) return
    mesh.setMatrixAt(i, matrix)
    mesh.setColorAt(i, colour)
    this.counts[part]++
  }

  // A whole fighter; parts whose bit is set in `missing` are skipped (already blown off).
  addFighter(world: Matrix4[], colour: Color, missing: number, gun: boolean) {
    for (let i = 0; i < PARTS.length; i++) if (!(missing & (1 << i))) this.addPart(i, world[i], colour)
    if (gun && !(missing & (1 << P['foreArm.r'])) && this.gunCount < this.gun.instanceMatrix.count) {
      this.gun.setMatrixAt(this.gunCount++, tmp.a.multiplyMatrices(world[P['foreArm.r']], GUN_OFFSET))
    }
  }

  end() {
    this.meshes.forEach((mesh, i) => {
      mesh.count = this.counts[i]
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    })
    this.gun.count = this.gunCount
    this.gun.instanceMatrix.needsUpdate = true
  }
}

// --- Poses ---------------------------------------------------------------------------------------

const set = (pose: Pose, part: PartName, x: number, y = 0, z = 0) => {
  const i = P[part] * 3
  pose.angles[i] = x
  pose.angles[i + 1] = y
  pose.angles[i + 2] = z
}

export type Stance = 'aim' | 'run' | 'brute'

// Walk cycle with the given phase (radians) and stride (0 = standing, 1 = full run).
export function animate(pose: Pose, stance: Stance, phase: number, stride: number, recoil: number, time: number) {
  const swing = Math.sin(phase) * 0.75 * stride
  const knee = (s: number) => Math.max(0, s) * 1.1 * stride + 0.05
  set(pose, 'thigh.l', -swing)
  set(pose, 'shin.l', knee(Math.sin(phase + 1.6)))
  set(pose, 'thigh.r', swing)
  set(pose, 'shin.r', knee(Math.sin(phase + Math.PI + 1.6)))
  pose.lift = Math.abs(Math.cos(phase)) * 0.05 * stride
  const breathe = Math.sin(time * 2.2) * 0.02
  if (stance === 'aim') {
    set(pose, 'torso', 0.08 * stride + breathe + recoil * 0.15)
    set(pose, 'head', -0.05)
    set(pose, 'upperArm.r', -1.5 + recoil * 0.5, 0.12, 0.05)
    set(pose, 'foreArm.r', -0.05 - recoil * 0.3)
    set(pose, 'upperArm.l', -1.2, -0.55, -0.1)
    set(pose, 'foreArm.l', -0.55)
  } else if (stance === 'run') {
    // Arms forward, zombie-sprint style.
    set(pose, 'torso', 0.3 * stride + breathe)
    set(pose, 'head', -0.2)
    set(pose, 'upperArm.l', -1.25 + swing * 0.4, 0, -0.1)
    set(pose, 'foreArm.l', -0.4)
    set(pose, 'upperArm.r', -1.25 - swing * 0.4, 0, 0.1)
    set(pose, 'foreArm.r', -0.4)
  } else {
    // Heavy: arms swing wide, shoulders roll.
    set(pose, 'torso', 0.15 + breathe, swing * 0.25)
    set(pose, 'head', 0)
    set(pose, 'upperArm.l', swing * 0.9 - recoil * 2, 0, -0.35)
    set(pose, 'foreArm.l', -0.5 - recoil)
    set(pose, 'upperArm.r', -swing * 0.9 - recoil * 2, 0, 0.35)
    set(pose, 'foreArm.r', -0.5 - recoil)
  }
}
