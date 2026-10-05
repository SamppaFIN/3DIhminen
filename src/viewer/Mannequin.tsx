import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { Color, type Group, type Material, MeshStandardMaterial, Quaternion, Vector3 } from 'three'
import type { BodyArea, BodySide } from './body'

// A soft, rounded whole-body figure in the spirit of Human Fall Flat (our own shapes, not the game's).
// It sits over the anatomy models: joint positions are measured from the bones in public/models/
// (metres, +Y up, +Z front, right side at -X). Clicking a part zooms into that area's anatomy.


type Vec = [number, number, number]
type Part =
  | { area: BodyArea; capsule: [Vec, Vec]; radius: number; scale?: Vec }
  | { area: BodyArea; sphere: Vec; radius: number; scale?: Vec }

// Right side; the left side is mirrored.
const LIMB: Part[] = [
  { area: 'thigh', capsule: [[-0.08, 0.84, -0.02], [-0.08, 0.47, -0.02]], radius: 0.072 },
  { area: 'knee', sphere: [-0.08, 0.44, -0.015], radius: 0.056 },
  { area: 'leg', capsule: [[-0.08, 0.4, -0.025], [-0.076, 0.11, -0.035]], radius: 0.052 },
  // Scales act in the capsule's own frame (its axis is local Y): local Z flattens the foot vertically
  // and the hand front to back.
  { area: 'foot', capsule: [[-0.078, 0.042, -0.07], [-0.085, 0.035, 0.105]], radius: 0.042, scale: [1, 1, 0.85] },
  { area: 'shoulder', sphere: [-0.195, 1.365, -0.03], radius: 0.062 },
  { area: 'upper_arm', capsule: [[-0.2, 1.32, -0.03], [-0.226, 1.12, -0.026]], radius: 0.046 },
  { area: 'forearm', sphere: [-0.228, 1.1, -0.025], radius: 0.041 },
  { area: 'forearm', capsule: [[-0.232, 1.06, -0.02], [-0.26, 0.88, 0.004]], radius: 0.038 },
  { area: 'hand', capsule: [[-0.267, 0.84, 0.02], [-0.284, 0.73, 0.068]], radius: 0.034, scale: [1, 1, 0.7] },
  { area: 'hand', capsule: [[-0.3, 0.83, 0.035], [-0.328, 0.78, 0.06]], radius: 0.015 },
  { area: 'head', sphere: [-0.098, 1.63, -0.01], radius: 0.026, scale: [0.45, 1, 0.75] },
]

const CENTRE: Part[] = [
  { area: 'pelvis', sphere: [0, 0.92, -0.01], radius: 0.165, scale: [1, 0.62, 0.72] },
  { area: 'trunk', capsule: [[0, 1.03, -0.005], [0, 1.33, -0.005]], radius: 0.155, scale: [1.1, 1, 0.74] },
  // Neck, skull, jaw and nose: a big, round head over the skull of the head and neck model.
  { area: 'head', capsule: [[0, 1.43, -0.02], [0, 1.53, -0.015]], radius: 0.058 },
  { area: 'head', sphere: [0, 1.645, -0.005], radius: 0.12, scale: [0.85, 1, 0.95] },
  { area: 'head', sphere: [0, 1.585, 0.012], radius: 0.09, scale: [0.95, 0.85, 1] },
  { area: 'head', capsule: [[0, 1.64, 0.108], [0, 1.612, 0.118]], radius: 0.015 },
]

// Eyes: plain dark dots, as on the game's characters.
const EYES: Vec[] = [
  [-0.04, 1.66, 0.1],
  [0.04, 1.66, 0.1],
]

const mirror = ([x, y, z]: Vec): Vec => [-x, y, z]

const PARTS: (Part & { side: BodySide })[] = [
  ...CENTRE.map((p) => ({ ...p, side: 'centre' as const })),
  ...LIMB.map((p) => ({ ...p, side: 'right' as const })),
  ...LIMB.map((p) =>
    'capsule' in p
      ? { ...p, capsule: [mirror(p.capsule[0]), mirror(p.capsule[1])] as [Vec, Vec], side: 'left' as const }
      : { ...p, sphere: mirror(p.sphere), side: 'left' as const },
  ),
]

// Placement of a capsule between two points (three's capsule runs along +Y).
function capsulePose([a, b]: [Vec, Vec]) {
  const start = new Vector3(...a)
  const end = new Vector3(...b)
  const axis = end.clone().sub(start)
  return {
    length: axis.length(),
    position: start.clone().add(end).multiplyScalar(0.5),
    quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), axis.normalize()),
  }
}

// Pale, doughy surface; slightly warmer when hovered.
const SKIN = new Color('#ebe5da')
const SKIN_HOVER = new Color('#f4e2c8')
const EYE = new Color('#3a3f47')
const FADE_SECONDS = 0.4

function applyFade(materials: Material[], fade: number): void {
  for (const material of materials) {
    material.opacity = fade
    material.depthWrite = fade > 0.99
  }
}

type Props = {
  visible: boolean
  onSelect: (area: BodyArea, side: BodySide) => void
}

export function Mannequin({ visible, onSelect }: Props) {
  const material = useMemo(() => new MeshStandardMaterial({ color: SKIN, roughness: 0.85, transparent: true }), [])
  const hoverMaterial = useMemo(() => new MeshStandardMaterial({ color: SKIN_HOVER, roughness: 0.85, transparent: true }), [])
  const eye = useMemo(() => new MeshStandardMaterial({ color: EYE, roughness: 0.4, transparent: true }), [])
  const [hovered, setHovered] = useState<number | null>(null)
  const group = useRef<Group>(null)
  const fade = useRef(1)
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  // Fades out when the anatomy is shown, and back in for the whole-body view.
  useFrame((_, delta) => {
    const target = visible ? 1 : 0
    const step = reducedMotion ? 1 : delta / FADE_SECONDS
    fade.current = target > fade.current ? Math.min(target, fade.current + step) : Math.max(target, fade.current - step)
    applyFade([material, hoverMaterial, eye], fade.current)
    if (group.current) group.current.visible = fade.current > 0
  })

  const selectHead = (event: { delta: number; stopPropagation: () => void }) => {
    if (!visible || event.delta > 6) return
    event.stopPropagation()
    onSelect('head', 'centre')
  }

  return (
    <group ref={group}>
      {EYES.map((position) => (
        <mesh key={position[0]} position={position} material={eye} onClick={selectHead}>
          <sphereGeometry args={[0.013, 16, 12]} />
        </mesh>
      ))}
      {PARTS.map((part, i) => {
        const shared = {
          material: hovered === i ? hoverMaterial : material,
          scale: part.scale ?? ([1, 1, 1] as Vec),
          onPointerOver: () => visible && setHovered(i),
          onPointerOut: () => setHovered((h) => (h === i ? null : h)),
          onClick: (event: { delta: number; stopPropagation: () => void }) => {
            if (!visible || event.delta > 6) return
            event.stopPropagation()
            onSelect(part.area, part.side)
          },
        }
        if ('capsule' in part) {
          const { length, position, quaternion } = capsulePose(part.capsule)
          return (
            <mesh key={i} position={position} quaternion={quaternion} {...shared}>
              <capsuleGeometry args={[part.radius, length, 8, 16]} />
            </mesh>
          )
        }
        return (
          <mesh key={i} position={part.sphere} {...shared}>
            <sphereGeometry args={[part.radius, 24, 16]} />
          </mesh>
        )
      })}
    </group>
  )
}
