import { Box3, Group, type Object3D, type Vector3 } from 'three'

// The models hold the right side of the body (at -X). The left side is a mirrored copy, made at load
// time: every part that lies entirely on the right and has no left counterpart in the model (the
// skull has both sides) is cloned and mirrored across the midline (x = 0). Clones keep their node
// names, so the data, highlighting and layers apply to both sides; userData.side tells them apart.

export type Side = 'right' | 'left'

// Parts that reach further than this over the midline (metres) span both sides and are not copied.
const MIDLINE_TOLERANCE = 0.005
// Groups of parts in the models; other top-level nodes (attachment patches) are parts themselves.
const GROUPS = new Set(['Muscles', 'Bones'])

const leftName = (name: string) => name.replace(/\.r(\.?)$/, '.l$1')

export function mirrorRightSide(scene: Object3D): Group {
  scene.updateMatrixWorld(true)
  const names = new Set<string>()
  scene.traverse((object) => {
    if (object.userData.name) names.add(object.userData.name)
  })
  const mirrored = (part: Object3D) => {
    const name = part.userData.name
    if (!name || (leftName(name) !== name && names.has(leftName(name)))) return null
    if (new Box3().setFromObject(part).max.x > MIDLINE_TOLERANCE) return null
    part.userData.side = 'right'
    const copy = part.clone()
    copy.userData.side = 'left'
    return copy
  }

  const mirror = new Group()
  mirror.scale.x = -1
  for (const child of scene.children) {
    if (!GROUPS.has(child.userData.name)) {
      const copy = mirrored(child)
      if (copy) mirror.add(copy)
      continue
    }
    const group = new Group()
    group.userData.name = child.userData.name
    group.position.copy(child.position)
    group.quaternion.copy(child.quaternion)
    group.scale.copy(child.scale)
    for (const part of child.children) {
      const copy = mirrored(part)
      if (copy) group.add(copy)
    }
    mirror.add(group)
  }
  return mirror
}

// The region classifiers work on the right side: a point on the left is mirrored to the right first.
export function sideOfPoint(point: Vector3): Side {
  return point.x > 0 ? 'left' : 'right'
}

export function mirrorX(vector: Vector3): Vector3 {
  return vector.clone().setX(-vector.x)
}
