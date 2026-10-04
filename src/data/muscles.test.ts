import { describe, expect, it } from 'vitest'
import { searchMuscles } from './muscles'

const ids = (query: string) => searchMuscles(query).map((m) => m.id)

describe('searchMuscles', () => {
  it('returns nothing for an empty query', () => {
    expect(ids('')).toEqual([])
    expect(ids('   ')).toEqual([])
  })

  it('finds Finnish names by any part of the name', () => {
    // "leveä kantalihas" matches at 6, "kaksoiskantalihas" at 7.
    expect(ids('kanta')).toEqual(['soleus', 'gastrocnemius'])
  })

  it('finds Latin names regardless of case', () => {
    expect(ids('SOLEUS')).toEqual(['soleus'])
  })

  it('ranks earlier matches first, then alphabetically', () => {
    expect(ids('pohjeluu')).toEqual(['fibularis_brevis', 'fibularis_longus', 'fibularis_tertius'])
    expect(ids('flexor  hallucis')).toEqual(['flexor_hallucis_brevis', 'flexor_hallucis_longus'])
  })
})
