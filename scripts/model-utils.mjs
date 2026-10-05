// Shared steps of the extract-*.mjs scripts: read an Open3D GLB, give it flat materials,
// and write it meshopt-compressed.

import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, meshopt, prune } from '@gltf-transform/functions'
import draco3d from 'draco3dgltf'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'

export async function readSource(path) {
  await MeshoptEncoder.ready
  await MeshoptDecoder.ready
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptDecoder,
  })
  return { io, doc: await io.read(path) }
}

// The source textures are CC BY-NC-SA, so all textures are dropped and replaced with flat materials.
// Colours are linear RGB of the design-brief tokens --muscle and --tendon; bone is a neutral ivory.
// Nodes in the "Bones" group get the bone material, nodes whose names match tendonName the tendon
// material, and everything else the muscle material.
export function applyFlatMaterials(doc, tendonName) {
  const root = doc.getRoot()
  const flat = (name, rgb) =>
    doc.createMaterial(name).setBaseColorFactor([...rgb, 1]).setMetallicFactor(0).setRoughnessFactor(0.7)
  const materials = {
    muscle: flat('muscle', [0.5215, 0.0859, 0.0877]),
    tendon: flat('tendon', [0.7969, 0.6698, 0.4489]),
    bone: flat('bone', [0.8281, 0.7747, 0.6721]),
  }
  for (const group of root.listScenes()[0].listChildren()) {
    for (const node of group.listChildren()) {
      const material =
        group.getName() === 'Bones' ? materials.bone : tendonName.test(node.getName()) ? materials.tendon : materials.muscle
      for (const primitive of node.getMesh()?.listPrimitives() ?? []) primitive.setMaterial(material)
    }
  }
  for (const texture of root.listTextures()) texture.dispose()
  for (const material of root.listMaterials()) {
    if (!Object.values(materials).includes(material)) material.dispose()
  }
  for (const extension of root.listExtensionsUsed()) extension.dispose()
}

export async function writeCompressed(io, doc, output) {
  await doc.transform(prune(), dedup(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
  await io.write(output, doc)
  const groups = doc.getRoot().listScenes()[0].listChildren()
  console.log(`Wrote ${output}: ${groups.map((g) => `${g.getName()} ${g.listChildren().length}`).join(', ')}`)
}
