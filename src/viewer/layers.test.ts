import { BoxGeometry, Group, Mesh, MeshStandardMaterial, PerspectiveCamera, Raycaster, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { muscles } from '../data/muscles'
import { applyLayerVisibility, nextPeel } from './layers'

const ALL = { superficial: true, deep: true, connective: true }

function part(name: string, z: number, material = 'muscle') {
  const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ name: material }))
  mesh.userData.name = name
  mesh.position.z = z
  return mesh
}

function group(name: string, ...parts: Mesh[]) {
  const g = new Group().add(...parts)
  g.userData.name = name
  return g
}

// On one line of sight, nearest first: a superficial muscle, a deep muscle and a tendon in the
// Muscles group, and a fascia sheet in the Fascia group, as in the models.
function createScene() {
  const superficial = part('Soleus muscle.r', 0)
  const deep = part('Tibialis posterior muscle.r', -3)
  const tendon = part('Calcaneal tendon.r', -6, 'tendon')
  const fascia = part('Crural fascia.r', -9, 'muscle')
  const root = new Group().add(group('Muscles', superficial, deep, tendon), group('Fascia', fascia))
  root.updateMatrixWorld(true)
  return { root, superficial, deep }
}

// Names of the objects hit, nearest first (a box can be hit on more than one face).
function hitNames(root: Group): string[] {
  const raycaster = new Raycaster(new Vector3(0, 0, 5), new Vector3(0, 0, -1))
  return [...new Set(raycaster.intersectObject(root, true).map((hit) => hit.object.userData.name))]
}

describe('applyLayerVisibility', () => {
  it('hidden layer does not receive pointer hits', () => {
    const { root } = createScene()
    expect(hitNames(root)).toEqual(['Soleus muscle.r', 'Tibialis posterior muscle.r', 'Calcaneal tendon.r', 'Crural fascia.r'])

    applyLayerVisibility(root, { ...ALL, superficial: false })
    expect(hitNames(root)).toEqual(['Tibialis posterior muscle.r', 'Calcaneal tendon.r', 'Crural fascia.r'])

    applyLayerVisibility(root, { ...ALL, superficial: false, deep: false })
    expect(hitNames(root)).toEqual(['Calcaneal tendon.r', 'Crural fascia.r'])

    applyLayerVisibility(root, { superficial: false, deep: false, connective: false })
    expect(hitNames(root)).toEqual([])
  })

  it('tendons by material and fascia by group are the connective layer', () => {
    const { root } = createScene()
    applyLayerVisibility(root, { ...ALL, connective: false })
    expect(hitNames(root)).toEqual(['Soleus muscle.r', 'Tibialis posterior muscle.r'])
  })

  it("a muscle's own tendon follows the muscle's layer, not the connective layer", () => {
    const biceps = muscles.find((m) => m.id === 'biceps_femoris')!
    const tendon = part('Common tendon of biceps femoris.r', 0, 'tendon')
    expect(biceps.meshes).toContain(tendon.userData.name)
    const root = new Group().add(group('Muscles', tendon))
    root.updateMatrixWorld(true)
    applyLayerVisibility(root, { ...ALL, connective: false })
    expect(hitNames(root)).toEqual([tendon.userData.name])
    applyLayerVisibility(root, { ...ALL, [biceps.layer]: false })
    expect(hitNames(root)).toEqual([])
  })

  it('a muscle without data counts as superficial', () => {
    const platysma = part('Platysma.r', 0)
    const root = new Group().add(group('Muscles', platysma))
    root.updateMatrixWorld(true)
    applyLayerVisibility(root, { ...ALL, superficial: false })
    expect(hitNames(root)).toEqual([])
    applyLayerVisibility(root, ALL)
    expect(hitNames(root)).toEqual(['Platysma.r'])
  })

  it('hidden layer is not rendered', () => {
    const { root, superficial, deep } = createScene()
    const camera = new PerspectiveCamera()

    applyLayerVisibility(root, { ...ALL, deep: false })
    expect(superficial.layers.test(camera.layers)).toBe(true)
    expect(deep.layers.test(camera.layers)).toBe(false)
  })

  it('showing a layer again restores it', () => {
    const { root } = createScene()
    applyLayerVisibility(root, { superficial: false, deep: false, connective: false })
    applyLayerVisibility(root, ALL)
    expect(hitNames(root)).toEqual(['Soleus muscle.r', 'Tibialis posterior muscle.r', 'Calcaneal tendon.r', 'Crural fascia.r'])
  })
})

describe('nextPeel', () => {
  it('peels the outermost layer shown: muscles first, then tendons and fascia', () => {
    expect(nextPeel(ALL)).toBe('superficial')
    expect(nextPeel({ ...ALL, superficial: false })).toBe('deep')
    expect(nextPeel({ ...ALL, superficial: false, deep: false })).toBe('connective')
    expect(nextPeel({ superficial: false, deep: false, connective: false })).toBeNull()
  })

  it('skips layers hidden by hand', () => {
    expect(nextPeel({ ...ALL, deep: false })).toBe('superficial')
    expect(nextPeel({ superficial: false, deep: true, connective: false })).toBe('deep')
  })
})
