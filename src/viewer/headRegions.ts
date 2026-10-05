import { Box3, type Object3D, type Vector3 } from 'three'
import { trunkRegion } from './armRegions'
import { findNode, type Region } from './regions'

// Regions of the head and neck model. Model frame as in regions.ts. The skull covers both sides,
// so the rules use the distance from the midline (|x|).
export type HeadLandmarks = {
  skullBaseY: number // bottom of the occipital bone: above it, behind the spine, is the back of the head
  jawBottomY: number // bottom of the mandible: below it is the neck
  cheekboneY: number // bottom of the zygomatic bone: between it and the jaw's bottom is the jaw
  templeX: number // |x| beyond the zygomatic bone's outer edge: the side of the head
  templeTopY: number // top of the temporalis
  throatX: number // |x| beyond the thyroid cartilage (plus 1 cm): the side of the neck
}

function bounds(root: Object3D, name: string): Box3 {
  return new Box3().setFromObject(findNode(root, name))
}

// root: the head and neck model.
export function computeHeadLandmarks(root: Object3D): HeadLandmarks {
  const zygomatic = bounds(root, 'Zygomatic bone.r')
  return {
    skullBaseY: bounds(root, 'Occipital bone').min.y,
    jawBottomY: bounds(root, 'Mandible').min.y,
    cheekboneY: zygomatic.min.y,
    templeX: Math.abs(zygomatic.min.x),
    templeTopY: bounds(root, 'Temporalis muscle.r').max.y,
    throatX: Math.abs(bounds(root, 'Thyroid cartilage').min.x) + 0.01,
  }
}

// elbowY, neckY and spineZ (the front-to-back centre of the atlas) come from the arm and trunk
// models: below the neck the trunk rule applies, and the spine splits the neck into front and back.
export function classifyHeadRegion(
  point: Vector3,
  lm: HeadLandmarks,
  trunk: { elbowY: number; neckY: number; atlasZ: number },
): Region {
  if (point.y <= trunk.neckY) return trunkRegion(point, trunk.elbowY, trunk.neckY)
  const side = Math.abs(point.x)
  if (side > lm.templeX && point.y > lm.cheekboneY && point.y < lm.templeTopY) return 'temple'
  if (point.z < trunk.atlasZ) return point.y > lm.skullBaseY ? 'head_back' : 'neck'
  if (point.y < lm.jawBottomY) return side > lm.throatX ? 'neck_side' : 'neck_front'
  if (point.y < lm.cheekboneY) return 'jaw'
  return 'face'
}
