import { type Camera, type Intersection, type Object3D, Raycaster, Vector2 } from 'three'

// A tap that misses by a few pixels snaps to the nearest surface instead of hitting nothing.
const SNAP_RADII_PX = [6, 12, 18]
const SNAP_SAMPLES = 8

type Size = { width: number; height: number }

export function pickSurface(
  camera: Camera,
  root: Object3D,
  pixel: { x: number; y: number },
  size: Size,
): Intersection | undefined {
  const raycaster = new Raycaster()
  const ndc = new Vector2()
  const cast = (x: number, y: number) => {
    raycaster.setFromCamera(ndc.set((x / size.width) * 2 - 1, -(y / size.height) * 2 + 1), camera)
    return raycaster.intersectObject(root, true)[0]
  }

  const direct = cast(pixel.x, pixel.y)
  if (direct) return direct

  for (const radius of SNAP_RADII_PX) {
    const hits: Intersection[] = []
    for (let i = 0; i < SNAP_SAMPLES; i++) {
      const angle = (i / SNAP_SAMPLES) * 2 * Math.PI
      const hit = cast(pixel.x + radius * Math.cos(angle), pixel.y + radius * Math.sin(angle))
      if (hit) hits.push(hit)
    }
    if (hits.length > 0) return hits.reduce((a, b) => (a.distance <= b.distance ? a : b))
  }
  return undefined
}
