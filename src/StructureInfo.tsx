import type { Structure } from './data/connections'
import { connectionSummary } from './labels'
import { SourceList } from './SourceList'
import type { StructureLinks } from './search/painSearch'

type Props = {
  structure: Structure
  links: StructureLinks
  onSelectMuscle: (id: string) => void
  onSelectStructure: (id: string) => void
}

// A tendon's or fascia's info, like a muscle's: what it is, the muscles attached to it (directly or
// through another tendon or fascia), and the structures it continues into.
export function StructureInfo({ structure, links, onSelectMuscle, onSelectStructure }: Props) {
  const { description, function: role } = structure
  return (
    <>
      <h2 className="muscle-name" tabIndex={-1} data-autofocus>
        {structure.name.fi}
      </h2>
      <p className="latin-name" lang="la">
        {structure.name.la}
      </p>
      {description || role ? (
        <dl className="muscle-facts">
          {description && (
            <>
              <dt>Kuvaus</dt>
              <dd>{description}</dd>
            </>
          )}
          {role && (
            <>
              <dt>Tehtävä</dt>
              <dd>{role}</dd>
            </>
          )}
        </dl>
      ) : (
        <p className="empty-state">Tälle jänteelle tai kalvolle ei vielä ole lähteistettyä kuvausta.</p>
      )}
      {links.muscles.length > 0 && (
        <>
          <h3 className="source-heading">
            <span className="source-marker distant" aria-hidden="true" /> Kiinnittyvät lihakset
          </h3>
          <ul className="source-list">
            {links.muscles.map((c) => (
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
      {links.structures.length > 0 && (
        <>
          <h3 className="source-heading">Jatkuu rakenteisiin</h3>
          <ul className="source-list">
            {links.structures.map(({ structure: next, connection }) => (
              <li key={next.id}>
                <button type="button" onClick={() => onSelectStructure(next.id)}>
                  {next.name.fi}
                  <span className="source-chain">{connection.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <SourceList ids={structure.sources} />
    </>
  )
}
