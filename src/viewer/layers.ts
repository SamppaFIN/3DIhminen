import { type Material, Mesh, type Object3D } from 'three'
import muscles from '../data/muscles.json'

// superficial and deep: the muscles, by muscles.json. connective: the tendons, aponeuroses and
// fascia, which the models give the tendon or fascia material (scripts/model-utils.mjs) or put in
// the Fascia group; a tendon that is part of a muscle in the data follows that muscle's layer.
// Muscles without data yet count as superficial, so peeling the muscles leaves none behind.
export type Layer = 'superficial' | 'deep' | 'connective'
export type LayerVisibility = Record<Layer, boolean>

// Outermost first: zooming in past the closest distance peels them in this order (LayerPeel.tsx).
export const PEEL_ORDER: Layer[] = ['superficial', 'deep', 'connective']

// Groups of the models whose parts have a layer; the bones are always shown.
const LAYERED_GROUPS = new Set(['Muscles', 'Fascia'])
const CONNECTIVE_MATERIALS = new Set(['tendon', 'fascia'])
const MUSCLE_MATERIALS = new Set(['muscle'])

// Cameras and raycasters use three.js layer 0 by default, so objects moved to
// another layer are neither rendered nor hit by pointer events.
const HIDDEN_LAYER = 1

// GLTFLoader keeps the original node name in userData.name (object.name is sanitized).
const layerByNodeName = new Map(
  muscles.flatMap((m) => m.meshes.map((name) => [name, m.layer as Layer] as const)),
)

// highlight.ts swaps materials and keeps the model's own in userData.baseMaterial.
function hasMaterial(part: Object3D, names: Set<string>): boolean {
  let found = false
  part.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const material: Material = object.userData.baseMaterial ?? object.material
    if (names.has(material.name)) found = true
  })
  return found
}

// The layer of a part of a Muscles or Fascia group; undefined for parts with another material.
export function layerOf(part: Object3D, group: Object3D): Layer | undefined {
  const known = layerByNodeName.get(part.userData.name)
  if (known) return known
  if (group.userData.name === 'Fascia' || hasMaterial(part, CONNECTIVE_MATERIALS)) return 'connective'
  if (hasMaterial(part, MUSCLE_MATERIALS)) return 'superficial'
  return undefined
}

export function applyLayerVisibility(root: Object3D, visibility: LayerVisibility): void {
  root.traverse((group) => {
    if (!LAYERED_GROUPS.has(group.userData.name)) return
    for (const part of group.children) {
      const layer = layerOf(part, group)
      if (!layer) continue
      const target = visibility[layer] ? 0 : HIDDEN_LAYER
      part.traverse((child) => child.layers.set(target))
    }
  })
}

// The outermost layer still shown: what zooming in past the closest distance peels next.
export function nextPeel(visibility: LayerVisibility): Layer | null {
  return PEEL_ORDER.find((layer) => visibility[layer]) ?? null
}
