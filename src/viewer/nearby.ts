import { Box3, Mesh, type Object3D, Vector3 } from 'three'
import type { Region } from './regions'

// Structures this close to the pain point (metres) count as local pain sources.
export const NEARBY_RADIUS = 0.02
// The wrist and hand are only a few centimetres thick: a smaller radius keeps the tendons on the
// other side (e.g. the extensors behind a palm-side wrist point) out of the local sources.
const HAND_RADIUS = 0.012
const HAND_REGIONS: Region[] = ['wrist', 'palm', 'hand_back', 'thumb', 'fingers']

export function nearbyRadius(region: Region): number {
  return HAND_REGIONS.includes(region) ? HAND_RADIUS : NEARBY_RADIUS
}

// Names (userData.name) of the meshes that have a vertex within `radius` of `point`.
export function nearbyNodes(root: Object3D, point: Vector3, radius: number): string[] {
  const names: string[] = []
  const box = new Box3()
  const vertex = new Vector3()
  const radiusSq = radius * radius
  root.traverse((object) => {
    const name = object.userData.name
    if (!name || !(object instanceof Mesh)) return
    if (box.setFromObject(object).distanceToPoint(point) > radius) return
    const position = object.geometry.getAttribute('position')
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld)
      if (vertex.distanceToSquared(point) <= radiusSq) {
        names.push(name)
        return
      }
    }
  })
  return names
}
