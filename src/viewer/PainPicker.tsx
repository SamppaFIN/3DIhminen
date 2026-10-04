import { useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { DoubleSide, type Object3D, Quaternion, Vector3 } from 'three'
import { nearbyNodes, nearbyRadius } from './nearby'
import { pickSurface } from './picking'
import type { Region } from './regions'

// nearby: names of the model nodes (muscles, tendons, bones) within nearbyRadius(region) of the point,
// including hidden layers: what lies under the pain point does not depend on what is shown.
export type PainPoint = { point: Vector3; normal: Vector3; region: Region; nearby: string[] }

// A pointer that moves further than this between down and up is a drag (rotate/pan), not a tap.
const TAP_TOLERANCE_PX = 6

// --pain from design-brief.md, oklch(70% 0.14 215) in sRGB.
const PAIN_COLOR = '#00b3d4'
const RING_FACING = new Vector3(0, 0, 1)

export type Classify = (point: Vector3, normal: Vector3, object: Object3D) => Region

type PainPickerProps = { root: Object3D; classify: Classify; onPick: (pain: PainPoint) => void }

export function PainPicker({ root, classify, onPick }: PainPickerProps) {
  const camera = useThree((state) => state.camera)
  const canvas = useThree((state) => state.gl.domElement)

  useEffect(() => {
    const pointers = new Map<number, { x: number; y: number }>()
    let multiTouch = false

    const down = (event: PointerEvent) => {
      if (event.button !== 0) return
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (pointers.size > 1) multiTouch = true
    }
    const release = (event: PointerEvent) => {
      const start = pointers.get(event.pointerId)
      pointers.delete(event.pointerId)
      const wasMultiTouch = multiTouch
      if (pointers.size === 0) multiTouch = false
      return start && !wasMultiTouch ? start : undefined
    }
    const up = (event: PointerEvent) => {
      const start = release(event)
      if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_TOLERANCE_PX) return
      const rect = canvas.getBoundingClientRect()
      const hit = pickSurface(camera, root, { x: event.clientX - rect.left, y: event.clientY - rect.top }, rect)
      if (!hit?.face) return
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
      const region = classify(hit.point, normal, hit.object)
      onPick({ point: hit.point.clone(), normal, region, nearby: nearbyNodes(root, hit.point, nearbyRadius(region)) })
    }

    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', release)
    return () => {
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', release)
    }
  }, [camera, canvas, root, classify, onPick])

  return null
}

// A ring (not a dot) lying on the surface; drawn on top so it stays visible from any angle.
export function PainMarker({ point, normal }: Pick<PainPoint, 'point' | 'normal'>) {
  const quaternion = useMemo(() => new Quaternion().setFromUnitVectors(RING_FACING, normal), [normal])
  return (
    <mesh position={point} quaternion={quaternion} renderOrder={1}>
      <ringGeometry args={[0.006, 0.009, 32]} />
      <meshBasicMaterial color={PAIN_COLOR} side={DoubleSide} depthTest={false} transparent />
    </mesh>
  )
}
