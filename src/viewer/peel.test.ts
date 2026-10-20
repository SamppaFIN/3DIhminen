import { describe, expect, it } from 'vitest'
import { accumulate, peelNext, prunePeeled, restoreAll, restoreNext } from './peel'

const ALL = { superficial: true, deep: true, connective: true }

describe('accumulate', () => {
  it('fills a step from several moves in one direction', () => {
    expect(accumulate(0, -40, 100)).toEqual({ total: -40, full: false })
    expect(accumulate(-40, -70, 100)).toEqual({ total: 0, full: true })
    expect(accumulate(0, -100, 100)).toEqual({ total: 0, full: true })
  })

  it('starts over when the direction changes', () => {
    expect(accumulate(-60, 30, 100)).toEqual({ total: 30, full: false })
  })
})

describe('peelNext and restoreNext', () => {
  it('peels muscles first, then tendons and fascia, and restores innermost first', () => {
    const first = peelNext([], ALL, 0.5)!
    expect(first.layers).toEqual({ ...ALL, superficial: false })
    const second = peelNext(first.stack, first.layers, 0.4)!
    expect(second.layers).toEqual({ ...ALL, superficial: false, deep: false })
    const third = peelNext(second.stack, second.layers, 0.3)!
    expect(third.layers).toEqual({ superficial: false, deep: false, connective: false })
    expect(peelNext(third.stack, third.layers, 0.2)).toBeNull()

    const back = restoreNext(third.stack, third.layers)!
    expect(back.layers).toEqual({ ...ALL, superficial: false, deep: false })
    expect(back.distance).toBe(0.3)
    expect(back.stack.map((entry) => entry.layer)).toEqual(['superficial', 'deep'])
  })

  it('does not peel the same layer twice before it has rendered', () => {
    const first = peelNext([], ALL, 0.5)!
    expect(peelNext(first.stack, ALL, 0.5)).toBeNull()
  })

  it('skips layers shown again by hand', () => {
    const peeledBoth = peelNext(peelNext([], ALL, 0.5)!.stack, { ...ALL, superficial: false }, 0.4)!
    const shownByHand = { ...peeledBoth.layers, deep: true }
    expect(prunePeeled(peeledBoth.stack, shownByHand).map((entry) => entry.layer)).toEqual(['superficial'])
    const back = restoreNext(peeledBoth.stack, shownByHand)!
    expect(back.layers).toEqual(ALL)
    expect(back.distance).toBe(0.5)
    expect(back.stack).toEqual([])
    expect(restoreNext([], ALL)).toBeNull()
  })

  it('restores everything on the stack at once', () => {
    const stack = [
      { layer: 'superficial' as const, distance: 0.5 },
      { layer: 'deep' as const, distance: 0.4 },
    ]
    expect(restoreAll(stack, { superficial: false, deep: false, connective: false })).toEqual({ ...ALL, connective: false })
  })
})
