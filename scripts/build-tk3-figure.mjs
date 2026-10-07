// Builds public/models/tk3-figure.glb, the low-poly fighter of the Tapan Kaikki 3 game (src/tk3),
// from public/models/skin.glb. The skin regions are merged into eleven rigid body parts (head,
// torso and two segments per limb) so the game can swing the limbs around their joints, and each
// part is simplified to a few hundred triangles so dozens of fighters stay cheap on a phone.
// Usage: node scripts/build-tk3-figure.mjs
// Source and licence: public/models/ATTRIBUTION.md

import { simplify, weld } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import { readSource, writeCompressed } from './model-utils.mjs'

const INPUT = 'public/models/skin.glb'
const OUTPUT = 'public/models/tk3-figure.glb'

// Rig part of each body area; limbs get the side as a suffix.
const PARTS = {
  head: 'head', neck: 'head',
  trunk: 'torso', abdomen: 'torso', back: 'torso', pelvis: 'torso', shoulder: 'torso',
  upper_arm: 'upperArm', elbow: 'upperArm',
  forearm: 'foreArm', wrist: 'foreArm', hand: 'foreArm',
  thigh: 'thigh', knee: 'thigh',
  leg: 'shin', foot: 'shin',
}
const CENTRAL = new Set(['head', 'torso'])

const { io, doc } = await readSource(INPUT)
const root = doc.getRoot()
const buffer = root.listBuffers()[0]
const merged = new Map()

for (const node of root.listNodes()) {
  const { area, side } = node.getExtras()
  const mesh = node.getMesh()
  if (!area || !mesh) continue
  const part = CENTRAL.has(PARTS[area]) ? PARTS[area] : `${PARTS[area]}_${side === 'left' ? 'l' : 'r'}`
  const world = node.getWorldMatrix()
  const entry = merged.get(part) ?? { positions: [], indices: [] }
  merged.set(part, entry)
  for (const primitive of mesh.listPrimitives()) {
    const position = primitive.getAttribute('POSITION')
    const base = entry.positions.length / 3
    const v = [0, 0, 0]
    for (let i = 0; i < position.getCount(); i++) {
      position.getElement(i, v)
      const [x, y, z] = v
      entry.positions.push(
        world[0] * x + world[4] * y + world[8] * z + world[12],
        world[1] * x + world[5] * y + world[9] * z + world[13],
        world[2] * x + world[6] * y + world[10] * z + world[14],
      )
    }
    const index = primitive.getIndices()
    for (let i = 0; i < index.getCount(); i++) entry.indices.push(base + index.getScalar(i))
  }
}

for (const node of root.listNodes()) node.dispose()
for (const mesh of root.listMeshes()) mesh.dispose()
const scene = root.listScenes()[0]
const group = doc.createNode('Figure')
scene.addChild(group)

for (const [part, { positions, indices }] of merged) {
  const primitive = doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(positions)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(indices)).setBuffer(buffer))
  group.addChild(doc.createNode(part).setMesh(doc.createMesh(part).addPrimitive(primitive)))
}

await MeshoptSimplifier.ready
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.05, error: 0.05 }))
for (const mesh of root.listMeshes()) {
  const count = mesh.listPrimitives()[0].getIndices().getCount() / 3
  console.log(`${mesh.getName()}: ${count} triangles`)
}
await writeCompressed(io, doc, OUTPUT)
