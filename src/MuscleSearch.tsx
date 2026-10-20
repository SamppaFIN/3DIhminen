import { useState } from 'react'
import { searchStructures } from './data/connections'
import { searchMuscles } from './data/muscles'

type Match = { kind: 'muscle' | 'structure'; id: string; name: { fi: string; la: string } }

type Props = { onSelectMuscle: (id: string) => void; onSelectStructure: (id: string) => void }

// Muscles first, then tendons and fascia.
export function MuscleSearch({ onSelectMuscle, onSelectStructure }: Props) {
  const [query, setQuery] = useState('')
  const matches: Match[] = [
    ...searchMuscles(query).map((m) => ({ kind: 'muscle' as const, id: m.id, name: m.name })),
    ...searchStructures(query).map((s) => ({ kind: 'structure' as const, id: s.id, name: s.name })),
  ]

  const select = (match: Match) => {
    if (match.kind === 'muscle') onSelectMuscle(match.id)
    else onSelectStructure(match.id)
    setQuery('')
  }

  return (
    <div className="search" role="search">
      <label className="visually-hidden" htmlFor="muscle-search">
        Hae lihasta, jännettä tai kalvoa suomeksi tai latinaksi
      </label>
      <input
        id="muscle-search"
        type="search"
        placeholder="Hae lihasta tai kalvoa"
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && matches.length > 0) select(matches[0])
          if (event.key === 'Escape') setQuery('')
        }}
      />
      {query.trim() && (
        <ul className="search-results" aria-label="Hakutulokset">
          {matches.length === 0 && <li className="search-empty">Ei osumia</li>}
          {matches.map((match) => (
            <li key={`${match.kind}:${match.id}`}>
              <button type="button" onClick={() => select(match)}>
                {match.name.fi} <i lang="la">{match.name.la}</i>
                {match.kind === 'structure' && <span className="search-kind"> · jänne tai kalvo</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
