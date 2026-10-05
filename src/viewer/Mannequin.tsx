import { useGLTF } from '@react-three/drei'
import { type ThreeEvent, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Color, type Group, Mesh, MeshStandardMaterial, type Object3D } from 'three'
import type { BodyArea, BodySide } from './body'

// The whole-body figure: the body surface from Z-Anatomy, in the same frame as the anatomy models
// (metres, +Y up, +Z front, right side at -X). Every skin region carries the body area and side
// it belongs to (userData.area and userData.side, from scripts/export-skin.py); clicking a region
// zooms into that area's anatomy on that side.

const SKIN_URL = `${import.meta.env.BASE_URL}models/skin.glb`

const SKIN = new Color('#e3bfa6')
const SKIN_HOVER = new Color('#f2cdb2')
const EYE_WHITE = new Color('#f4f1ec')
const IRIS = new Color('#4a5560')
const FADE_SECONDS = 0.4

type Part = { area: BodyArea; side: BodySide }

// The region a hit belongs to: the nearest node that carries an area.
function partOf(object: Object3D | null): Part | null {
  for (let node = object; node; node = node.parent) {
    if (node.userData.area) return { area: node.userData.area, side: node.userData.side ?? 'centre' }
  }
  return null
}

const key = (part: Part | null) => (part ? `${part.area}|${part.side}` : null)

// The perineum's skin is left out of the model to keep the figure neutral. The gap it leaves
// between the thighs narrows downwards from about 5 cm wide at y 0.835 to nothing at y 0.765; a
// downward cone, stretched front to back, closes it.
const CROTCH = { position: [0, 0.795, 0.03] as const, rotation: [Math.PI, 0, 0] as const, scale: [1.2, 1.25, 1.6] as const }
const CROTCH_PART: Part = { area: 'pelvis', side: 'centre' }

type Props = {
  visible: boolean
  onSelect: (area: BodyArea, side: BodySide) => void
}

export function Mannequin({ visible, onSelect }: Props) {
  const { scene } = useGLTF(SKIN_URL)
  const materials = useMemo(() => {
    const material = (color: Color, roughness: number) => new MeshStandardMaterial({ color, roughness, transparent: true })
    return { skin: material(SKIN, 0.75), hover: material(SKIN_HOVER, 0.75), white: material(EYE_WHITE, 0.3), iris: material(IRIS, 0.3) }
  }, [])
  const [hovered, setHovered] = useState<string | null>(null)
  const group = useRef<Group>(null)
  const fade = useRef(1)
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  // Skin regions of the hovered body area and side are warmer.
  useEffect(() => {
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const name: string = object.userData.name ?? object.parent?.userData.name ?? ''
      if (name.startsWith('Iris')) object.material = materials.iris
      else if (name.startsWith('Anterior segment of eyeball')) object.material = materials.white
      else object.material = key(partOf(object)) === hovered ? materials.hover : materials.skin
    })
  }, [scene, materials, hovered])

  // Fades out when the anatomy is shown, and back in for the whole-body view.
  useFrame((_, delta) => {
    const target = visible ? 1 : 0
    const step = reducedMotion ? 1 : delta / FADE_SECONDS
    fade.current = target > fade.current ? Math.min(target, fade.current + step) : Math.max(target, fade.current - step)
    for (const material of Object.values(materials)) {
      material.opacity = fade.current
      material.depthWrite = fade.current > 0.99
    }
    if (group.current) group.current.visible = fade.current > 0
  })

  const over = (event: ThreeEvent<PointerEvent>) => {
    if (!visible) return
    event.stopPropagation()
    setHovered(key(partOf(event.object)))
  }
  const click = (event: ThreeEvent<MouseEvent>) => {
    const part = partOf(event.object)
    if (!visible || !part || event.delta > 6) return
    event.stopPropagation()
    onSelect(part.area, part.side)
  }

  return (
    <group ref={group} onPointerOver={over} onPointerOut={() => setHovered(null)} onClick={click}>
      <primitive object={scene} />
      <mesh
        position={CROTCH.position}
        rotation={CROTCH.rotation}
        scale={CROTCH.scale}
        userData={CROTCH_PART}
        material={key(CROTCH_PART) === hovered ? materials.hover : materials.skin}
      >
        <coneGeometry args={[0.028, 0.075, 32]} />
      </mesh>
    </group>
  )
}
