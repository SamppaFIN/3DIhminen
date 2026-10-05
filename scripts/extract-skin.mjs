// Builds public/models/skin.glb (the body surface for the whole-body figure) from the glTF that
// scripts/export-skin.py exports from Z-Anatomy. Each skin region keeps the body area and side the
// export stored in its extras (userData.area and userData.side in three.js).
// Usage: node scripts/extract-skin.mjs <path/to/skin-src.glb>
// (reads <path>.json, written by the export, and the trunk and upper-limb models for alignment)
// Source and licence: public/models/ATTRIBUTION.md

import { readFileSync } from 'node:fs'
import { simplify, weld } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import { readSource, writeCompressed } from './model-utils.mjs'
import { fitToOpen3D, regroup } from './z-anatomy.mjs'

const OUTPUT = 'public/models/skin.glb'

const input = process.argv[2]
if (!input) throw new Error('Usage: node scripts/extract-skin.mjs <path/to/skin-src.glb>')
const exported = JSON.parse(readFileSync(`${input}.json`, 'utf8'))
const fit = await fitToOpen3D(exported.reference)

const { io, doc } = await readSource(input)
const eyes = new Set(exported.eyes)
const skin = new Set(Object.keys(exported.parts).filter((name) => !eyes.has(name)))
regroup(doc, { Skin: skin, Eyes: eyes }, fit)

// Keep only the area and side of Blender's custom properties.
for (const node of doc.getRoot().listNodes()) {
  const { area, side } = node.getExtras()
  node.setExtras(area ? { area, side } : {})
}
// The figure sets its own materials (Mannequin.tsx).
for (const material of doc.getRoot().listMaterials()) material.dispose()
await MeshoptSimplifier.ready
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0, error: 0.001 }))
await writeCompressed(io, doc, OUTPUT)
