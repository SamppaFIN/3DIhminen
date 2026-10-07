import { describe, expect, it } from 'vitest'
import { EMPTY, UNREACHED, WALL, collideCircle, flowDirection, flowField, generateLevel, lineOfSight, tileAt } from './level'

describe('generateLevel', () => {
  const level = generateLevel(34, 42)

  it('is the same for the same seed', () => {
    expect(generateLevel(34, 42).tiles).toEqual(level.tiles)
  })

  it('is walled in and leaves the start open', () => {
    for (let i = 0; i < 34; i++) {
      expect(tileAt(level, i + 0.5, 0.5)).toBe(WALL)
      expect(tileAt(level, 0.5, i + 0.5)).toBe(WALL)
    }
    for (let z = 14; z < 20; z++) for (let x = 14; x < 20; x++) expect(tileAt(level, x + 0.5, z + 0.5)).toBe(EMPTY)
  })

  it('has no open tile the player could never reach', () => {
    for (const seed of [1, 2, 3, 99, 1234]) {
      const l = generateLevel(34, seed)
      const distance = flowField(l, 17.5, 17.5, true)
      l.tiles.forEach((tile, i) => {
        if (tile === EMPTY) expect(distance[i]).not.toBe(UNREACHED)
      })
    }
  })
})

describe('flow field', () => {
  // An empty 10 × 10 room with a wall down the middle and a gap at the bottom.
  const size = 10
  const tiles = new Uint8Array(size * size)
  for (let i = 0; i < size; i++) {
    tiles[i] = tiles[(size - 1) * size + i] = tiles[i * size] = tiles[i * size + size - 1] = WALL
  }
  for (let z = 1; z < 7; z++) tiles[z * size + 5] = WALL
  const room = { size, tiles, hp: new Float32Array(size * size) }

  it('leads around the wall', () => {
    const distance = flowField(room, 7.5, 2.5)
    // Straight across would be 5 steps; around the wall's end it is longer.
    expect(distance[2 * size + 2]).toBeGreaterThan(5)
    const [dx, dz] = flowDirection(room, distance, 2.5, 2.5)!
    expect(dz).toBeGreaterThan(0) // Heads down towards the gap first.
    expect(Math.hypot(dx, dz)).toBeCloseTo(1)
  })

  it('sees through open floor but not through walls', () => {
    expect(lineOfSight(room, 2.5, 8.5, 7.5, 8.5)).toBe(true)
    expect(lineOfSight(room, 2.5, 2.5, 7.5, 2.5)).toBe(false)
  })

  it('pushes a circle out of a wall', () => {
    const [x, z] = collideCircle(room, 4.8, 3.5, 0.3)
    expect(x).toBeCloseTo(4.7)
    expect(z).toBeCloseTo(3.5)
  })
})
