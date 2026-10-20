import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Box3, Group, Matrix4, Mesh, MeshStandardMaterial, type Object3D, Vector3 } from 'three'

// The skeleton dance: the bones of the anatomy models, cut into rigid segments that swing around
// their joints, as in a 1929 cartoon. Bones are rigid anyway, so the gaps at the joints look right.
// Every bone is a clone that shares its geometry with the anatomy models; the right side (at -X)
// is mirrored to the left, as in mirror.ts.

const MODELS = `${import.meta.env.BASE_URL}models`
const URLS = ['lower-limb', 'upper-limb', 'trunk', 'head-neck'].map((name) => `${MODELS}/${name}.glb`)

const BONE = '#efe6d2'
const FADE_SECONDS = 0.4
// Beats per second.
const TEMPO = 2.2
// Seconds for the moves to grow from standing still to full swing.
const WARM_UP = 0.6
const MIDLINE_TOLERANCE = 0.005

type Limb = 'thigh' | 'shin' | 'foot' | 'upperArm' | 'forearm' | 'hand'
type Segment = 'pelvis' | 'torso' | 'head' | 'jaw' | Limb

// The segment a bone moves with; null for bones that follow the model's default.
function segmentOf(name: string): Segment | null {
  if (/^(Mandible|Lower .*(incisor|canine|premolar|molar))/.test(name)) return 'jaw'
  if (/^(Atlas|Axis|Cervical)/.test(name)) return 'head'
  if (/^(Femur|Patella)/.test(name)) return 'thigh'
  if (/^(Tibia|Fibula)/.test(name)) return 'shin'
  if (/of foot|^(Calcaneus|Cuboid|Navicular|Talus)|cuneiform|metatarsal/.test(name)) return 'foot'
  if (/^Humerus/.test(name)) return 'upperArm'
  if (/^(Radius|Ulna)/.test(name)) return 'forearm'
  if (/metacarpal|finger|of hand|^(Capitate|Hamate|Lunate|Pisiform|Scaphoid|Trapezium|Trapezoid|Triquetrum)/.test(name)) return 'hand'
  if (/^(Hip bone|Sacrum|Coccyx|Lumbar)/.test(name)) return 'pelvis'
  return null
}
const DEFAULT_SEGMENT: Segment[] = ['pelvis', 'torso', 'torso', 'head']

const leftName = (name: string) => name.replace(/\.r(\.?)$/, '.l$1')
const MIRROR = new Matrix4().makeScale(-1, 1, 1)

type Rig = {
  root: Group
  material: MeshStandardMaterial
  pelvis: Group
  torso: Group
  head: Group
  jaw: Group
  limbs: Record<'right' | 'left', Record<Limb, Group>>
}

function buildRig(scenes: Object3D[]): Rig {
  const material = new MeshStandardMaterial({ color: BONE, roughness: 0.55, transparent: true })
  // Each bone with its world matrix, and a mirrored copy of each bone on the right only.
  const bones: { name: string; segment: Segment; side: 'right' | 'left'; matrix: Matrix4; object: Object3D }[] = []
  const boxes = new Map<string, Box3>()
  scenes.forEach((scene, index) => {
    scene.updateMatrixWorld(true)
    const group = scene.children.find((child) => child.userData.name === 'Bones')
    if (!group) return
    const names = new Set(group.children.map((part) => part.userData.name as string))
    for (const part of group.children) {
      const name: string = part.userData.name ?? ''
      const segment = segmentOf(name) ?? DEFAULT_SEGMENT[index]
      const box = new Box3().setFromObject(part)
      boxes.set(name, box)
      bones.push({ name, segment, side: box.getCenter(new Vector3()).x > 0 ? 'left' : 'right', matrix: part.matrixWorld.clone(), object: part })
      const hasLeft = leftName(name) !== name && names.has(leftName(name))
      if (!hasLeft && box.max.x <= MIDLINE_TOLERANCE) {
        bones.push({ name, segment, side: 'left', matrix: MIRROR.clone().multiply(part.matrixWorld), object: part })
      }
    }
  })

  // Joints from the bones' extents, on the right side; the left mirrors them.
  const box = (name: string) => boxes.get(name) ?? new Box3(new Vector3(), new Vector3())
  const centre = (name: string) => box(name).getCenter(new Vector3())
  const top = (name: string, down = 0) => centre(name).setY(box(name).max.y - down)
  const bottom = (name: string, up = 0) => centre(name).setY(box(name).min.y + up)
  const femur = box('Femur.r')
  const mandible = box('Mandible')
  const joints: Record<Segment, Vector3> = {
    pelvis: centre('Sacrum'),
    torso: centre('Thoracic vertebra (T12)'),
    head: centre('Cervical vertebrae (C7)'),
    jaw: new Vector3(0, mandible.max.y - 0.01, mandible.min.z + 0.01),
    thigh: new Vector3(femur.max.x - 0.025, femur.max.y - 0.025, (femur.min.z + femur.max.z) / 2),
    shin: top('Tibia.r'),
    foot: centre('Talus.r'),
    upperArm: top('Humerus.r', 0.025),
    forearm: bottom('Humerus.r', 0.02),
    hand: bottom('Radius.r'),
  }
  const parents: Record<Segment, Segment | null> = {
    pelvis: null,
    torso: 'pelvis',
    head: 'torso',
    jaw: 'head',
    thigh: 'pelvis',
    shin: 'thigh',
    foot: 'shin',
    upperArm: 'torso',
    forearm: 'upperArm',
    hand: 'forearm',
  }
  const LIMBS = new Set<Segment>(['thigh', 'shin', 'foot', 'upperArm', 'forearm', 'hand'])
  const at = (segment: Segment, side: 'right' | 'left') => {
    const joint = joints[segment].clone()
    if (LIMBS.has(segment) && side === 'left') joint.x = -joint.x
    return joint
  }

  const root = new Group()
  const groups = new Map<string, Group>()
  const keyOf = (segment: Segment, side: 'right' | 'left') => (LIMBS.has(segment) ? `${segment}|${side}` : segment)
  const groupOf = (segment: Segment, side: 'right' | 'left'): Group => {
    const key = keyOf(segment, side)
    const existing = groups.get(key)
    if (existing) return existing
    const group = new Group()
    const parent = parents[segment]
    const joint = at(segment, side)
    group.position.copy(parent ? joint.clone().sub(at(parent, side)) : joint)
    ;(parent ? groupOf(parent, side) : root).add(group)
    groups.set(key, group)
    return group
  }

  for (const { segment, side, matrix, object } of bones) {
    const copy = object.clone()
    copy.traverse((node) => {
      if (node instanceof Mesh) node.material = material
    })
    // The bone keeps its place in the body: its world matrix, relative to its joint.
    const joint = at(segment, side)
    copy.matrixAutoUpdate = true
    matrix.decompose(copy.position, copy.quaternion, copy.scale)
    copy.position.sub(joint)
    groupOf(segment, side).add(copy)
  }

  const limbs = (side: 'right' | 'left') =>
    Object.fromEntries([...LIMBS].map((limb) => [limb, groupOf(limb, side)])) as Record<Limb, Group>
  return {
    root,
    material,
    pelvis: groupOf('pelvis', 'right'),
    torso: groupOf('torso', 'right'),
    head: groupOf('head', 'right'),
    jaw: groupOf('jaw', 'right'),
    limbs: { right: limbs('right'), left: limbs('left') },
  }
}

const lift = (x: number) => Math.max(0, x)

// One frame of the dance at beat phase `p` (radians) and swing `a` (0 to 1).
function pose(rig: Rig, rest: Vector3, p: number, a: number): void {
  rig.pelvis.position.copy(rest)
  rig.pelvis.position.y += 0.035 * a * Math.abs(Math.sin(p))
  rig.pelvis.rotation.set(0, 0.25 * a * Math.sin(p / 2), 0.06 * a * Math.sin(p))
  rig.torso.rotation.set(0.05 * a * Math.sin(2 * p), -0.15 * a * Math.sin(p / 2), -0.1 * a * Math.sin(p))
  rig.head.rotation.set(0.2 * a * Math.sin(2 * p), 0.3 * a * Math.sin(p / 2), 0.15 * a * Math.sin(p + 1))
  // The jaw chatters.
  rig.jaw.rotation.x = a * (0.12 + 0.12 * Math.sin(4 * p))

  for (const side of ['right', 'left'] as const) {
    const s = side === 'right' ? 1 : -1
    // Each leg kicks on its own beat; the left side mirrors the right's sideways angles.
    const kick = lift(Math.sin(p + (side === 'left' ? Math.PI : 0)))
    const { thigh, shin, foot, upperArm, forearm, hand } = rig.limbs[side]
    thigh.rotation.set(-0.9 * a * kick, 0, -s * 0.08 * a * kick)
    shin.rotation.set(1.3 * a * kick, 0, 0)
    foot.rotation.set(-0.3 * a * kick, 0, 0)
    // Arms up and out, waving in turn.
    const wave = Math.sin(p + (side === 'left' ? 0 : Math.PI))
    upperArm.rotation.set(-0.3 * a, 0, -s * a * (1.6 + 0.35 * wave))
    forearm.rotation.set(-a * (0.9 + 0.5 * wave), 0, 0)
    hand.rotation.set(0, 0, -s * 0.4 * a * Math.sin(2 * p))
  }
}

function setOpacity(material: MeshStandardMaterial, opacity: number): void {
  material.opacity = opacity
  material.depthWrite = opacity > 0.99
}

type Props = { dancing: boolean }

export function Skeleton({ dancing }: Props) {
  const [lower, upper, trunk, head] = useGLTF(URLS)
  const rig = useMemo(() => buildRig([lower.scene, upper.scene, trunk.scene, head.scene]), [lower, upper, trunk, head])
  const pelvisRest = useMemo(() => rig.pelvis.position.clone(), [rig])
  const fade = useRef(0)
  const time = useRef(0)
  const group = useRef<Group>(null)

  useFrame((_, delta) => {
    const step = delta / FADE_SECONDS
    fade.current = dancing ? Math.min(1, fade.current + step) : Math.max(0, fade.current - step)
    setOpacity(rig.material, fade.current)
    if (group.current) group.current.visible = fade.current > 0
    if (fade.current === 0) {
      time.current = 0
      return
    }
    time.current += delta
    const swing = Math.min(1, time.current / WARM_UP) * fade.current
    pose(rig, pelvisRest, time.current * TEMPO * Math.PI, swing)
  })

  return (
    <group ref={group} visible={false}>
      <primitive object={rig.root} />
    </group>
  )
}
