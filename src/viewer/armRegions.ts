import { Box3, Mesh, type Object3D, Vector3 } from 'three'
import { findNode, legCentreAt, type Region, type Side, sideOf, sliceCentres } from './regions'

// Regions of the arm and of the trunk muscles that come with the upper-limb model.
// Model frame as in regions.ts; the arm hangs at the side with the palm forward.
// The part of the arm comes from the nearest bone; within a part, the side from where the point
// lies relative to the arm bones' centre line (front = palm side).

type BoneShape = { name: string; box: Box3; vertices: Float32Array }

export type ArmLandmarks = {
  shoulderY: number // top of the humerus
  elbowY: number // bottom of the humerus; also splits the trunk into upper and lower
  wristY: number // bottom of the radius
  lateralX: number // lateral edge of the clavicle: beyond it the girdle bones count as shoulder
  boneCentres: Record<number, { x: number; z: number }> // humerus, radius and ulna
  bones: BoneShape[]
}

// Band widths in metres around the landmarks.
const SHOULDER_BAND = 0.07
const ELBOW_ABOVE = 0.05
const ELBOW_BELOW = 0.04
const WRIST_BAND = 0.03
// Farther than this from every arm bone, a point lies on the trunk (e.g. pectoralis major).
const TRUNK_DISTANCE = 0.06

const CARPALS = new Set(['Scaphoid.r', 'Lunate bone.r', 'Triquetrum.r', 'Pisiform.r', 'Trapezium.r', 'Trapezoid.r', 'Capitate.r', 'Hamate.r'])

const UPPER_ARM: Record<Side, Region> = {
  front: 'upper_arm_front',
  back: 'upper_arm_back',
  lateral: 'upper_arm_lateral',
  medial: 'upper_arm_medial',
}
const ELBOW: Record<Side, Region> = {
  front: 'elbow_front',
  back: 'elbow_back',
  lateral: 'elbow_lateral',
  medial: 'elbow_medial',
}
const FOREARM: Record<Side, Region> = {
  front: 'forearm_front',
  back: 'forearm_back',
  lateral: 'forearm_lateral',
  medial: 'forearm_medial',
}

function boneShape(object: Object3D): BoneShape {
  const vertices: number[] = []
  const vertex = new Vector3()
  object.traverse((child) => {
    if (!(child instanceof Mesh)) return
    const position = child.geometry.getAttribute('position')
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld)
      vertices.push(vertex.x, vertex.y, vertex.z)
    }
  })
  return { name: object.userData.name, box: new Box3().setFromObject(object), vertices: Float32Array.from(vertices) }
}

// root: the upper-limb model.
export function computeArmLandmarks(root: Object3D): ArmLandmarks {
  const humerus = findNode(root, 'Humerus.r')
  const radius = findNode(root, 'Radius.r')
  const ulna = findNode(root, 'Ulna.r')
  const humerusBox = new Box3().setFromObject(humerus)
  return {
    shoulderY: humerusBox.max.y,
    elbowY: humerusBox.min.y,
    wristY: new Box3().setFromObject(radius).min.y,
    lateralX: new Box3().setFromObject(findNode(root, 'Clavicle.r')).min.x,
    boneCentres: sliceCentres(humerus, radius, ulna),
    bones: findNode(root, 'Bones').children.map(boneShape),
  }
}

export function nearestBone(point: Vector3, bones: BoneShape[]): { name: string; distance: number } {
  let best = { name: '', distance: Infinity }
  for (const bone of bones) {
    if (bone.box.distanceToPoint(point) >= best.distance) continue
    const v = bone.vertices
    for (let i = 0; i < v.length; i += 3) {
      const d = Math.hypot(v[i] - point.x, v[i + 1] - point.y, v[i + 2] - point.z)
      if (d < best.distance) best = { name: bone.name, distance: d }
    }
  }
  return best
}

function armSide(point: Vector3, lm: ArmLandmarks): Side {
  const centre = legCentreAt(point.y, lm.boneCentres)
  return sideOf(point.x - centre.x, point.z - centre.z)
}

// The trunk's front and back meet near the spine's front edge; above the elbow is the upper trunk,
// above neckY (the top of T1, from the trunk model) the neck. Also used for the trunk model.
export function trunkRegion(point: Vector3, elbowY: number, neckY: number): Region {
  if (point.y > neckY) return 'neck'
  const front = point.z >= 0
  if (point.y > elbowY) return front ? 'chest' : 'upper_back'
  return front ? 'abdomen' : 'lower_back'
}

export function classifyArmRegion(point: Vector3, normal: Vector3, lm: ArmLandmarks, neckY = Infinity): Region {
  const { name, distance } = nearestBone(point, lm.bones)
  if (distance > TRUNK_DISTANCE) return trunkRegion(point, lm.elbowY, neckY)

  if (name === 'Clavicle.r' || name === 'Scapula.r.') {
    return point.x < lm.lateralX + 0.02 ? 'shoulder' : trunkRegion(point, lm.elbowY, neckY)
  }
  if (name === 'Humerus.r') {
    if (point.y > lm.shoulderY - SHOULDER_BAND) return 'shoulder'
    if (point.y < lm.elbowY + ELBOW_ABOVE) return ELBOW[armSide(point, lm)]
    return UPPER_ARM[armSide(point, lm)]
  }
  if (name === 'Radius.r' || name === 'Ulna.r') {
    if (point.y > lm.elbowY - ELBOW_BELOW) return ELBOW[armSide(point, lm)]
    if (point.y < lm.wristY + WRIST_BAND) return 'wrist'
    return FOREARM[armSide(point, lm)]
  }

  // Hand bones: the palm faces forward (+Z) in the model's pose.
  if (CARPALS.has(name)) return 'wrist'
  if (name.includes('1st') || name.startsWith('Sesamoid')) return 'thumb'
  if (name.includes('phalanx')) return 'fingers'
  return normal.z >= 0 ? 'palm' : 'hand_back'
}
