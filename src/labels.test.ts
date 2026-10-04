import { describe, expect, it } from 'vitest'
import connectionSchema from './data/schema/connection.schema.json'
import { CONNECTION_TYPE_LABELS, EVIDENCE_LABELS } from './labels'

describe('labels', () => {
  it('has a label for every evidence level in the schema', () => {
    expect(Object.keys(EVIDENCE_LABELS).sort()).toEqual([...connectionSchema.items.properties.evidence.enum].sort())
  })

  it('has a label for every connection type in the schema', () => {
    expect(Object.keys(CONNECTION_TYPE_LABELS).sort()).toEqual([...connectionSchema.items.properties.type.enum].sort())
  })
})
