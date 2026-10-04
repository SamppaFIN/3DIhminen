import { Color, type Material, Mesh, type MeshStandardMaterial, type Object3D } from 'three'

// --muscle-dim from design-brief.md, oklch(72% 0.06 22) in sRGB.
const DIM_COLOR = new Color('#c89694')
// Dimmed structures are see-through so a highlighted muscle underneath stays visible.
const DIM_OPACITY = 0.35
const dimmed = new WeakMap<Material, Material>()
const recoloured = new Map<string, Material>()

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

// nodeColors: the nodes to emphasise, each with a colour, or null to keep its own material.
// Every other structure in the model's Muscles group is dimmed; bones are left as they are.
// null shows everything normally.
export function highlightNodes(root: Object3D, nodeColors: Map<string, string | null> | null): void {
  root.traverse((group) => {
    if (group.userData.name !== 'Muscles') return
    for (const node of group.children) {
      const name = node.userData.name
      const color = nodeColors?.get(name)
      node.traverse((object) => {
        if (!(object instanceof Mesh)) return
        const base: Material = object.userData.baseMaterial ?? object.material
        object.userData.baseMaterial = base
        if (!nodeColors || color === null) object.material = base
        else if (color) object.material = recolourOf(base, color)
        else object.material = dimOf(base)
      })
    }
  })
}
