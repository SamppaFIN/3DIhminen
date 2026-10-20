import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { connectiveInFront, isHalo, setConnectiveGlow } from './glow'
import { highlightNodes } from './highlight'

function part(name: string, material: string, z = 0) {
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

// A muscle and a tendon in the Muscles group and a fascia sheet in the Fascia group, as in the models.
function createScene() {
  const soleus = part('Soleus muscle.r', 'muscle')
  const tendon = part('Calcaneal tendon.r', 'tendon', -3)
  const fascia = part('Crural fascia.r', 'fascia', -6)
  const root = new Group().add(group('Muscles', soleus, tendon), group('Fascia', fascia))
  root.updateMatrixWorld(true)
  return { root, soleus, tendon, fascia }
}

const halos = (mesh: Mesh) => mesh.children.filter((child): child is Mesh => isHalo(child))

describe('connectiveInFront', () => {
  it('is true only when the muscles are hidden and the tendons and fascia shown', () => {
    expect(connectiveInFront({ superficial: false, deep: false, connective: true })).toBe(true)
    expect(connectiveInFront({ superficial: false, deep: true, connective: true })).toBe(false)
    expect(connectiveInFront({ superficial: true, deep: true, connective: true })).toBe(false)
    expect(connectiveInFront({ superficial: false, deep: false, connective: false })).toBe(false)
  })
})

describe('setConnectiveGlow', () => {
  it('gives the tendons and fascia a halo, and the muscles none', () => {
    const { root, soleus, tendon, fascia } = createScene()
    setConnectiveGlow(root, true)
    expect(halos(soleus)).toHaveLength(0)
    expect(halos(tendon)).toHaveLength(1)
    expect(halos(fascia)).toHaveLength(1)
    expect(halos(tendon)[0].visible).toBe(true)
  })

  it('hides the halos again and reuses them', () => {
    const { root, tendon } = createScene()
    setConnectiveGlow(root, true)
    const halo = halos(tendon)[0]
    setConnectiveGlow(root, false)
    expect(halo.visible).toBe(false)
    setConnectiveGlow(root, true)
    expect(halos(tendon)).toEqual([halo])
    expect(halo.visible).toBe(true)
  })

  it('is never hit by a ray, so picking goes to the structure itself', () => {
    const { root } = createScene()
    setConnectiveGlow(root, true)
    const hits = new Raycaster(new Vector3(0, 0, 5), new Vector3(0, 0, -1)).intersectObject(root, true)
    expect(hits.every((hit) => !isHalo(hit.object))).toBe(true)
    expect(hits.length).toBeGreaterThan(0)
  })

  it('keeps its material when the model is highlighted', () => {
    const { root, tendon } = createScene()
    setConnectiveGlow(root, true)
    const halo = halos(tendon)[0]
    const haloMaterial = halo.material
    highlightNodes(root, new Map([['Soleus muscle.r', null]]))
    expect(halo.material).toBe(haloMaterial)
    highlightNodes(root, null)
    expect(halo.material).toBe(haloMaterial)
  })
})
