// Builds public/models/head-neck.glb (muscles of the head and neck, skull) from the glTF that
// scripts/export-head-neck.py exports from Z-Anatomy.
// Usage: node scripts/extract-head-neck.mjs <path/to/head-src.glb>
// (reads <path>.json, written by the export, and the trunk and upper-limb models for alignment)
// Source and licence: public/models/ATTRIBUTION.md

import { readFileSync } from 'node:fs'
import { simplify, weld } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import { applyFlatMaterials, readSource, writeCompressed } from './model-utils.mjs'
import { fitToOpen3D, regroup } from './z-anatomy.mjs'

const OUTPUT = 'public/models/head-neck.glb'

// Epicranial aponeurosis and the digastric's intermediate tendon get the tendon material.
const TENDON_NAME = /aponeurosis|tendon/i

const input = process.argv[2]
if (!input) throw new Error('Usage: node scripts/extract-head-neck.mjs <path/to/head-src.glb>')
const exported = JSON.parse(readFileSync(`${input}.json`, 'utf8'))
const fit = await fitToOpen3D(exported.reference)

const { io, doc } = await readSource(input)
regroup(doc, { Muscles: new Set(exported.muscles), Bones: new Set(exported.bones) }, fit)

applyFlatMaterials(doc, TENDON_NAME)
// Z-Anatomy is denser than the Open3D limb models; simplify as for the trunk.
await MeshoptSimplifier.ready
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0, error: 0.001 }))
await writeCompressed(io, doc, OUTPUT)
