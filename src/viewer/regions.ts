import { Box3, Mesh, type Object3D, Vector3 } from 'three'

// Body regions for a pain point. Model frame: metres, +Y up, +Z front (toes),
// right side, so -X is lateral and +X is medial.
// The lower limb is upright, so its parts are told apart by height bands between bony landmarks
// (this file). The arm shares heights with the trunk, so its parts come from the nearest bone
// (armRegions.ts).
export const REGION_NAMES = {
  head_back: 'Takaraivo',
  temple: 'Ohimo',
  face: 'Kasvot',
  jaw: 'Leuka ja leukanivel',
  neck_front: 'Kaulan etuosa',
  neck_side: 'Kaulan sivu',
  neck: 'Niska',
  chest: 'Rintakehä',
  upper_back: 'Yläselkä',
  abdomen: 'Vatsa',
  lower_back: 'Alaselkä',
  shoulder: 'Olkapää',
  upper_arm_front: 'Olkavarren etuosa',
  upper_arm_back: 'Olkavarren takaosa',
  upper_arm_lateral: 'Olkavarren ulkosivu',
  upper_arm_medial: 'Olkavarren sisäsivu',
  elbow_front: 'Kyynärtaive',
  elbow_back: 'Kyynärpää',
  elbow_lateral: 'Kyynärpään ulkosivu',
  elbow_medial: 'Kyynärpään sisäsivu',
  forearm_front: 'Kyynärvarren etuosa',
  forearm_back: 'Kyynärvarren takaosa',
  forearm_lateral: 'Kyynärvarren peukalon puoli',
  forearm_medial: 'Kyynärvarren pikkusormen puoli',
  wrist: 'Ranne',
  palm: 'Kämmen',
  hand_back: 'Kämmenselkä',
  thumb: 'Peukalo',
  fingers: 'Sormet',
  buttock: 'Pakara',
  hip: 'Lonkka',
  groin: 'Nivus',
  thigh_front: 'Reiden etuosa',
  thigh_back: 'Takareisi',
  thigh_lateral: 'Reiden ulkosivu',
  thigh_medial: 'Reiden sisäsivu',
  knee: 'Polvi',
  popliteal: 'Polvitaive',
  shin: 'Säären etuosa',
  calf: 'Pohje',
  leg_lateral: 'Säären ulkosivu',
  leg_medial: 'Säären sisäsivu',
  achilles: 'Akillesjänne',
  ankle: 'Nilkka',
  heel: 'Kantapää',
  sole: 'Jalkapohja',
  dorsum: 'Jalkapöytä',
  toes: 'Varpaat',
  foot_lateral: 'Jalkaterän ulkosyrjä',
  foot_medial: 'Jalkaterän sisäsyrjä',
} as const

export type Region = keyof typeof REGION_NAMES

export type Landmarks = {
  iliacCrestY: number // top of the hip bone: above it is the trunk
  hipFoldY: number // bottom of the hip bone (ischial tuberosity): between it and the crest is the hip
  kneeY: number // top of the tibia
  ankleY: number // top of the talus
  heelTopY: number // top of the calcaneus
  heelBackZ: number // back of the calcaneus
  // Front ends of the first and fifth metatarsals: toes are in front of the line between them.
  toeLine: [{ x: number; z: number }, { x: number; z: number }]
  // Centre of the muscles' horizontal extent in each LEG_SLICE-high slice, keyed by slice index.
  legCentres: Record<number, { x: number; z: number }>
  // Same for the bones: deep muscles lie around the bones, not around the muscles' centre.
  boneCentres: Record<number, { x: number; z: number }>
  // Mid-height of the first metatarsal: foot muscles below it face down, above it up.
  footMidY: number
}

const LEG_SLICE = 0.02

// Band widths in metres around the landmarks.
const KNEE_BELOW = 0.05
const KNEE_ABOVE = 0.06
const LOWER_LEG = 0.08 // above the ankle: Achilles tendon at the back, ankle elsewhere
const ANKLE_JOINT = 0.03
const HEEL_DEPTH = 0.035

export function findNode(root: Object3D, nodeName: string): Object3D {
  let found: Object3D | undefined
  root.traverse((object) => {
    if (object.userData.name === nodeName) found = object
  })
  if (!found) throw new Error(`Landmark node not found: ${nodeName}`)
  return found
}

export function bounds(root: Object3D, nodeName: string): Box3 {
  return new Box3().setFromObject(findNode(root, nodeName))
}

export function sliceCentres(...groups: Object3D[]): Landmarks['legCentres'] {
  const extents = new Map<number, { minX: number; maxX: number; minZ: number; maxZ: number }>()
  const vertex = new Vector3()
  const visit = (object: Object3D) => {
    if (!(object instanceof Mesh)) return
    const position = object.geometry.getAttribute('position')
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld)
      const slice = Math.floor(vertex.y / LEG_SLICE)
      const e = extents.get(slice) ?? { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
      e.minX = Math.min(e.minX, vertex.x)
      e.maxX = Math.max(e.maxX, vertex.x)
      e.minZ = Math.min(e.minZ, vertex.z)
      e.maxZ = Math.max(e.maxZ, vertex.z)
      extents.set(slice, e)
    }
  }
  for (const group of groups) group.traverse(visit)
  const centres: Landmarks['legCentres'] = {}
  for (const [slice, e] of extents) centres[slice] = { x: (e.minX + e.maxX) / 2, z: (e.minZ + e.maxZ) / 2 }
  return centres
}

export function legCentreAt(y: number, centres: Landmarks['legCentres']): { x: number; z: number } {
  const slices = Object.keys(centres).map(Number)
  const target = Math.floor(y / LEG_SLICE)
  const nearest = slices.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a))
  return centres[nearest]
}

export function computeLandmarks(root: Object3D): Landmarks {
  const hipBone = bounds(root, 'Hip bone.r')
  const tibia = bounds(root, 'Tibia.r')
  const talus = bounds(root, 'Talus.r')
  const calcaneus = bounds(root, 'Calcaneus.r')
  const first = bounds(root, 'First metatarsal bone.r')
  const fifth = bounds(root, 'Fifth metatarsal bone.r')
  return {
    iliacCrestY: hipBone.max.y,
    hipFoldY: hipBone.min.y,
    kneeY: tibia.max.y,
    ankleY: talus.max.y,
    heelTopY: calcaneus.max.y,
    heelBackZ: calcaneus.min.z,
    toeLine: [
      { x: (first.min.x + first.max.x) / 2, z: first.max.z },
      { x: (fifth.min.x + fifth.max.x) / 2, z: fifth.max.z },
    ],
    legCentres: sliceCentres(findNode(root, 'Muscles')),
    boneCentres: sliceCentres(findNode(root, 'Bones')),
    footMidY: (first.min.y + first.max.y) / 2,
  }
}

export type Side = 'front' | 'back' | 'lateral' | 'medial'

const LEG_REGION_BY_SIDE: Record<Side, Region> = {
  front: 'shin',
  back: 'calf',
  lateral: 'leg_lateral',
  medial: 'leg_medial',
}

const THIGH_REGION_BY_SIDE: Record<Side, Region> = {
  front: 'thigh_front',
  back: 'thigh_back',
  lateral: 'thigh_lateral',
  medial: 'thigh_medial',
}

// At hip level the groin covers the front and the inner side.
const HIP_REGION_BY_SIDE: Record<Side, Region> = {
  front: 'groin',
  back: 'buttock',
  lateral: 'hip',
  medial: 'groin',
}

// Side of a horizontal direction: front/back if it points more along Z than X.
export function sideOf(dx: number, dz: number): Side {
  if (Math.abs(dz) >= Math.abs(dx)) return dz >= 0 ? 'front' : 'back'
  return dx < 0 ? 'lateral' : 'medial'
}

// On the leg, the side is taken from where the point lies relative to the leg's centre line:
// surface normals of rounded muscles often point sideways at the borders between them.
function legSide(point: Vector3, lm: Landmarks): Side {
  const centre = legCentreAt(point.y, lm.legCentres)
  return sideOf(point.x - centre.x, point.z - centre.z)
}

function toeLineZ(x: number, [a, b]: Landmarks['toeLine']): number {
  return a.z + ((x - a.x) / (b.x - a.x)) * (b.z - a.z)
}

export function classifyRegion(point: Vector3, normal: Vector3, lm: Landmarks): Region {
  if (point.y > lm.iliacCrestY) return legSide(point, lm) === 'back' ? 'lower_back' : 'abdomen'
  if (point.y > lm.hipFoldY) return HIP_REGION_BY_SIDE[legSide(point, lm)]
  if (point.y > lm.kneeY + KNEE_ABOVE) return THIGH_REGION_BY_SIDE[legSide(point, lm)]
  if (point.y > lm.ankleY + ANKLE_JOINT) {
    const side = legSide(point, lm)
    if (point.y > lm.kneeY - KNEE_BELOW) return side === 'back' ? 'popliteal' : 'knee'
    if (point.y > lm.ankleY + LOWER_LEG) return LEG_REGION_BY_SIDE[side]
    return side === 'back' ? 'achilles' : 'ankle'
  }

  // Foot and ankle joint level: the foot's surfaces face clearly up, down or sideways.
  const side = sideOf(normal.x, normal.z)
  if (side === 'back' && point.y > lm.heelTopY) return 'achilles'
  if (point.z < lm.heelBackZ + HEEL_DEPTH) return 'heel'
  if (point.z > toeLineZ(point.x, lm.toeLine)) return 'toes'
  if (normal.y < -0.5) return 'sole'
  if (normal.y > 0.3) return 'dorsum'
  if (point.y > lm.heelTopY && (side === 'lateral' || side === 'medial')) return 'ankle'
  if (side === 'lateral') return 'foot_lateral'
  if (side === 'medial') return 'foot_medial'
  return 'dorsum'
}
