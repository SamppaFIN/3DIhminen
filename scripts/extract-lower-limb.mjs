// Builds public/models/lower-limb.glb from the Open3DModel lower limb GLB.
// Usage: node scripts/extract-lower-limb.mjs <path/to/lower-limb.glb>
// Source and licence: public/models/ATTRIBUTION.md

import { readFileSync } from 'node:fs'
import { applyFlatMaterials, readSource, writeCompressed } from './model-utils.mjs'

const OUTPUT = 'public/models/lower-limb.glb'

// All muscles and bones of the source. Muscle data (src/data/muscles.json) may lag behind:
// tests check that every mesh named in the data exists here, not the other way round.
const KEEP_GROUPS = new Set(['Muscles', 'Bones'])
const SKIP = new Set(['Infrapatellar fat pad.r', 'Synovial sheaths of toes.r'])
// Structures from other groups (e.g. the iliotibial tract under Fascia) that the data refers to.
const structures = JSON.parse(readFileSync('src/data/structures.json', 'utf8'))
const EXTRA = new Set(structures.flatMap((s) => s.meshes))

// Tendons, aponeuroses, ligaments and tracts get the tendon material; muscles the muscle material.
const TENDON_NAME = /tendon|aponeurosis|ligament|tract/i

const input = process.argv[2]
if (!input) throw new Error('Usage: node scripts/extract-lower-limb.mjs <path/to/lower-limb.glb>')

const { io, doc } = await readSource(input)
const root = doc.getRoot()

// The source groups its nodes (Muscles, Bones, Fascia, ...) under the scene root.
// Structures from other groups move to the Muscles group, which the app dims and highlights.
const groups = root.listScenes()[0].listChildren()
const muscles = groups.find((group) => group.getName() === 'Muscles')
for (const group of groups) {
  for (const node of group.listChildren()) {
    const name = node.getName()
    if (EXTRA.has(name)) {
      if (group !== muscles) {
        group.removeChild(node)
        muscles.addChild(node)
      }
    } else if (!KEEP_GROUPS.has(group.getName()) || SKIP.has(name)) {
      node.dispose()
    }
  }
}
for (const group of groups) if (group.listChildren().length === 0) group.dispose()
// structures.json covers every model, so not all of its meshes are in this source;
// the data tests check that each one exists in some model.

applyFlatMaterials(doc, TENDON_NAME)
await writeCompressed(io, doc, OUTPUT)
