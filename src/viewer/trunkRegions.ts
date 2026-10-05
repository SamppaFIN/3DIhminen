import { Box3, type Object3D } from 'three'
import { findNode } from './regions'

// Landmarks of the trunk model (thorax, abdomen and back). Its regions follow the trunk rule in
// armRegions.ts, so a point gets the same region whichever model's muscle it lies on.
export type TrunkLandmarks = {
  neckY: number // top of T1: above it is the neck
  spineZ: number // centre of the thoracic spine front to back; the spine lies at x = 0
  atlasZ: number // centre of the atlas (C1) front to back: the neck's front and back meet here
}

// root: the trunk model.
export function computeTrunkLandmarks(root: Object3D): TrunkLandmarks {
  const t1 = new Box3().setFromObject(findNode(root, 'Thoracic vertebrae (T1)'))
  const atlas = new Box3().setFromObject(findNode(root, 'Atlas (C1)'))
  return { neckY: t1.max.y, spineZ: (t1.min.z + t1.max.z) / 2, atlasZ: (atlas.min.z + atlas.max.z) / 2 }
}
