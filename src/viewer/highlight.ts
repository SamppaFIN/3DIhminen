import { Color, type Material, Mesh, type MeshStandardMaterial, type Object3D } from 'three'

// --muscle-dim from design-brief.md, oklch(72% 0.06 22) in sRGB.
const DIM_COLOR = new Color('#c89694')
// Dimmed structures are see-through so a highlighted muscle underneath stays visible.
const DIM_OPACITY = 0.35
const dimmed = new WeakMap<Material, Material>()
const recoloured = new Map<string, Material>()
const lit = new WeakMap<Material, Material>()
// Groups whose parts are emphasised or dimmed; bones are left as they are.
const HIGHLIGHT_GROUPS = new Set(['Muscles', 'Fascia'])

// Muscles turn --muscle-dim; tendons and fascia keep their colour and only become see-through.
function dimOf(base: Material): Material {
  let dim = dimmed.get(base)
  if (!dim) {
    const material = base.clone() as MeshStandardMaterial
    if (base.name === 'muscle') material.color.copy(DIM_COLOR)
    material.transparent = true
    material.opacity = DIM_OPACITY
    material.depthWrite = false
    dim = material
    dimmed.set(base, dim)
  }
  return dim
}

// An emphasised see-through fascia sheet is drawn solid, so it stands out from the dimmed parts.
function litOf(base: Material): Material {
  if (!base.transparent) return base
  let material = lit.get(base)
  if (!material) {
    material = base.clone()
    material.transparent = false
    material.opacity = 1
    material.depthWrite = true
    lit.set(base, material)
  }
  return material
}

function recolourOf(base: Material, color: string): Material {
  const key = `${base.uuid}|${color}`
  let material = recoloured.get(key)
  if (!material) {
    const clone = base.clone() as MeshStandardMaterial
    clone.color.set(color)
    material = clone
    recoloured.set(key, material)
  }
  return material
}

// nodeColors: the nodes to emphasise, each with a colour, or null to keep its own material (drawn
// solid if it is see-through).
// Every other structure in the model's Muscles and Fascia groups is dimmed; bones are left as they are.
// null shows everything normally. Parts on both sides (mirror.ts) are emphasised on `side` only.
export function highlightNodes(root: Object3D, nodeColors: Map<string, string | null> | null, side = 'right'): void {
  root.traverse((group) => {
    if (!HIGHLIGHT_GROUPS.has(group.userData.name)) return
    for (const node of group.children) {
      const name = node.userData.name
      const otherSide = node.userData.side !== undefined && node.userData.side !== side
      const color = otherSide ? undefined : nodeColors?.get(name)
      node.traverse((object) => {
        // The halos of glow.ts keep their own material.
        if (!(object instanceof Mesh) || object.userData.isHalo) return
        const base: Material = object.userData.baseMaterial ?? object.material
        object.userData.baseMaterial = base
        if (!nodeColors) object.material = base
        else if (color === null) object.material = litOf(base)
        else if (color) object.material = recolourOf(base, color)
        else object.material = dimOf(base)
      })
    }
  })
}
