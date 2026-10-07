// The arena: a square tile grid (1 m tiles) with indestructible walls and destructible crates,
// collision against it, line of sight, and a flow field that leads every enemy to the player.
// World coordinates: x right, z down the screen, the arena spans 0..size on both axes.

export const EMPTY = 0
export const WALL = 1
export const CRATE = 2
export const BARREL = 3 // Explodes when destroyed.

export type Level = {
  size: number
  tiles: Uint8Array
  hp: Float32Array
}

export const tileAt = (level: Level, x: number, z: number) => {
  const tx = Math.floor(x)
  const tz = Math.floor(z)
  if (tx < 0 || tz < 0 || tx >= level.size || tz >= level.size) return WALL
  return level.tiles[tz * level.size + tx]
}

export const solid = (tile: number) => tile !== EMPTY

// A small deterministic random generator, so a wave's layout can be reproduced in tests.
export function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

// Border walls, a few wall segments (room fragments) and scattered crates and barrels. The middle
// stays open for the player's start, and every open tile stays reachable from it.
export function generateLevel(size: number, seed: number): Level {
  const random = rng(seed)
  const tiles = new Uint8Array(size * size)
  const hp = new Float32Array(size * size)
  const set = (x: number, z: number, tile: number) => {
    if (x < 0 || z < 0 || x >= size || z >= size) return
    tiles[z * size + x] = tile
    hp[z * size + x] = tile === CRATE ? 60 : tile === BARREL ? 25 : Infinity
  }
  for (let i = 0; i < size; i++) {
    set(i, 0, WALL)
    set(i, size - 1, WALL)
    set(0, i, WALL)
    set(size - 1, i, WALL)
  }
  const centre = size / 2
  const nearCentre = (x: number, z: number) => Math.abs(x - centre) < 4 && Math.abs(z - centre) < 4

  // L-shaped wall fragments with gaps: cover to fight around, like the old TK maps.
  const segments = Math.floor(size * 0.35)
  for (let i = 0; i < segments; i++) {
    let x = 3 + Math.floor(random() * (size - 6))
    let z = 3 + Math.floor(random() * (size - 6))
    const horizontal = random() < 0.5
    const length = 3 + Math.floor(random() * 6)
    for (let j = 0; j < length; j++) {
      if (!nearCentre(x, z)) set(x, z, WALL)
      if (horizontal) x++
      else z++
    }
    if (random() < 0.5) {
      const turn = 2 + Math.floor(random() * 3)
      for (let j = 0; j < turn; j++) {
        if (horizontal) z++
        else x++
        if (!nearCentre(x, z)) set(x, z, WALL)
      }
    }
  }
  // Crate clusters and lone barrels.
  for (let i = 0; i < size * 0.6; i++) {
    const x = 2 + Math.floor(random() * (size - 4))
    const z = 2 + Math.floor(random() * (size - 4))
    if (nearCentre(x, z) || tiles[z * size + x] !== EMPTY) continue
    if (random() < 0.3) set(x, z, BARREL)
    else {
      set(x, z, CRATE)
      if (random() < 0.5 && tiles[z * size + x + 1] === EMPTY) set(x + 1, z, CRATE)
    }
  }
  const level = { size, tiles, hp }
  sealUnreachable(level)
  return level
}

// Fills open pockets the player could never reach, so no enemy spawns inside one.
function sealUnreachable(level: Level) {
  const centre = Math.floor(level.size / 2)
  const distance = flowField(level, centre + 0.5, centre + 0.5, true)
  for (let i = 0; i < level.tiles.length; i++) {
    if (level.tiles[i] === EMPTY && distance[i] === UNREACHED) {
      level.tiles[i] = WALL
      level.hp[i] = Infinity
    }
  }
}

export const UNREACHED = 0xffff

// Breadth-first distance (in tiles, 8-connected without corner cutting) from the target to every
// tile. Enemies walk downhill on it. With throughCrates, crates and barrels count as open.
export function flowField(level: Level, targetX: number, targetZ: number, throughCrates = false) {
  const { size, tiles } = level
  const distance = new Uint16Array(size * size).fill(UNREACHED)
  const open = (i: number) => tiles[i] === EMPTY || (throughCrates && tiles[i] !== WALL)
  const start = Math.floor(targetZ) * size + Math.floor(targetX)
  if (start < 0 || start >= distance.length) return distance
  const queue = new Int32Array(size * size)
  let head = 0
  let tail = 0
  distance[start] = 0
  queue[tail++] = start
  while (head < tail) {
    const i = queue[head++]
    const x = i % size
    const z = (i - x) / size
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue
        const nx = x + dx
        const nz = z + dz
        if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue
        const n = nz * size + nx
        if (distance[n] !== UNREACHED || !open(n)) continue
        if (dx && dz && (!open(z * size + nx) || !open(nz * size + x))) continue
        distance[n] = distance[i] + 1
        queue[tail++] = n
      }
    }
  }
  return distance
}

// The direction (unit x, z) towards the neighbouring tile closest to the target, or null when the
// tile is the target or unreached.
export function flowDirection(level: Level, distance: Uint16Array, x: number, z: number): [number, number] | null {
  const { size } = level
  const tx = Math.floor(x)
  const tz = Math.floor(z)
  if (tx < 0 || tz < 0 || tx >= size || tz >= size) return null
  const here = distance[tz * size + tx]
  if (here === 0 || here === UNREACHED) return null
  let best = here
  let bx = 0
  let bz = 0
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = tx + dx
      const nz = tz + dz
      if (nx < 0 || nz < 0 || nx >= size || nz >= size) continue
      const d = distance[nz * size + nx]
      if (d < best) {
        best = d
        bx = nx + 0.5 - x
        bz = nz + 0.5 - z
      }
    }
  }
  const length = Math.hypot(bx, bz)
  return length > 0 ? [bx / length, bz / length] : null
}

// Pushes a circle (centre x, z, radius r) out of solid tiles. Returns the corrected position.
export function collideCircle(level: Level, x: number, z: number, r: number): [number, number] {
  for (let pass = 0; pass < 2; pass++) {
    const minX = Math.floor(x - r)
    const maxX = Math.floor(x + r)
    const minZ = Math.floor(z - r)
    const maxZ = Math.floor(z + r)
    for (let tz = minZ; tz <= maxZ; tz++) {
      for (let tx = minX; tx <= maxX; tx++) {
        if (!solid(tileAt(level, tx + 0.5, tz + 0.5))) continue
        const cx = Math.max(tx, Math.min(x, tx + 1))
        const cz = Math.max(tz, Math.min(z, tz + 1))
        let dx = x - cx
        let dz = z - cz
        const d2 = dx * dx + dz * dz
        if (d2 >= r * r) continue
        if (d2 < 1e-9) {
          // Centre inside the tile: push out along the shortest axis.
          const left = x - tx
          const right = tx + 1 - x
          const top = z - tz
          const bottom = tz + 1 - z
          const m = Math.min(left, right, top, bottom)
          if (m === left) x = tx - r
          else if (m === right) x = tx + 1 + r
          else if (m === top) z = tz - r
          else z = tz + 1 + r
          continue
        }
        const d = Math.sqrt(d2)
        dx /= d
        dz /= d
        x = cx + dx * r
        z = cz + dz * r
      }
    }
  }
  return [x, z]
}

// Walks from a to b in small steps; true when no solid tile is in between.
export function lineOfSight(level: Level, ax: number, az: number, bx: number, bz: number, step = 0.25) {
  const length = Math.hypot(bx - ax, bz - az)
  const steps = Math.ceil(length / step)
  for (let i = 1; i < steps; i++) {
    const t = i / steps
    if (solid(tileAt(level, ax + (bx - ax) * t, az + (bz - az) * t))) return false
  }
  return true
}
