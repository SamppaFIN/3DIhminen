import { useThree } from '@react-three/fiber'
import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react'
import { type Object3D, Raycaster, type Vector3 } from 'three'
import type { LayerVisibility } from './layers'
import { accumulate, type Peeled, peelNext, prunePeeled, restoreAll, restoreNext } from './peel'

// Peeling layers by zooming. The camera stops NEAR_SURFACE in front of the first surface it looks
// at; zooming in further there peels the outermost layer shown (the muscles first, then the tendons
// and fascia; the bones stay), and the camera may then come closer to what was under it. Zooming
// out puts the peeled layers back, last peeled first, moving the camera back to where each was
// peeled, before it moves further away. A zoom gesture that runs into the surface does not peel:
// a wheel peels after a pause, a pinch only if it started at the surface. Leaving the view
// (another focus, a reset, the whole-body figure) puts every peeled layer back and moves the
// camera out of them.

// The closest the camera ever gets to its target (metres): OrbitControls' minDistance.
export const MIN_DISTANCE = 0.08
// How close the camera comes to the surface in view (metres), and what counts as being there.
const NEAR_SURFACE = 0.1
const AT_SURFACE = NEAR_SURFACE * 1.1
// A raycast over the whole model is not free; the surface found is reused for this long.
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
  // Takes an updater too, so layers are put back from the state as it then is.
  onChange: Dispatch<SetStateAction<LayerVisibility>>
}

export function LayerPeel({ root, focus, resetKey, layers, onChange }: Props) {
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as unknown as Controls | null
  const canvas = useThree((state) => state.gl.domElement)
  // Layers hidden by peeling, in the order they were peeled.
  const peeled = useRef<Peeled[]>([])
  // Layers changed here and not yet rendered, so a second step in the same frame sees them.
  const pending = useRef<LayerVisibility | null>(null)
  // The latest onChange, for the cleanup that puts the peeled layers back.
  const latestOnChange = useRef(onChange)
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
  // Where the surface in view lies, as its offset from the target along the view ray: that holds
  // while the camera dollies along the ray, unlike a distance from the camera.
  const surface = useRef<{ at: number; fromTarget: number } | null>(null)
  const raycaster = useRef(new Raycaster())

  useEffect(() => {
    latestOnChange.current = onChange
  }, [onChange])

  // Another focus, a reset or the whole-body figure: what was peeled comes back, on top of the
  // layers as they are by then (a selection may have just shown one), and the camera moves out
  // to where the outermost layer was peeled, so it is not left inside it.
  useEffect(
    () => () => {
      const stack = peeled.current
      peeled.current = []
      pending.current = null
      surface.current = null
      if (!controls) return
      controls.minDistance = MIN_DISTANCE
      if (stack.length === 0) return
      const direction = camera.position.clone().sub(controls.target).normalize()
      const distance = Math.max(stack[0].distance, camera.position.distanceTo(controls.target))
      camera.position.copy(controls.target).addScaledVector(direction, distance)
      latestOnChange.current((current) => restoreAll(stack, current))
    },
    [focus, resetKey, controls, camera],
  )

  useEffect(() => {
    if (!controls) return
    // New props: the layers are rendered, and the view may have changed.
    pending.current = null
    surface.current = null
    const current = () => pending.current ?? layers
    const distanceToTarget = () => camera.position.distanceTo(controls.target)
    // Distance from the camera to the first shown surface towards the target.
    const surfaceDistance = () => {
      const now = performance.now()
      const toTarget = distanceToTarget()
      if (surface.current && now - surface.current.at < SURFACE_CACHE_MS) return toTarget - surface.current.fromTarget
      const direction = controls.target.clone().sub(camera.position).normalize()
      raycaster.current.set(camera.position, direction)
      const hit = raycaster.current.intersectObject(root, true)[0]
      const distance = hit ? hit.distance : Infinity
      surface.current = { at: now, fromTarget: toTarget - distance }
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
      peeled.current = prunePeeled(peeled.current, current())
      return peeled.current.length > 0
    }
    const canPeel = () => peelNext(peeled.current, current(), 0) !== null
    // Whether moving `delta` (negative: in) changes a layer instead of the camera.
    const applies = (delta: number) => (delta < 0 ? atSurface() && canPeel() : delta > 0 && restorable())
    const change = (next: LayerVisibility) => {
      pending.current = next
      surface.current = null
      onChange(next)
    }
    const peelIn = () => {
      const next = peelNext(peeled.current, current(), distanceToTarget())
      if (!next) return
      peeled.current = next.stack
      change(next.layers)
    }
    const peelOut = () => {
      const next = restoreNext(peeled.current, current())
      if (!next) return
      peeled.current = next.stack
      // Back to where the layer was peeled, so the camera is outside it again.
      controls.minDistance = Math.max(MIN_DISTANCE, next.distance)
      const direction = camera.position.clone().sub(controls.target).normalize()
      camera.position.copy(controls.target).addScaledVector(direction, next.distance)
      change(next.layers)
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
