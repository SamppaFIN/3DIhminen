import { structures } from './data/connections'
import { muscles, sourcesById } from './data/muscles'
import { type DistantSource, weakestEvidence } from './search/painSearch'
import { REGION_NAMES } from './viewer/regions'

export const EVIDENCE_LABELS: Record<string, string> = {
  anatomy: 'anatominen perustieto',
  cadaver_study: 'ruumiinavaustutkimukset',
  contested: 'kiistanalainen',
}

export const CONNECTION_TYPE_LABELS: Record<string, string> = {
  shared_tissue: 'yhteinen jänne tai kalvo',
  attachment: 'kiinnityskohta',
  referred_pain: 'heijastekipu',
}

// Finnish name of a "muscle:", "structure:" or "region:" reference.
export function refName(ref: string): string {
  const [kind, id] = ref.split(':')
  if (kind === 'muscle') return muscles.find((m) => m.id === id)?.name.fi ?? id
  if (kind === 'structure') return structures.find((s) => s.id === id)?.name.fi ?? id
  return REGION_NAMES[id as keyof typeof REGION_NAMES] ?? id
}

// Route between the two ends of a connection, the weakest evidence on it, and its sources.
export function connectionSummary({ refs, path }: DistantSource): string {
  const via = refs.slice(1, -1).map(refName)
  const route = via.length > 0 ? `kautta: ${via.join(' → ')}` : CONNECTION_TYPE_LABELS[path[0].type]
  const sources = [...new Set(path.flatMap((c) => c.sources))].map((id) => sourcesById.get(id)?.label ?? id)
  return `${route} · yhteyden näyttö: ${EVIDENCE_LABELS[weakestEvidence(path)]} · lähteet: ${sources.join(', ')}`
}
