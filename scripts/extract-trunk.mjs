// Builds public/models/trunk.glb (muscles of the thorax, abdomen and back) from the Open3DModel
// "Muscles of thorax, abdomen and back" GLB.
// Usage: node scripts/extract-trunk.mjs <path/to/muscles-thorax-abdomen.glb>
// Source and licence: public/models/ATTRIBUTION.md

import { readFileSync } from 'node:fs'
import { simplify, weld } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import { applyFlatMaterials, readSource, writeCompressed } from './model-utils.mjs'

const OUTPUT = 'public/models/trunk.glb'

const MUSCLE_GROUPS = new Set(['Muscles of thorax', 'Muscles of abdomen', 'Muscles of back'])
// Muscles that already come with the limb models.
const IN_LIMB_MODELS = new Set([
  'Pectoralis major.r',
  'Pectoralis minor.r',
  'Serratus anterior muscle.r',
  'Subclavius muscle.r',
  'Iliacus muscle.r',
  'Psoas major.r',
  'Psoas minor.r',
  'Latissimus dorsi.r',
  'Levator scapulae.r',
  'Rhomboid major muscle.r',
  'Rhomboid minor muscle.r',
  'Trapezius muscle.r',
  // Partly ligament; the other two intertransversarii meshes represent the muscles.
  'Intertransverse lig. / Posterior cervical intertransversarii.r',
])
// Bones of the thorax and the spine above T12. The source's bones cover both sides; the limb
// girdles, the lumbar spine, the sacrum and the hip bones already come with the limb models.
const BONE = /^(Rib \(|Manubrium of sternum|Body of sternum|Atlas|Axis|Cervical vertebrae|Thoracic vertebrae \(T([1-9]|1[01])\))/
// Cartilage that shapes the thoracic cage, kept with the bones.
const CAGE_CARTILAGE = new Set(['Costal cartilage', 'Xiphoid process'])
// Structures from other groups (e.g. fascia) that the data refers to.
const structures = JSON.parse(readFileSync('src/data/structures.json', 'utf8'))
const EXTRA = new Set(structures.flatMap((s) => s.meshes))

// Aponeuroses, the linea alba and fascia get the tendon material.
const TENDON_NAME = /aponeurosis|linea alba|fascia|ligament|lig\./i

const input = process.argv[2]
if (!input) throw new Error('Usage: node scripts/extract-trunk.mjs <path/to/muscles-thorax-abdomen.glb>')

const { io, doc } = await readSource(input)
const scene = doc.getRoot().listScenes()[0]
const sourceGroups = scene.listChildren()
const muscles = doc.createNode('Muscles')
const bones = doc.createNode('Bones')
scene.addChild(muscles).addChild(bones)

for (const group of sourceGroups) {
  const groupName = group.getName()
  for (const node of group.listChildren()) {
    const name = node.getName()
    const target =
      EXTRA.has(name) ||
      (MUSCLE_GROUPS.has(groupName) && !IN_LIMB_MODELS.has(name) && !/overlay/i.test(name))
        ? muscles
        : (groupName === 'Bones' && BONE.test(name)) || CAGE_CARTILAGE.has(name)
          ? bones
          : null
    group.removeChild(node)
    if (target) target.addChild(node)
    else node.dispose()
  }
  group.dispose()
}

applyFlatMaterials(doc, TENDON_NAME)
// The source is about three times as dense as the limb models (the costal cartilage alone has
// ~60k vertices). An error of 0.1 % of each mesh's size is not visible at the app's zoom levels.
await MeshoptSimplifier.ready
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0, error: 0.001 }))
await writeCompressed(io, doc, OUTPUT)
