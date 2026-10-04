import { describe, expect, it } from 'vitest'
import { chainSteps, connectedMuscles, EVIDENCE_ORDER, findPainSources, weakestEvidence } from './painSearch'

const ids = (muscles: { id: string }[]) => muscles.map((m) => m.id)

describe('findPainSources', () => {
  it('leads from the sole through the plantar fascia and Achilles tendon to the calf muscles', () => {
    const { local, distant } = findPainSources(['Plantar aponeurosis.r', 'Flexor digitorum brevis.r'], 'sole')
    expect(ids(local)).toEqual(['flexor_digitorum_brevis'])

    const gastrocnemius = distant.find((d) => d.muscle.id === 'gastrocnemius')
    expect(gastrocnemius?.refs).toEqual([
      'structure:plantar_aponeurosis',
      'structure:calcaneal_tendon',
      'muscle:gastrocnemius',
    ])
    expect(gastrocnemius?.path.map((c) => c.id)).toEqual([
      'calcaneal-tendon-plantar-aponeurosis',
      'gastrocnemius-calcaneal-tendon',
    ])
    expect(ids(distant.map((d) => d.muscle))).toEqual(expect.arrayContaining(['soleus', 'plantaris', 'abductor_hallucis']))
  })

  it('lists stronger evidence first, then shorter chains', () => {
    const { distant } = findPainSources(['Calcaneal tendon.r'], 'heel')
    const order = distant.map((d) => [EVIDENCE_ORDER.indexOf(weakestEvidence(d.path)), d.path.length])
    expect(order).toEqual([...order].sort((a, b) => a[0] - b[0] || a[1] - b[1]))
    expect(weakestEvidence(distant.at(-1)!.path)).toBe('contested')
  })

  it('does not repeat local muscles among the distant ones', () => {
    const { local, distant } = findPainSources(['Plantar aponeurosis.r', 'Abductor hallucis.r'], 'sole')
    expect(ids(local)).toEqual(['abductor_hallucis'])
    expect(ids(distant.map((d) => d.muscle))).not.toContain('abductor_hallucis')
  })

  it('adds referred pain for the region', () => {
    const { distant } = findPainSources([], 'heel')
    const quadratus = distant.find((d) => d.muscle.id === 'quadratus_plantae')
    expect(quadratus?.refs).toEqual(['region:heel', 'muscle:quadratus_plantae'])
    expect(quadratus?.path[0].type).toBe('referred_pain')
  })

  it.each([
    ['knee front', 'Quadriceps common tendon and patellar ligament.r', ['rectus_femoris', 'vastus_lateralis', 'vastus_intermedius', 'vastus_medialis']],
    ['inner knee', 'Pes anserinus common tendon.r', ['sartorius', 'gracilis', 'semitendinosus']],
    ['outer thigh', 'Iliotibial tract.r', ['tensor_fasciae_latae', 'gluteus_maximus']],
  ] as const)('leads from the %s through its tendon to the muscles that pull on it', (_, mesh, muscles) => {
    const { distant } = findPainSources([mesh], 'knee')
    expect(ids(distant.map((d) => d.muscle)).sort()).toEqual([...muscles].sort())
  })

  it('does not trace calf or knee-pit pain on to the foot muscles', () => {
    for (const region of ['popliteal', 'calf'] as const) {
      const { distant } = findPainSources(['Medial head of gastrocnemius.r'], region)
      expect(ids(distant.map((d) => d.muscle))).toEqual([])
    }
  })

  it('does not continue a chain past a muscle', () => {
    const { distant } = findPainSources(['Plantar aponeurosis.r', 'Quadratus plantae muscle.r'], 'sole')
    for (const { refs } of distant) {
      expect(refs.slice(0, -1).filter((ref) => ref.startsWith('muscle:'))).toEqual([])
    }
  })

  it('finds nothing next to a bone without connections', () => {
    expect(findPainSources(['Tibia.r'], 'shin')).toEqual({ local: [], distant: [] })
  })
})

describe('connectedMuscles', () => {
  it('links the calf muscles through the Achilles tendon', () => {
    const connected = connectedMuscles('gastrocnemius')
    expect(ids(connected.map((c) => c.muscle)).sort()).toEqual(['plantaris', 'soleus'])
    expect(connected[0].refs).toEqual(['muscle:gastrocnemius', 'structure:calcaneal_tendon', connected[0].refs[2]])
  })

  it('links muscles that attach to each other directly', () => {
    expect(ids(connectedMuscles('quadratus_plantae').map((c) => c.muscle))).toContain('flexor_digitorum_longus')
  })

  it('finds nothing for a muscle without connections', () => {
    expect(connectedMuscles('popliteus')).toEqual([])
  })
})

describe('chainSteps', () => {
  it('starts an anatomical chain from the pain region', () => {
    const { distant } = findPainSources(['Plantar aponeurosis.r'], 'sole')
    const gastrocnemius = distant.find((d) => d.muscle.id === 'gastrocnemius')!
    const { steps, links } = chainSteps(gastrocnemius, 'sole')
    expect(steps).toEqual([
      'region:sole',
      'structure:plantar_aponeurosis',
      'structure:calcaneal_tendon',
      'muscle:gastrocnemius',
    ])
    expect(links.map((c) => c?.id ?? null)).toEqual([
      null,
      'calcaneal-tendon-plantar-aponeurosis',
      'gastrocnemius-calcaneal-tendon',
    ])
  })

  it('keeps a referred-pain chain as it is', () => {
    const { distant } = findPainSources([], 'heel')
    const quadratus = distant.find((d) => d.muscle.id === 'quadratus_plantae')!
    const { steps, links } = chainSteps(quadratus, 'heel')
    expect(steps).toEqual(['region:heel', 'muscle:quadratus_plantae'])
    expect(links.map((c) => c?.type)).toEqual(['referred_pain'])
  })
})
