import musclesJson from './muscles.json'
import sourcesJson from './sources.json'
import type { Layer } from '../viewer/layers'

export type Muscle = Omit<(typeof musclesJson)[number], 'layer'> & { layer: Layer }

export const muscles = musclesJson as Muscle[]
export const sourcesById = new Map(sourcesJson.map((source) => [source.id, source]))
export const muscleByMesh = new Map(muscles.flatMap((m) => m.meshes.map((mesh) => [mesh, m] as const)))

function normalize(text: string): string {
  return text.toLocaleLowerCase('fi').replace(/\s+/g, ' ').trim()
}

// Matches Finnish and Latin names; earlier matches in the name rank first, then alphabetical.
export function searchMuscles(query: string): Muscle[] {
  const q = normalize(query)
  if (!q) return []
  return muscles
    .map((muscle) => {
      const positions = [muscle.name.fi, muscle.name.la].map((name) => normalize(name).indexOf(q))
      const found = positions.filter((p) => p >= 0)
      return { muscle, rank: found.length > 0 ? Math.min(...found) : -1 }
    })
    .filter(({ rank }) => rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.muscle.name.fi.localeCompare(b.muscle.name.fi, 'fi'))
    .map(({ muscle }) => muscle)
}
