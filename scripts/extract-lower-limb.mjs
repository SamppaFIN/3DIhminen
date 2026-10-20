// Builds public/models/lower-limb.glb from the Open3DModel lower limb GLB:
// its muscles, bones and fascia (the app's tendon-and-fascia layer).
// Usage: node scripts/extract-lower-limb.mjs <path/to/lower-limb.glb>
// Source and licence: public/models/ATTRIBUTION.md

import { readFileSync } from 'node:fs'
import { applyFlatMaterials, readSource, writeCompressed } from './model-utils.mjs'

const OUTPUT = 'public/models/lower-limb.glb'

// All muscles, bones and fascia of the source. Muscle data (src/data/muscles.json) may lag behind:
// tests check that every mesh named in the data exists here, not the other way round.
const KEEP_GROUPS = new Set(['Muscles', 'Bones', 'Fascia'])
const SKIP = new Set(['Infrapatellar fat pad.r', 'Synovial sheaths of toes.r'])
// Structures from dropped groups that the data refers to; those in kept groups stay where they
// are (e.g. the iliotibial tract under Fascia).
const structures = JSON.parse(readFileSync('src/data/structures.json', 'utf8'))
const EXTRA = new Set(structures.flatMap((s) => s.meshes))

// Tendons, aponeuroses, ligaments and tracts get the tendon material; muscles the muscle material.
const TENDON_NAME = /tendon|aponeurosis|ligament|tract/i

const input = process.argv[2]
if (!input) throw new Error('Usage: node scripts/extract-lower-limb.mjs <path/to/lower-limb.glb>')

const { io, doc } = await readSource(input)
const root = doc.getRoot()

// The source groups its nodes (Muscles, Bones, Fascia, ...) under the scene root.
// Structures from dropped groups move to the Muscles group, which the app dims and highlights.
const groups = root.listScenes()[0].listChildren()
const muscles = groups.find((group) => group.getName() === 'Muscles')
for (const group of groups) {
  const kept = KEEP_GROUPS.has(group.getName())
  for (const node of group.listChildren()) {
    const name = node.getName()
    if (EXTRA.has(name) && !kept) {
      group.removeChild(node)
      muscles.addChild(node)
    } else if (!kept || SKIP.has(name)) {
      node.dispose()
    }
  }
}
for (const group of groups) if (group.listChildren().length === 0) group.dispose()
// structures.json covers every model, so not all of its meshes are in this source;
// the data tests check that each one exists in some model.

applyFlatMaterials(doc, TENDON_NAME)
await writeCompressed(io, doc, OUTPUT)
