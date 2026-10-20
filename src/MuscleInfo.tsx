import type { Structure } from './data/connections'
import type { Muscle } from './data/muscles'
import { connectionSummary } from './labels'
import type { DistantSource } from './search/painSearch'
import { SourceList } from './SourceList'

type Props = {
  muscle: Muscle
  connected: DistantSource[]
  // Tendons and fascia the muscle attaches to; each opens its own info.
  structures: Structure[]
  onSelectMuscle: (id: string) => void
  onSelectStructure: (id: string) => void
}

export function MuscleInfo({ muscle, connected, structures, onSelectMuscle, onSelectStructure }: Props) {
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
      {structures.length > 0 && (
        <>
          <h3 className="source-heading">Jänteet ja kalvot</h3>
          <ul className="source-list">
            {structures.map((structure) => (
              <li key={structure.id}>
                <button type="button" onClick={() => onSelectStructure(structure.id)}>
                  {structure.name.fi}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
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
      <SourceList ids={muscle.sources} />
    </>
  )
}
