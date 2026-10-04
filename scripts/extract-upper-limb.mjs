// Builds public/models/upper-limb.glb (arm and hand) from the Open3DModel upper limb GLB.
// Usage: node scripts/extract-upper-limb.mjs <path/to/upper-limb.glb>
// Source and licence: public/models/ATTRIBUTION.md

import { readFileSync } from 'node:fs'
import { applyFlatMaterials, readSource, writeCompressed } from './model-utils.mjs'

const OUTPUT = 'public/models/upper-limb.glb'

// The source groups nodes by region and type ("Arm - muscles", "Forearm - bones", ...).
// The limb's muscle and bone groups are merged into "Muscles" and "Bones", the names the app uses.
// The trunk's bones are left out: the lower-limb model already has the lumbar spine and sacrum,
// and the rest of the trunk comes with phase C.
const REGIONS = ['Pectoral girdle', 'Arm', 'Forearm', 'Hand and wrist']
const MUSCLE_GROUPS = new Set(REGIONS.map((r) => `${r} - muscles`))
const BONE_GROUPS = new Set(REGIONS.map((r) => `${r} - bones`))
// Overlay copies of muscle parts (about 1 mm off the parent muscle) and synovial sheaths.
const SKIP_MATERIALS = new Set(['Overlays.001', 'sheathmat'])
// Structures from other groups (e.g. retinacula) that the data refers to.
const structures = JSON.parse(readFileSync('src/data/structures.json', 'utf8'))
const EXTRA = new Set(structures.flatMap((s) => s.meshes))

// Tendons, aponeuroses, extensor hoods, ligaments and retinacula get the tendon material.
const TENDON_NAME = /tendon|aponeurosis|ligament|lig\.|hood|retinacul/i

const input = process.argv[2]
if (!input) throw new Error('Usage: node scripts/extract-upper-limb.mjs <path/to/upper-limb.glb>')

const { io, doc } = await readSource(input)
const scene = doc.getRoot().listScenes()[0]
const sourceGroups = scene.listChildren()
const muscles = doc.createNode('Muscles')
const bones = doc.createNode('Bones')
scene.addChild(muscles).addChild(bones)

const skipped = (node) =>
  node.getMesh()?.listPrimitives().some((p) => SKIP_MATERIALS.has(p.getMaterial()?.getName() ?? '')) ?? false

for (const group of sourceGroups) {
  const name = group.getName()
  for (const node of group.listChildren()) {
    const target = EXTRA.has(node.getName())
      ? muscles
      : MUSCLE_GROUPS.has(name) && !skipped(node)
        ? muscles
        : BONE_GROUPS.has(name)
          ? bones
          : null
    group.removeChild(node)
    if (target) target.addChild(node)
    else node.dispose()
  }
  group.dispose()
}
// structures.json covers every model, so not all of its meshes are in this source;
// the data tests check that each one exists in some model.

applyFlatMaterials(doc, TENDON_NAME)
await writeCompressed(io, doc, OUTPUT)
