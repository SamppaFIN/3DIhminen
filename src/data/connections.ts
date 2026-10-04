import connectionsJson from './connections.json'
import { muscles } from './muscles'
import structuresJson from './structures.json'

export type Connection = (typeof connectionsJson)[number]
export type Structure = (typeof structuresJson)[number]

export const connections: Connection[] = connectionsJson
export const structures: Structure[] = structuresJson
export const structureByMesh = new Map(structures.flatMap((s) => s.meshes.map((mesh) => [mesh, s] as const)))

// Model meshes of a "muscle:<id>" or "structure:<id>" reference; regions have none.
export function meshesOf(ref: string): string[] {
  const [kind, id] = ref.split(':')
  if (kind === 'muscle') return muscles.find((m) => m.id === id)?.meshes ?? []
  if (kind === 'structure') return structures.find((s) => s.id === id)?.meshes ?? []
  return []
}
