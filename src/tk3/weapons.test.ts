import { describe, expect, it } from 'vitest'
import { rng } from './level'
import { PERKS, aimAssist, pickPerks } from './weapons'

describe('aimAssist', () => {
  it('snaps to a target just off the aim line', () => {
    const [x, z] = aimAssist([1, 0], [0, 0], [[5, 0.8]])
    expect(Math.atan2(z, x)).toBeCloseTo(Math.atan2(0.8, 5))
  })

  it('leaves the aim alone when no target is near the line or in range', () => {
    expect(aimAssist([1, 0], [0, 0], [[0, 5]])).toEqual([1, 0])
    expect(aimAssist([1, 0], [0, 0], [[40, 0]])).toEqual([1, 0])
  })

  it('picks the target closest to the aim line', () => {
    const [x, z] = aimAssist([1, 0], [0, 0], [[5, 1.2], [5, -0.3]])
    expect(Math.atan2(z, x)).toBeCloseTo(Math.atan2(-0.3, 5))
  })
})

describe('pickPerks', () => {
  it('offers three different perks', () => {
    const perks = pickPerks({}, rng(7))
    expect(perks).toHaveLength(3)
    expect(new Set(perks.map((p) => p.id)).size).toBe(3)
  })

  it('stops offering a perk taken as often as allowed', () => {
    const taken = Object.fromEntries(PERKS.filter((p) => p.max).map((p) => [p.id, p.max!]))
    for (let seed = 1; seed < 30; seed++) {
      for (const perk of pickPerks(taken, rng(seed))) expect(perk.max).toBeUndefined()
    }
  })
})
