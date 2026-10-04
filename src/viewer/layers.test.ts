import { BoxGeometry, Group, Mesh, PerspectiveCamera, Raycaster, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { applyLayerVisibility } from './layers'

// A superficial and a deep muscle on the same line of sight, superficial in front.
function createScene() {
  const superficial = new Mesh(new BoxGeometry())
  superficial.userData.name = 'Soleus muscle.r'
  const deep = new Mesh(new BoxGeometry())
  deep.userData.name = 'Tibialis posterior muscle.r'
  deep.position.z = -3
  const root = new Group().add(superficial, deep)
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
    expect(hitNames(root)).toEqual(['Soleus muscle.r', 'Tibialis posterior muscle.r'])

    applyLayerVisibility(root, { superficial: false, deep: true })
    expect(hitNames(root)).toEqual(['Tibialis posterior muscle.r'])

    applyLayerVisibility(root, { superficial: false, deep: false })
    expect(hitNames(root)).toEqual([])
  })

  it('hidden layer is not rendered', () => {
    const { root, superficial, deep } = createScene()
    const camera = new PerspectiveCamera()

    applyLayerVisibility(root, { superficial: true, deep: false })
    expect(superficial.layers.test(camera.layers)).toBe(true)
    expect(deep.layers.test(camera.layers)).toBe(false)
  })

  it('showing a layer again restores it', () => {
    const { root } = createScene()
    applyLayerVisibility(root, { superficial: false, deep: false })
    applyLayerVisibility(root, { superficial: true, deep: true })
    expect(hitNames(root)).toEqual(['Soleus muscle.r', 'Tibialis posterior muscle.r'])
  })
})
