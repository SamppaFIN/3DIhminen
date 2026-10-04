import { type Muscle, sourcesById } from './data/muscles'
import { CONNECTION_TYPE_LABELS, EVIDENCE_LABELS, refName } from './labels'
import { type DistantSource, weakestEvidence } from './search/painSearch'

// Route between the two muscles, the weakest evidence on it, and its sources.
function connectionSummary({ refs, path }: DistantSource): string {
  const via = refs.slice(1, -1).map(refName)
  const route = via.length > 0 ? `kautta: ${via.join(' → ')}` : CONNECTION_TYPE_LABELS[path[0].type]
  const sources = [...new Set(path.flatMap((c) => c.sources))].map((id) => sourcesById.get(id)?.label ?? id)
  return `${route} · yhteyden näyttö: ${EVIDENCE_LABELS[weakestEvidence(path)]} · lähteet: ${sources.join(', ')}`
}

type Props = { muscle: Muscle; connected: DistantSource[]; onSelectMuscle: (id: string) => void }

export function MuscleInfo({ muscle, connected, onSelectMuscle }: Props) {
  return (
    <>
      <h2 className="muscle-name" tabIndex={-1} data-autofocus>
        {muscle.name.fi}
      </h2>
      <p className="latin-name" lang="la">
        {muscle.name.la}
      </p>
      <p className="attachment-legend">
        Mallissa: <span className="swatch swatch-origin" aria-hidden="true" /> origo{' '}
        <span className="swatch swatch-insertion" aria-hidden="true" /> insertio
      </p>
      <dl className="muscle-facts">
        <dt>Origo</dt>
        <dd>{muscle.origin}</dd>
        <dt>Insertio</dt>
        <dd>{muscle.insertion}</dd>
        <dt>Toiminta</dt>
        <dd>{muscle.action}</dd>
      </dl>
      {connected.length > 0 && (
        <>
          <h3 className="source-heading">
            <span className="source-marker distant" aria-hidden="true" /> Kytkeytyvät lihakset
          </h3>
          <ul className="source-list">
            {connected.map((c) => (
              <li key={c.muscle.id}>
                <button type="button" onClick={() => onSelectMuscle(c.muscle.id)}>
                  {c.muscle.name.fi}
                  <span className="source-chain">{connectionSummary(c)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <h3 className="facts-sources-title">Lähteet</h3>
      <ul className="facts-sources">
        {muscle.sources.map((id) => {
          const source = sourcesById.get(id)
          return (
            <li key={id}>
              {source?.url ? (
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.citation}
                </a>
              ) : (
                source?.citation
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
