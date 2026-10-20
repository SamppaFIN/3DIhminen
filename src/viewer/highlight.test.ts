import { BoxGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import { highlightNodes } from './highlight'

function node(name: string, material: MeshStandardMaterial) {
  const mesh = new Mesh(new BoxGeometry(), material)
  mesh.userData.name = name
  return mesh
}

// Mirrors the model: muscles and tendons under "Muscles", bones under "Bones", see-through fascia
// sheets under "Fascia".
function createScene() {
  const muscle = new MeshStandardMaterial({ name: 'muscle' })
  const tendon = new MeshStandardMaterial({ name: 'tendon' })
  const bone = new MeshStandardMaterial({ name: 'bone' })
  const fascia = new MeshStandardMaterial({ name: 'fascia', transparent: true, opacity: 0.5, depthWrite: false })
  const soleus = node('Soleus muscle.r', muscle)
  const plantaris = node('Plantaris muscle.r', muscle)
  const aponeurosis = node('Plantar aponeurosis.r', tendon)
  const tibia = node('Tibia.r', bone)
  const cruralFascia = node('Crural fascia.r', fascia)
  const muscles = new Group().add(soleus, plantaris, aponeurosis)
  muscles.userData.name = 'Muscles'
  const bones = new Group().add(tibia)
  bones.userData.name = 'Bones'
  const fasciae = new Group().add(cruralFascia)
  fasciae.userData.name = 'Fascia'
  return { root: new Group().add(muscles, bones, fasciae), muscle, tendon, bone, fascia, soleus, plantaris, aponeurosis, tibia, cruralFascia }
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

  it('emphasises a muscle on both sides only on the given side', () => {
    const { root, muscle, soleus } = createScene()
    const left = soleus.clone()
    soleus.userData.side = 'right'
    left.userData.side = 'left'
    root.children[0].add(left)
    highlightNodes(root, keep('Soleus muscle.r'), 'left')
    expect(left.material).toBe(muscle)
    expect((soleus.material as MeshStandardMaterial).transparent).toBe(true)
  })

  it('draws an emphasised see-through fascia solid and dims the other fascia', () => {
    const { root, fascia, cruralFascia } = createScene()
    highlightNodes(root, keep('Crural fascia.r'))
    const solid = cruralFascia.material as MeshStandardMaterial
    expect(solid).not.toBe(fascia)
    expect(solid.transparent).toBe(false)
    expect(solid.opacity).toBe(1)
    expect(solid.color.equals(fascia.color)).toBe(true)

    highlightNodes(root, keep('Soleus muscle.r'))
    const dim = cruralFascia.material as MeshStandardMaterial
    expect(dim.transparent).toBe(true)
    expect(dim.opacity).toBeLessThan(fascia.opacity)
  })

  it('restores the original materials', () => {
    const { root, muscle, tendon, fascia, soleus, plantaris, aponeurosis, cruralFascia } = createScene()
    highlightNodes(root, new Map([['Soleus muscle.r', '#f29000']]))
    highlightNodes(root, null)
    expect(soleus.material).toBe(muscle)
    expect(plantaris.material).toBe(muscle)
    expect(aponeurosis.material).toBe(tendon)
    expect(cruralFascia.material).toBe(fascia)
  })
})
