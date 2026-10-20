import { sourcesById } from './data/muscles'

// The sources of a muscle's or a structure's info, linked when they have a URL.
export function SourceList({ ids }: { ids: string[] }) {
  return (
    <>
      <h3 className="facts-sources-title">Lähteet</h3>
      <ul className="facts-sources">
        {ids.map((id) => {
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
