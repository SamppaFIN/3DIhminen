import { useState } from 'react'
import { searchMuscles } from './data/muscles'

export function MuscleSearch({ onSelect }: { onSelect: (muscleId: string) => void }) {
  const [query, setQuery] = useState('')
  const matches = searchMuscles(query)

  const select = (muscleId: string) => {
    onSelect(muscleId)
    setQuery('')
  }

  return (
    <div className="search" role="search">
      <label className="visually-hidden" htmlFor="muscle-search">
        Hae lihasta suomeksi tai latinaksi
      </label>
      <input
        id="muscle-search"
        type="search"
        placeholder="Hae lihasta"
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && matches.length > 0) select(matches[0].id)
          if (event.key === 'Escape') setQuery('')
        }}
      />
      {query.trim() && (
        <ul className="search-results" aria-label="Hakutulokset">
          {matches.length === 0 && <li className="search-empty">Ei osumia</li>}
          {matches.map((muscle) => (
            <li key={muscle.id}>
              <button type="button" onClick={() => select(muscle.id)}>
                {muscle.name.fi} <i lang="la">{muscle.name.la}</i>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
