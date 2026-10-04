import { BoxGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import { highlightNodes } from './highlight'

function node(name: string, material: MeshStandardMaterial) {
  const mesh = new Mesh(new BoxGeometry(), material)
  mesh.userData.name = name
  return mesh
}

// Mirrors the model: muscles and tendons under "Muscles", bones under "Bones".
function createScene() {
  const muscle = new MeshStandardMaterial({ name: 'muscle' })
  const tendon = new MeshStandardMaterial({ name: 'tendon' })
  const bone = new MeshStandardMaterial({ name: 'bone' })
  const soleus = node('Soleus muscle.r', muscle)
  const plantaris = node('Plantaris muscle.r', muscle)
  const aponeurosis = node('Plantar aponeurosis.r', tendon)
  const tibia = node('Tibia.r', bone)
  const muscles = new Group().add(soleus, plantaris, aponeurosis)
  muscles.userData.name = 'Muscles'
  const bones = new Group().add(tibia)
  bones.userData.name = 'Bones'
  return { root: new Group().add(muscles, bones), muscle, tendon, bone, soleus, plantaris, aponeurosis, tibia }
}

const keep = (...names: string[]) => new Map(names.map((name) => [name, null]))

describe('highlightNodes', () => {
  it('keeps the highlighted muscle and dims other muscles', () => {
    const { root, muscle, soleus, plantaris } = createScene()
    highlightNodes(root, keep('Soleus muscle.r'))
    expect(soleus.material).toBe(muscle)
    const dim = plantaris.material as MeshStandardMaterial
    expect(dim).not.toBe(muscle)
    expect(dim.transparent).toBe(true)
    expect(dim.color.equals(muscle.color)).toBe(false)
  })

  it('recolours nodes given a colour', () => {
    const { root, soleus } = createScene()
    highlightNodes(root, new Map([['Soleus muscle.r', '#f29000']]))
    const material = soleus.material as MeshStandardMaterial
    expect(material.color.equals(new Color('#f29000'))).toBe(true)
    expect(material.transparent).toBe(false)
  })

  it('makes tendons see-through without changing their colour, and leaves bones alone', () => {
    const { root, tendon, bone, aponeurosis, tibia } = createScene()
    highlightNodes(root, keep('Soleus muscle.r'))
    const dim = aponeurosis.material as MeshStandardMaterial
    expect(dim.transparent).toBe(true)
    expect(dim.color.equals(tendon.color)).toBe(true)
    expect(tibia.material).toBe(bone)
  })

  it('restores the original materials', () => {
    const { root, muscle, tendon, soleus, plantaris, aponeurosis } = createScene()
    highlightNodes(root, new Map([['Soleus muscle.r', '#f29000']]))
    highlightNodes(root, null)
    expect(soleus.material).toBe(muscle)
    expect(plantaris.material).toBe(muscle)
    expect(aponeurosis.material).toBe(tendon)
  })
})
