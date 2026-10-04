import { BoxGeometry, Group, Mesh, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { nearbyNodes } from './nearby'

// Unit boxes (vertices at ±0.5) centred at x = 0 and x = 3.
function createScene() {
  const near = new Mesh(new BoxGeometry())
  near.userData.name = 'near'
  const far = new Mesh(new BoxGeometry())
  far.userData.name = 'far'
  far.position.x = 3
  const root = new Group().add(near, far)
  root.updateMatrixWorld(true)
  return root
}

describe('nearbyNodes', () => {
  it('finds meshes with a vertex inside the radius', () => {
    expect(nearbyNodes(createScene(), new Vector3(1, 0.5, 0.5), 0.6)).toEqual(['near'])
  })

  it('finds several meshes when the radius reaches them', () => {
    expect(nearbyNodes(createScene(), new Vector3(1.5, 0.5, 0.5), 1.1).sort()).toEqual(['far', 'near'])
  })

  it('finds nothing when no vertex is close enough', () => {
    expect(nearbyNodes(createScene(), new Vector3(1.5, 0.5, 0.5), 0.5)).toEqual([])
  })
})
