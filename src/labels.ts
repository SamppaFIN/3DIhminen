import { structures } from './data/connections'
import { muscles } from './data/muscles'
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
