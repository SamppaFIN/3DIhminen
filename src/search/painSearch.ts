import { type Connection, connections, structureByMesh } from '../data/connections'
import { type Muscle, muscleByMesh, muscles } from '../data/muscles'
import type { Region } from '../viewer/regions'

// How many connections are followed from the pain point, and from a muscle to its connected muscles.
const PAIN_STEPS = 3
const CONNECTED_STEPS = 2

// Evidence levels from strongest to weakest; a chain is as strong as its weakest link.
export const EVIDENCE_ORDER = ['anatomy', 'cadaver_study', 'contested']

export function weakestEvidence(path: Connection[]): string {
  return path.map((c) => c.evidence).reduce((a, b) => (EVIDENCE_ORDER.indexOf(b) > EVIDENCE_ORDER.indexOf(a) ? b : a))
}

// refs: the chain from the pain point to the muscle, e.g.
// ['structure:plantar_aponeurosis', 'structure:calcaneal_tendon', 'muscle:gastrocnemius'];
// path holds the connection between each pair of consecutive refs.
export type DistantSource = { muscle: Muscle; refs: string[]; path: Connection[] }
export type PainSources = { local: Muscle[]; distant: DistantSource[] }

const muscleById = new Map(muscles.map((m) => [m.id, m]))
const muscleRef = (m: Muscle) => `muscle:${m.id}`

// Anatomical links are followed both ways; referred pain only from its region to the muscle.
const anatomical = connections.filter((c) => c.type !== 'referred_pain')

function neighbours(ref: string): { ref: string; connection: Connection }[] {
  return anatomical.flatMap((c) => {
    if (c.from === ref) return [{ ref: c.to, connection: c }]
    if (c.to === ref) return [{ ref: c.from, connection: c }]
    return []
  })
}

// The chain as shown to the user, from the pain region to the muscle. links[i] joins steps[i]
// and steps[i + 1]; null means the first structure lies at the pain point (geometry, not a source).
export function chainSteps(source: DistantSource, region: Region): { steps: string[]; links: (Connection | null)[] } {
  if (source.refs[0].startsWith('region:')) return { steps: source.refs, links: source.path }
  return { steps: [`region:${region}`, ...source.refs], links: [null, ...source.path] }
}

// Muscles reachable from `start` along anatomical connections within `maxSteps`, excluding the
// start itself. Breadth-first, so each chain found is one of the shortest.
// throughMuscles: whether chains may continue past a muscle. The pain search does not allow it:
// a shared tendon links the muscles that pull on it to pain in that tendon, not one muscle's
// pain to another muscle (e.g. calf pain is not traced on to the foot muscles).
function reachableMuscles(start: Set<string>, maxSteps: number, throughMuscles: boolean): DistantSource[] {
  const chains = new Map<string, { refs: string[]; path: Connection[] }>(
    [...start].map((ref) => [ref, { refs: [ref], path: [] }]),
  )
  let frontier = [...start]
  for (let step = 0; step < maxSteps; step++) {
    const next: string[] = []
    for (const ref of frontier) {
      if (!throughMuscles && ref.startsWith('muscle:')) continue
      const chain = chains.get(ref)!
      for (const { ref: to, connection } of neighbours(ref)) {
        if (chains.has(to)) continue
        chains.set(to, { refs: [...chain.refs, to], path: [...chain.path, connection] })
        next.push(to)
      }
    }
    frontier = next
  }

  const found: DistantSource[] = []
  for (const [ref, chain] of chains) {
    const muscle = ref.startsWith('muscle:') ? muscleById.get(ref.slice('muscle:'.length)) : undefined
    if (muscle && chain.path.length > 0) found.push({ muscle, ...chain })
  }
  return found
}

// Stronger evidence first, then shorter chains, then by name.
function byEvidence(sources: DistantSource[]): DistantSource[] {
  const strength = (d: DistantSource) => EVIDENCE_ORDER.indexOf(weakestEvidence(d.path))
  return sources.sort(
    (a, b) =>
      strength(a) - strength(b) ||
      a.path.length - b.path.length ||
      a.muscle.name.fi.localeCompare(b.muscle.name.fi, 'fi'),
  )
}

// nearbyNodes: model node names close to the pain point (muscles, structures; others are ignored).
export function findPainSources(nearbyNodes: Iterable<string>, region: Region): PainSources {
  const start = new Set<string>()
  for (const name of nearbyNodes) {
    const muscle = muscleByMesh.get(name)
    if (muscle) start.add(muscleRef(muscle))
    const structure = structureByMesh.get(name)
    if (structure) start.add(`structure:${structure.id}`)
  }
  const local = muscles.filter((m) => start.has(muscleRef(m)))

  const distant = reachableMuscles(start, PAIN_STEPS, false)
  for (const c of connections) {
    if (c.type !== 'referred_pain' || c.to !== `region:${region}`) continue
    if (start.has(c.from) || distant.some((d) => muscleRef(d.muscle) === c.from)) continue
    const muscle = muscleById.get(c.from.slice('muscle:'.length))
    if (muscle) distant.push({ muscle, refs: [c.to, c.from], path: [c] })
  }

  return { local, distant: byEvidence(distant) }
}

// Muscles linked to the given muscle through a shared tendon, fascia or attachment (S4.2).
export function connectedMuscles(muscleId: string): DistantSource[] {
  return byEvidence(reachableMuscles(new Set([`muscle:${muscleId}`]), CONNECTED_STEPS, true))
}
