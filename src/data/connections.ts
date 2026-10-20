import connectionsJson from './connections.json'
import { muscles } from './muscles'
import structuresJson from './structures.json'

export type Connection = (typeof connectionsJson)[number]
// description and function are optional (schema/structure.schema.json).
export type Structure = {
  id: string
  meshes: string[]
  name: { fi: string; la: string }
  description?: string
  function?: string
  sources: string[]
}

export const connections: Connection[] = connectionsJson
export const structures: Structure[] = structuresJson
export const structureByMesh = new Map(structures.flatMap((s) => s.meshes.map((mesh) => [mesh, s] as const)))

function normalize(text: string): string {
  return text.toLocaleLowerCase('fi').replace(/\s+/g, ' ').trim()
}

// Matches Finnish and Latin names like searchMuscles: earlier matches first, then alphabetical.
export function searchStructures(query: string): Structure[] {
  const q = normalize(query)
  if (!q) return []
  return structures
    .map((structure) => {
      const found = [structure.name.fi, structure.name.la].map((name) => normalize(name).indexOf(q)).filter((p) => p >= 0)
      return { structure, rank: found.length > 0 ? Math.min(...found) : -1 }
    })
    .filter(({ rank }) => rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.structure.name.fi.localeCompare(b.structure.name.fi, 'fi'))
    .map(({ structure }) => structure)
}

// Model meshes of a "muscle:<id>" or "structure:<id>" reference; regions have none.
export function meshesOf(ref: string): string[] {
  const [kind, id] = ref.split(':')
  if (kind === 'muscle') return muscles.find((m) => m.id === id)?.meshes ?? []
  if (kind === 'structure') return structures.find((s) => s.id === id)?.meshes ?? []
  return []
}
