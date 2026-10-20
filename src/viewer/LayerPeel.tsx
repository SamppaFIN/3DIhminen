import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { type Object3D, Raycaster, type Vector3 } from 'three'
import { type LayerVisibility, nextPeel } from './layers'
import { accumulate, type Peeled, peelNext, prunePeeled, restoreAll, restoreNext } from './peel'

// Peeling layers by zooming. The camera stops NEAR_SURFACE in front of the first surface it looks
// at; zooming in further there peels the outermost layer shown (the muscles first, then the tendons
// and fascia; the bones stay), and the camera may then come closer to what was under it. Zooming
// out puts the peeled layers back, innermost first, moving the camera back to where each was
// peeled, before it moves further away. A zoom gesture that runs into the surface does not peel:
// a wheel peels after a pause, a pinch only if it started at the surface. Leaving the view
// (another focus, the whole-body figure) puts every peeled layer back.

// The closest the camera ever gets to its target (metres): OrbitControls' minDistance.
export const MIN_DISTANCE = 0.08
// How close the camera comes to the surface in view (metres), and what counts as being there.
const NEAR_SURFACE = 0.1
const AT_SURFACE = NEAR_SURFACE * 1.1
// A raycast over the whole model is not free; the surface distance is reused for this long.
const SURFACE_CACHE_MS = 100
// Wheel events further apart than this belong to different gestures.
const PAUSE_MS = 300
// Wheel movement for one peel step (pixels; a mouse notch is about 100).
const WHEEL_STEP = 100
// Pinch spread for one peel step (pixels).
const PINCH_STEP = 40
// Firefox reports wheel movement in lines.
const LINE_PX = 16

type Controls = { target: Vector3; minDistance: number }
type Props = {
  // The anatomy models: what the camera stops in front of.
  root: Object3D
  // A new focus or reset puts the peeled layers back.
  focus: unknown
  resetKey: number
  layers: LayerVisibility
  onChange: (layers: LayerVisibility) => void
}

export function LayerPeel({ root, focus, resetKey, layers, onChange }: Props) {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as unknown as Controls | null
  const canvas = useThree((state) => state.gl.domElement)
  // Layers hidden by peeling, outermost first.
  const peeled = useRef<Peeled[]>([])
  // The latest props, for the cleanup that puts the peeled layers back.
  const latest = useRef({ layers, onChange })
  const wheel = useRef(0)
  const lastWheel = useRef(0)
  // A wheel gesture that reached the surface by zooming does not peel; the next one does.
  const wheelMode = useRef<'zoom' | 'peel'>('zoom')
  // The fingers on the screen, the distance between them last measured, the pinch so far, and
  // whether this pinch started at the surface.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const spread = useRef<number | null>(null)
  const pinch = useRef(0)
  const pinchArmed = useRef(false)
  const surface = useRef<{ at: number; distance: number } | null>(null)
  const raycaster = useRef(new Raycaster())

  useEffect(() => {
    latest.current = { layers, onChange }
  }, [layers, onChange])

  // Another focus, a reset or the whole-body figure: what was peeled comes back.
  useEffect(
    () => () => {
      const stack = peeled.current
      peeled.current = []
      surface.current = null
      if (controls) controls.minDistance = MIN_DISTANCE
      if (stack.length > 0) latest.current.onChange(restoreAll(stack, latest.current.layers))
    },
    [focus, resetKey, controls],
  )

  useEffect(() => {
    if (!controls) return
    const distanceToTarget = () => camera.position.distanceTo(controls.target)
    // Distance from the camera to the first shown surface towards the target.
    const surfaceDistance = () => {
      const now = performance.now()
      if (surface.current && now - surface.current.at < SURFACE_CACHE_MS) return surface.current.distance
      const direction = controls.target.clone().sub(camera.position).normalize()
      raycaster.current.set(camera.position, direction)
      const hit = raycaster.current.intersectObject(root, true)[0]
      const distance = hit ? hit.distance : Infinity
      surface.current = { at: now, distance }
      return distance
    }
    const atSurface = () => surfaceDistance() <= AT_SURFACE
    // Keeps the camera NEAR_SURFACE in front of the surface it looks at: OrbitControls clamps.
    const holdAtSurface = () => {
      const distance = surfaceDistance()
      controls.minDistance = Number.isFinite(distance)
        ? Math.max(MIN_DISTANCE, distanceToTarget() - distance + NEAR_SURFACE)
        : MIN_DISTANCE
    }
    const restorable = () => {
      peeled.current = prunePeeled(peeled.current, layers)
      return peeled.current.length > 0
    }
    // Whether moving `delta` (negative: in) changes a layer instead of the camera.
    const applies = (delta: number) => (delta < 0 ? atSurface() && nextPeel(layers) !== null : delta > 0 && restorable())
    const peelIn = () => {
      const next = peelNext(peeled.current, layers, distanceToTarget())
      if (!next) return
      peeled.current = next.stack
      surface.current = null
      onChange(next.layers)
    }
    const peelOut = () => {
      const next = restoreNext(peeled.current, layers)
      if (!next) return
      peeled.current = next.stack
      surface.current = null
      // Back to where the layer was peeled, so the camera is outside it again.
      controls.minDistance = Math.max(MIN_DISTANCE, next.distance)
      const direction = camera.position.clone().sub(controls.target).normalize()
      camera.position.copy(controls.target).addScaledVector(direction, next.distance)
      onChange(next.layers)
    }
    const peel = (delta: number) => (delta < 0 ? peelIn() : peelOut())

    const onWheel = (event: WheelEvent) => {
      const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * LINE_PX : event.deltaY
      const sameGesture = event.timeStamp - lastWheel.current < PAUSE_MS
      lastWheel.current = event.timeStamp
      if (delta < 0) holdAtSurface()
      if (!applies(delta)) {
        wheelMode.current = 'zoom'
        wheel.current = 0
        return
      }
      // The layer changes instead of the camera: OrbitControls does not see the event.
      event.preventDefault()
      event.stopImmediatePropagation()
      // A zoom that ran into the surface (e.g. trackpad inertia) does not peel.
      if (sameGesture && wheelMode.current === 'zoom') return
      wheelMode.current = 'peel'
      const step = accumulate(wheel.current, delta, WHEEL_STEP)
      wheel.current = step.total
      if (step.full) peel(delta)
    }

    // Only fingers: a mouse released outside the canvas would otherwise linger as a pointer.
    const currentSpread = () => {
      const [a, b] = [...pointers.current.values()]
      return Math.hypot(a.x - b.x, a.y - b.y)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      pinch.current = 0
      if (pointers.current.size === 2) {
        spread.current = currentSpread()
        pinchArmed.current = atSurface() || restorable()
      } else {
        spread.current = null
      }
    }
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || !pointers.current.has(event.pointerId)) return
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (pointers.current.size !== 2 || spread.current === null) return
      const next = currentSpread()
      // Spreading the fingers zooms in, so its delta is negative like the wheel's.
      const delta = spread.current - next
      spread.current = next
      if (delta < 0) holdAtSurface()
      if (!pinchArmed.current || !applies(delta)) {
        pinch.current = 0
        return
      }
      const step = accumulate(pinch.current, delta, PINCH_STEP)
      pinch.current = step.total
      if (step.full) peel(delta)
    }
    const onPointerEnd = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return
      pointers.current.delete(event.pointerId)
      spread.current = null
      pinch.current = 0
      pinchArmed.current = false
    }

    canvas.addEventListener('wheel', onWheel, { capture: true, passive: false })
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerEnd)
    canvas.addEventListener('pointercancel', onPointerEnd)
    return () => {
      canvas.removeEventListener('wheel', onWheel, { capture: true })
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerEnd)
      canvas.removeEventListener('pointercancel', onPointerEnd)
    }
  }, [camera, controls, canvas, root, layers, onChange])

  return null
}
