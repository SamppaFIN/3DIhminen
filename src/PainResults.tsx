import { EVIDENCE_LABELS, refName } from './labels'
import { type DistantSource, type PainSources, weakestEvidence } from './search/painSearch'

// Structural links show what the link rests on, not evidence that the muscle causes the pain.
function structuralSummary({ refs, path }: DistantSource): string {
  return `kautta: ${refs.slice(0, -1).map(refName).join(' → ')} · yhteyden näyttö: ${EVIDENCE_LABELS[weakestEvidence(path)]}`
}

function referredSummary({ path }: DistantSource): string {
  return `näyttö: ${EVIDENCE_LABELS[weakestEvidence(path)]}`
}

type SourceListProps = {
  sources: DistantSource[]
  summary: (source: DistantSource) => string
  onOpenChain: (muscleId: string) => void
}

function DistantList({ sources, summary, onOpenChain }: SourceListProps) {
  return (
    <ul className="source-list">
      {sources.map((source) => (
        <li key={source.muscle.id}>
          <button type="button" onClick={() => onOpenChain(source.muscle.id)}>
            {source.muscle.name.fi}
            <span className="source-chain">{summary(source)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

// Local muscles open the muscle's info; distant ones open the chain that links them to the pain point.
type Props = { sources: PainSources; onSelectMuscle: (id: string) => void; onOpenChain: (muscleId: string) => void }

export function PainResults({ sources: { local, distant }, onSelectMuscle, onOpenChain }: Props) {
  if (local.length === 0 && distant.length === 0) {
    return <p>Tähän kohtaan ei vielä ole kytköstietoja.</p>
  }
  const structural = distant.filter((d) => d.path[0].type !== 'referred_pain')
  const referred = distant.filter((d) => d.path[0].type === 'referred_pain')

  return (
    <section className="pain-results" aria-labelledby="pain-results-title">
      <h3 id="pain-results-title">Mistä kipu voi tulla</h3>
      {local.length > 0 && (
        <>
          <h4 className="source-heading">
            <span className="source-marker local" aria-hidden="true" /> Kipukohdassa
          </h4>
          <ul className="source-list">
            {local.map((muscle) => (
              <li key={muscle.id}>
                <button type="button" onClick={() => onSelectMuscle(muscle.id)}>
                  {muscle.name.fi}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {distant.length > 0 && (
        <h4 className="source-heading">
          <span className="source-marker distant" aria-hidden="true" /> Kauempana
        </h4>
      )}
      {structural.length > 0 && (
        <>
          <h5 className="source-subheading">Jänteen tai kalvon kautta</h5>
          <p className="source-hint">
            Lihas on rakenteellisesti yhteydessä kipukohtaan. Yhteys ei yksin kerro, että kipu tulee siitä.
          </p>
          <DistantList sources={structural} summary={structuralSummary} onOpenChain={onOpenChain} />
        </>
      )}
      {referred.length > 0 && (
        <>
          <h5 className="source-subheading">Heijastekipu</h5>
          <p className="source-hint">Tutkimuksissa kuvattu kipu, joka tuntuu muualla kuin lihaksessa itsessään.</p>
          <DistantList sources={referred} summary={referredSummary} onOpenChain={onOpenChain} />
        </>
      )}
    </section>
  )
}
