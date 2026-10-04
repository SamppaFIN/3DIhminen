import Ajv, { type AnySchema } from 'ajv'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { AREAS } from '../areas'
import { REGION_NAMES } from '../viewer/regions'
import connectionSchema from './schema/connection.schema.json'
import muscleSchema from './schema/muscle.schema.json'
import sourceSchema from './schema/source.schema.json'
import structureSchema from './schema/structure.schema.json'

const schemas: Record<string, AnySchema> = {
  './connections.json': connectionSchema,
  './muscles.json': muscleSchema,
  './sources.json': sourceSchema,
  './structures.json': structureSchema,
}

const dataFiles = import.meta.glob<unknown>('./*.json', { eager: true, import: 'default' })

const ajv = new Ajv({ allErrors: true })

type Ref = { id: string }
type Cited = Ref & { sources: string[] }
const muscles = dataFiles['./muscles.json'] as (Cited & { meshes?: string[]; attachmentMeshes?: string[] })[]
const structures = dataFiles['./structures.json'] as (Cited & { meshes: string[] })[]
const connections = dataFiles['./connections.json'] as (Cited & { from: string; to: string })[]
const sources = dataFiles['./sources.json'] as Ref[]

function duplicates(ids: string[]): string[] {
  return ids.filter((id, i) => ids.indexOf(id) !== i)
}

// Node names of every limb model (the arm and leg models together).
function modelNodeNames(): Set<string> {
  return new Set([...glbNodeNames('public/models/lower-limb.glb'), ...glbNodeNames('public/models/upper-limb.glb')])
}

// Node names from the GLB's JSON chunk (header 12 bytes, chunk header 8 bytes).
function glbNodeNames(path: string): Set<string> {
  const glb = readFileSync(path)
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'))
  return new Set(json.nodes.map((node: { name?: string }) => node.name))
}

describe('data files', () => {
  it('every data file has a schema', () => {
    expect(Object.keys(dataFiles).sort()).toEqual(Object.keys(schemas).sort())
  })

  it.each(Object.entries(dataFiles))('%s matches its schema', (path, data) => {
    const validate = ajv.compile(schemas[path])
    expect(validate(data), ajv.errorsText(validate.errors)).toBe(true)
  })

  it('ids are unique', () => {
    for (const records of [muscles, structures, connections, sources]) {
      expect(duplicates(records.map((r) => r.id))).toEqual([])
    }
  })

  it('records cite only existing sources', () => {
    const sourceIds = new Set(sources.map((s) => s.id))
    const missing = [...muscles, ...structures, ...connections].flatMap((r) =>
      r.sources.filter((id) => !sourceIds.has(id)).map((id) => `${r.id} -> ${id}`),
    )
    expect(missing).toEqual([])
  })

  it('connections refer only to existing muscles, structures and regions', () => {
    const known = new Set([
      ...muscles.map((m) => `muscle:${m.id}`),
      ...structures.map((s) => `structure:${s.id}`),
      ...Object.keys(REGION_NAMES).map((r) => `region:${r}`),
    ])
    const missing = connections.flatMap((c) =>
      [c.from, c.to].filter((ref) => !known.has(ref)).map((ref) => `${c.id}: ${ref}`),
    )
    expect(missing).toEqual([])
  })
})

describe('3D model', () => {
  it('every muscle and structure is mapped to meshes that exist in the model', () => {
    const nodeNames = modelNodeNames()
    const problems = [...muscles, ...structures].flatMap((r) =>
      r.meshes?.length
        ? r.meshes.filter((name) => !nodeNames.has(name)).map((name) => `${r.id}: ${name}`)
        : [`${r.id}: no meshes`],
    )
    expect(problems).toEqual([])
  })

  it('every quick-jump area is framed by bones that exist in the model', () => {
    const nodeNames = modelNodeNames()
    const missing = AREAS.flatMap((a) => a.meshes.filter((name) => !nodeNames.has(name)).map((name) => `${a.id}: ${name}`))
    expect(missing).toEqual([])
  })

  // The source model has no patches for these muscles; they insert into soft tissue (tendons, aponeuroses, skin).
  const WITHOUT_PATCHES = ['palmaris_longus', 'palmaris_brevis', 'lumbricales_manus']

  it('every muscle is mapped to attachment patches that exist in the attachments model', () => {
    const nodeNames = glbNodeNames('public/models/attachments.glb')
    const problems = muscles.flatMap((m) =>
      m.attachmentMeshes?.length
        ? m.attachmentMeshes.filter((name) => !nodeNames.has(name)).map((name) => `${m.id}: ${name}`)
        : WITHOUT_PATCHES.includes(m.id)
          ? []
          : [`${m.id}: no attachment meshes`],
    )
    expect(problems).toEqual([])
  })
})

describe('connection schema', () => {
  const validate = ajv.compile(connectionSchema)
  const valid = {
    id: 'test-connection',
    type: 'shared_tissue',
    from: 'muscle:test_muscle',
    to: 'structure:test_structure',
    evidence: 'anatomy',
    description: 'test description',
    sources: ['test-source'],
  }
  const referred = { ...valid, type: 'referred_pain', to: 'region:heel', evidence: 'contested' }

  it('accepts anatomical and referred-pain connections', () => {
    expect(validate([valid, referred]), ajv.errorsText(validate.errors)).toBe(true)
  })

  it('rejects referred pain that does not go from a muscle to a region', () => {
    expect(validate([{ ...referred, from: 'structure:test_structure' }])).toBe(false)
    expect(validate([{ ...referred, to: 'muscle:test_muscle' }])).toBe(false)
  })

  it('rejects a region in an anatomical connection', () => {
    expect(validate([{ ...valid, to: 'region:heel' }])).toBe(false)
  })

  it('rejects an unknown evidence level', () => {
    expect(validate([{ ...valid, evidence: 'anecdote' }])).toBe(false)
  })
})

describe('muscle schema', () => {
  const validate = ajv.compile(muscleSchema)
  const valid = {
    id: 'test_muscle',
    name: { fi: 'testilihas', la: 'musculus testus' },
    origin: 'test origin',
    insertion: 'test insertion',
    action: 'test action',
    layer: 'deep',
    sources: ['test-source'],
  }

  it('accepts a complete record', () => {
    expect(validate([valid]), ajv.errorsText(validate.errors)).toBe(true)
  })

  it('rejects a record without sources', () => {
    expect(validate([{ ...valid, sources: [] }])).toBe(false)
  })

  it('rejects an unknown layer', () => {
    expect(validate([{ ...valid, layer: 'middle' }])).toBe(false)
  })

  it('rejects a missing Latin name', () => {
    expect(validate([{ ...valid, name: { fi: 'testilihas' } }])).toBe(false)
  })

  it('accepts mesh names', () => {
    const record = { ...valid, meshes: ['Test muscle.r', 'Test muscle head.r'] }
    expect(validate([record]), ajv.errorsText(validate.errors)).toBe(true)
  })

  it('rejects an empty mesh list', () => {
    expect(validate([{ ...valid, meshes: [] }])).toBe(false)
  })

  it('rejects unknown fields', () => {
    expect(validate([{ ...valid, painScore: 5 }])).toBe(false)
  })
})
