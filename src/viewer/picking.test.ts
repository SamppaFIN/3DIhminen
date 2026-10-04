import { BoxGeometry, Group, Mesh, PerspectiveCamera } from 'three'
import { describe, expect, it } from 'vitest'
import { pickSurface } from './picking'

// A unit box straight ahead of the camera. On a 400 × 400 px canvas its front face
// spans about 48 px either side of the centre (200, 200).
function setup() {
  const camera = new PerspectiveCamera(50, 1, 0.1, 100)
  camera.position.set(0, 0, 5)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  const box = new Mesh(new BoxGeometry())
  const root = new Group().add(box)
  root.updateMatrixWorld(true)
  return { camera, root, box, size: { width: 400, height: 400 } }
}

describe('pickSurface', () => {
  it('hits the surface under the pointer', () => {
    const { camera, root, box, size } = setup()
    expect(pickSurface(camera, root, { x: 200, y: 200 }, size)?.object).toBe(box)
  })

  it('snaps a near miss to the nearest surface', () => {
    const { camera, root, box, size } = setup()
    expect(pickSurface(camera, root, { x: 258, y: 200 }, size)?.object).toBe(box)
  })

  it('returns nothing when the pointer is far from any surface', () => {
    const { camera, root, size } = setup()
    expect(pickSurface(camera, root, { x: 270, y: 200 }, size)).toBeUndefined()
  })
})
