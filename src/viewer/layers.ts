import type { Object3D } from 'three'
import muscles from '../data/muscles.json'

export type Layer = 'superficial' | 'deep'
export type LayerVisibility = Record<Layer, boolean>

// Cameras and raycasters use three.js layer 0 by default, so objects moved to
// another layer are neither rendered nor hit by pointer events.
const HIDDEN_LAYER = 1

// GLTFLoader keeps the original node name in userData.name (object.name is sanitized).
const layerByNodeName = new Map(
  muscles.flatMap((m) => m.meshes.map((name) => [name, m.layer as Layer] as const)),
)

export function applyLayerVisibility(root: Object3D, visibility: LayerVisibility): void {
  root.traverse((object) => {
    const layer = layerByNodeName.get(object.userData.name)
    if (!layer) return
    const target = visibility[layer] ? 0 : HIDDEN_LAYER
    object.traverse((child) => child.layers.set(target))
  })
}
