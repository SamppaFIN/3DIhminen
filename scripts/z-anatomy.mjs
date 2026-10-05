// Shared steps of the extract-*.mjs scripts for models exported from Z-Anatomy by the
// export-*.py scripts: alignment to the Open3D models and regrouping of the exported nodes.

import { getBounds } from '@gltf-transform/core'
import { readSource } from './model-utils.mjs'

// Z-Anatomy reference bones and their counterparts in the Open3D models.
const COUNTERPARTS = {
  'Atlas (C1)': ['trunk', 'Atlas (C1)'],
  'Axis (C2)': ['trunk', 'Axis (C2)'],
  'Vertebra C3': ['trunk', 'Cervical vertebrae (C3)'],
  'Vertebra C4': ['trunk', 'Cervical vertebrae (C4)'],
  'Vertebra C5': ['trunk', 'Cervical vertebrae (C5)'],
  'Vertebra C6': ['trunk', 'Cervical vertebrae (C6)'],
  'Vertebra C7': ['trunk', 'Cervical vertebrae (C7)'],
  'Vertebra T1': ['trunk', 'Thoracic vertebrae (T1)'],
  'Clavicle.r': ['upper-limb', 'Clavicle.r'],
}

async function nodeBounds(model, name) {
  const { doc } = await readSource(`public/models/${model}.glb`)
  const node = doc.getRoot().listNodes().find((n) => n.getName() === name)
  if (!node) throw new Error(`${name} not found in ${model}.glb`)
  const { min, max } = getBounds(node)
  return [min, max]
}

// Z-Anatomy and Open3D share their origin, but Open3D's bones are shifted and scaled by a few
// millimetres. Fits target = scale * source + offset per axis to the reference bones' bounds
// (reference: the bounds the export wrote, by Z-Anatomy name).
export async function fitToOpen3D(reference) {
  const pairs = [[], [], []]
  for (const [source, [model, name]] of Object.entries(COUNTERPARTS)) {
    const from = reference[source]
    const to = await nodeBounds(model, name)
    for (const corner of [0, 1]) for (const axis of [0, 1, 2]) pairs[axis].push([from[corner][axis], to[corner][axis]])
  }
  const fit = pairs.map((points) => {
    const n = points.length
    const mx = points.reduce((s, [x]) => s + x, 0) / n
    const my = points.reduce((s, [, y]) => s + y, 0) / n
    const sxy = points.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0)
    const sxx = points.reduce((s, [x]) => s + (x - mx) ** 2, 0)
    const scale = sxy / sxx
    const residual = Math.sqrt(points.reduce((s, [x, y]) => s + (scale * x + my - scale * mx - y) ** 2, 0) / n)
    return { scale, offset: my - scale * mx, residual }
  })
  console.log('Alignment (scale, offset, rms residual in metres):', fit.map((f) => [f.scale, f.offset, f.residual].map((v) => +v.toFixed(4))))
  return { scale: fit.map((f) => f.scale), offset: fit.map((f) => f.offset) }
}

// Moves the named nodes into new top-level groups ({ group name: node names }), aligned with fit,
// and disposes of everything else. The export keeps Z-Anatomy's parenting between the selected
// objects, so world matrices are read before anything is moved.
export function regroup(doc, groups, fit) {
  const scene = doc.getRoot().listScenes()[0]
  const targets = Object.fromEntries(Object.keys(groups).map((name) => [name, doc.createNode(name)]))
  const groupOf = (name) => Object.keys(groups).find((g) => groups[g].has(name))
  const placed = doc
    .getRoot()
    .listNodes()
    .map((node) => ({ node, matrix: node.getWorldMatrix(), group: groupOf(node.getName()) }))
    .filter(({ group }) => group)
  for (const { node, matrix, group } of placed) {
    node.getParentNode()?.removeChild(node)
    scene.removeChild(node)
    node.setMatrix(matrix)
    targets[group].addChild(node)
  }
  const kept = new Set([...Object.values(targets), ...placed.map((p) => p.node)])
  for (const node of doc.getRoot().listNodes()) if (!kept.has(node)) node.dispose()
  for (const group of Object.values(targets)) {
    group.setScale(fit.scale).setTranslation(fit.offset)
    scene.addChild(group)
  }
  const missing = Object.values(groups)
    .flatMap((names) => [...names])
    .filter((name) => !placed.some(({ node }) => node.getName() === name && node.getMesh()))
  if (missing.length > 0) console.warn(`No mesh in the export for: ${missing.join(', ')}`)
}
