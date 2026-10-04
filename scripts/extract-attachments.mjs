// Builds public/models/attachments.glb from the Open3DModel muscle attachments GLB.
// Usage: node scripts/extract-attachments.mjs <path/to/insertions-and-origins.glb>
// Source and licence: public/models/ATTRIBUTION.md

import { readFileSync } from 'node:fs'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { clearNodeParent, dedup, meshopt, prune } from '@gltf-transform/functions'
import draco3d from 'draco3dgltf'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'

const OUTPUT = 'public/models/attachments.glb'

const muscles = JSON.parse(readFileSync('src/data/muscles.json', 'utf8'))
const keep = new Set(muscles.flatMap((m) => m.attachmentMeshes ?? []))

const input = process.argv[2]
if (!input) throw new Error('Usage: node scripts/extract-attachments.mjs <path/to/insertions-and-origins.glb>')

await MeshoptEncoder.ready
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'meshopt.encoder': MeshoptEncoder,
  'meshopt.decoder': MeshoptDecoder,
})

const doc = await io.read(input)
const root = doc.getRoot()

// Keep only the allowlisted patches, wherever they sit in the hierarchy.
const found = new Set()
for (const node of root.listNodes()) {
  if (keep.has(node.getName())) found.add(node.getName())
}
const missing = [...keep].filter((name) => !found.has(name))
if (missing.length > 0) throw new Error(`Nodes not found in source: ${missing.join(', ')}`)

// Move the patches to the scene root (keeping their world transforms), then drop every other node.
const scene = root.listScenes()[0]
for (const node of root.listNodes()) {
  if (!keep.has(node.getName())) continue
  if (node.getParentNode()) clearNodeParent(node)
  if (!scene.listChildren().includes(node)) scene.addChild(node)
}
for (const node of root.listNodes()) {
  if (!keep.has(node.getName())) node.dispose()
}

// One plain material: the patches are coloured by their COLOR_0 vertex colours
// (red = origin, blue = insertion). Textures and texture coordinates are dropped.
const material = doc.createMaterial('attachment').setMetallicFactor(0).setRoughnessFactor(1)
for (const node of scene.listChildren()) {
  for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
    primitive.setMaterial(material)
    primitive.setAttribute('TEXCOORD_0', null)
  }
}
for (const texture of root.listTextures()) texture.dispose()
for (const other of root.listMaterials()) if (other !== material) other.dispose()
for (const extension of root.listExtensionsUsed()) extension.dispose()

await doc.transform(prune({ keepAttributes: true }), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
await io.write(OUTPUT, doc)

console.log(`Wrote ${OUTPUT}: ${found.size} attachment patches`)
