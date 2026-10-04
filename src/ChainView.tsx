import type { Connection } from './data/connections'
import { sourcesById } from './data/muscles'
import { EVIDENCE_LABELS, refName } from './labels'

function ChainLink({ connection }: { connection: Connection | null }) {
  if (!connection) return <p className="chain-link">sijaitsee kipukohdassa</p>
  return (
    <div className="chain-link">
      <p>{connection.description}</p>
      <p className="chain-meta">
        Näyttö: {EVIDENCE_LABELS[connection.evidence]} · Lähteet:{' '}
        {connection.sources.map((id, i) => {
          const source = sourcesById.get(id)
          const label = source?.label ?? id
          return (
            <span key={id}>
              {i > 0 && ', '}
              {source?.url ? (
                <a href={source.url} target="_blank" rel="noreferrer" title={source.citation}>
                  {label}
                </a>
              ) : (
                label
              )}
            </span>
          )
        })}
      </p>
    </div>
  )
}

type Props = {
  muscleId: string
  // From chainSteps: steps from the pain region to the muscle, and the link before each step.
  steps: string[]
  links: (Connection | null)[]
  // How many steps have lit up so far.
  lit: number
  onBack: () => void
  onSelectMuscle: (id: string) => void
}

export function ChainView({ muscleId, steps, links, lit, onBack, onSelectMuscle }: Props) {
  return (
    <section className="chain" aria-labelledby="chain-title">
      <button type="button" onClick={onBack}>
        ← Takaisin tuloksiin
      </button>
      <h3 id="chain-title" tabIndex={-1} data-autofocus>
        Kytkösketju: {refName(`muscle:${muscleId}`)}
      </h3>
      <ol className="chain-steps">
        {steps.map((ref, i) => (
          <li key={ref} className={i < lit ? 'lit' : undefined}>
            {i > 0 && <ChainLink connection={links[i - 1]} />}
            <span className="chain-node">{i === 0 ? `${refName(ref)} (kipukohta)` : refName(ref)}</span>
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => onSelectMuscle(muscleId)}>
        Näytä lihaksen tiedot
      </button>
    </section>
  )
}
