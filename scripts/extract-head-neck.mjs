// Builds public/models/head-neck.glb (muscles of the head and neck, skull) from the glTF that
// scripts/export-head-neck.py exports from Z-Anatomy.
// Usage: node scripts/extract-head-neck.mjs <path/to/head-src.glb>
// (reads <path>.json, written by the export, and the trunk and upper-limb models for alignment)
// Source and licence: public/models/ATTRIBUTION.md

import { readFileSync } from 'node:fs'
import { getBounds } from '@gltf-transform/core'
import { simplify, weld } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import { applyFlatMaterials, readSource, writeCompressed } from './model-utils.mjs'

const OUTPUT = 'public/models/head-neck.glb'

// Epicranial aponeurosis and the digastric's intermediate tendon get the tendon material.
const TENDON_NAME = /aponeurosis|tendon/i

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

const input = process.argv[2]
if (!input) throw new Error('Usage: node scripts/extract-head-neck.mjs <path/to/head-src.glb>')
const exported = JSON.parse(readFileSync(`${input}.json`, 'utf8'))

// Z-Anatomy and Open3D share their origin, but Open3D's bones are shifted and scaled by a few
// millimetres. Fit target = scale * source + offset per axis to the reference bones' bounds.
async function nodeBounds(model, name) {
  const { doc } = await readSource(`public/models/${model}.glb`)
  const node = doc.getRoot().listNodes().find((n) => n.getName() === name)
  if (!node) throw new Error(`${name} not found in ${model}.glb`)
  const { min, max } = getBounds(node)
  return [min, max]
}
const pairs = [[], [], []]
for (const [source, [model, name]] of Object.entries(COUNTERPARTS)) {
  const from = exported.reference[source]
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

const { io, doc } = await readSource(input)
const scene = doc.getRoot().listScenes()[0]
const muscleNames = new Set(exported.muscles)
const boneNames = new Set(exported.bones)
const muscles = doc.createNode('Muscles')
const bones = doc.createNode('Bones')

// The export keeps Z-Anatomy's parenting between the selected objects; flatten it into the two
// groups. World matrices are read before anything is moved.
const placed = doc
  .getRoot()
  .listNodes()
  .map((node) => ({ node, matrix: node.getWorldMatrix(), name: node.getName() }))
  .filter(({ name }) => muscleNames.has(name) || boneNames.has(name))
for (const { node, matrix, name } of placed) {
  node.getParentNode()?.removeChild(node)
  scene.removeChild(node)
  node.setMatrix(matrix)
  ;(muscleNames.has(name) ? muscles : bones).addChild(node)
}
const kept = new Set([muscles, bones, ...placed.map((p) => p.node)])
for (const node of doc.getRoot().listNodes()) if (!kept.has(node)) node.dispose()
for (const group of [muscles, bones]) {
  group.setScale(fit.map((f) => f.scale)).setTranslation(fit.map((f) => f.offset))
  scene.addChild(group)
}

const missing = [...muscleNames, ...boneNames].filter((name) => !doc.getRoot().listNodes().some((n) => n.getName() === name && n.getMesh()))
if (missing.length > 0) console.warn(`No mesh in the export for: ${missing.join(', ')}`)

applyFlatMaterials(doc, TENDON_NAME)
// Z-Anatomy is denser than the Open3D limb models; simplify as for the trunk.
await MeshoptSimplifier.ready
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0, error: 0.001 }))
await writeCompressed(io, doc, OUTPUT)
