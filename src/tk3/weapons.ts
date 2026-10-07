// Weapons, perks and shop items. Plain data; game.ts gives them behaviour.

export type WeaponId = 'pistol' | 'uzi' | 'shotgun' | 'rocket' | 'flamer' | 'rail'

export type Weapon = {
  id: WeaponId
  name: string
  damage: number
  rate: number // Shots per second.
  pellets: number
  spread: number // Radians, total cone.
  speed: number // Projectile speed (m/s); 0 = hitscan.
  life: number // Projectile lifetime (s).
  knockback: number
  maxAmmo: number // Infinity = never runs out.
  pierce: number // Enemies a projectile passes through.
  explode: number // Explosion radius (m), 0 = none.
  shake: number // Screen trauma per shot.
  colour: string
  price: number // Shop price to unlock.
  ammoPrice: number // Price of one ammo refill (a third of the maximum).
}

export const WEAPONS: Record<WeaponId, Weapon> = {
  pistol: {
    id: 'pistol', name: 'Pistooli', damage: 24, rate: 4.5, pellets: 1, spread: 0.04, speed: 48, life: 0.7,
    knockback: 2.5, maxAmmo: Infinity, pierce: 0, explode: 0, shake: 0.08, colour: '#ffe9a8', price: 0, ammoPrice: 0,
  },
  uzi: {
    id: 'uzi', name: 'Konepistooli', damage: 14, rate: 15, pellets: 1, spread: 0.16, speed: 52, life: 0.6,
    knockback: 1.6, maxAmmo: 240, pierce: 0, explode: 0, shake: 0.06, colour: '#ffd36e', price: 120, ammoPrice: 30,
  },
  shotgun: {
    id: 'shotgun', name: 'Haulikko', damage: 12, rate: 1.5, pellets: 9, spread: 0.42, speed: 42, life: 0.38,
    knockback: 5, maxAmmo: 48, pierce: 0, explode: 0, shake: 0.32, colour: '#ffb46e', price: 180, ammoPrice: 35,
  },
  flamer: {
    id: 'flamer', name: 'Liekinheitin', damage: 5, rate: 32, pellets: 1, spread: 0.3, speed: 13, life: 0.5,
    knockback: 0.4, maxAmmo: 360, pierce: 99, explode: 0, shake: 0.03, colour: '#ff7a2a', price: 260, ammoPrice: 45,
  },
  rocket: {
    id: 'rocket', name: 'Sinko', damage: 110, rate: 1.1, pellets: 1, spread: 0.02, speed: 20, life: 2.5,
    knockback: 9, maxAmmo: 15, pierce: 0, explode: 3.2, shake: 0.25, colour: '#ff5a3a', price: 340, ammoPrice: 60,
  },
  rail: {
    id: 'rail', name: 'Raidetykki', damage: 150, rate: 0.9, pellets: 1, spread: 0, speed: 0, life: 0,
    knockback: 7, maxAmmo: 15, pierce: 99, explode: 0, shake: 0.4, colour: '#8ae9ff', price: 420, ammoPrice: 70,
  },
}

export const WEAPON_ORDER: WeaponId[] = ['pistol', 'uzi', 'shotgun', 'flamer', 'rocket', 'rail']

export type Stats = {
  damage: number
  fireRate: number
  speed: number
  maxHp: number
  dashCooldown: number
  magnet: number
  extraProjectiles: number
  pierce: number
  ricochet: number
  vampire: number
  chainExplode: number
  crit: number
}

export const BASE_STATS: Stats = {
  damage: 1, fireRate: 1, speed: 5.2, maxHp: 100, dashCooldown: 1.6, magnet: 2.5,
  extraProjectiles: 0, pierce: 0, ricochet: 0, vampire: 0, chainExplode: 0, crit: 0.05,
}

export type Perk = { id: string; name: string; text: string; apply: (s: Stats) => void; max?: number }

// One of three is picked for free after every wave.
export const PERKS: Perk[] = [
  { id: 'dmg', name: 'Rautanyrkki', text: '+20 % vahinkoa', apply: (s) => (s.damage *= 1.2) },
  { id: 'rate', name: 'Liipaisinsormi', text: '+18 % tulinopeutta', apply: (s) => (s.fireRate *= 1.18) },
  { id: 'speed', name: 'Pikajalka', text: '+12 % liikenopeutta', apply: (s) => (s.speed *= 1.12), max: 4 },
  { id: 'hp', name: 'Sisu', text: '+30 maksimiterveyttä ja täysi parannus', apply: (s) => (s.maxHp += 30) },
  { id: 'dash', name: 'Väistöliike', text: 'Syöksy latautuu 30 % nopeammin', apply: (s) => (s.dashCooldown *= 0.7), max: 3 },
  { id: 'magnet', name: 'Rahamagneetti', text: 'Kolikot lentävät luoksesi kauempaa', apply: (s) => (s.magnet *= 1.8), max: 3 },
  { id: 'multi', name: 'Kaksoispiippu', text: '+1 ammus jokaiseen laukaukseen', apply: (s) => (s.extraProjectiles += 1), max: 3 },
  { id: 'pierce', name: 'Läpäisy', text: 'Luodit menevät yhden vihollisen läpi', apply: (s) => (s.pierce += 1), max: 3 },
  { id: 'ricochet', name: 'Kimmoke', text: 'Luodit kimpoavat seinistä', apply: (s) => (s.ricochet += 1), max: 2 },
  { id: 'vampire', name: 'Verenhimo', text: 'Jokainen tappo parantaa 3', apply: (s) => (s.vampire += 3) },
  { id: 'chain', name: 'Ketjureaktio', text: '20 % kuolleista räjähtää', apply: (s) => (s.chainExplode += 0.2), max: 3 },
  { id: 'crit', name: 'Tarkka-ampuja', text: '+12 % kriittisen osuman mahdollisuus', apply: (s) => (s.crit += 0.12), max: 4 },
]

export function pickPerks(taken: Record<string, number>, random: () => number, count = 3): Perk[] {
  const available = PERKS.filter((p) => p.max === undefined || (taken[p.id] ?? 0) < p.max)
  const picked: Perk[] = []
  while (picked.length < count && available.length) {
    picked.push(available.splice(Math.floor(random() * available.length), 1)[0])
  }
  return picked
}

// Bends an aim direction towards the target that lies closest to it inside a cone; touch aiming
// is coarse, so a small pull makes it feel accurate without taking control away.
export function aimAssist(
  aim: [number, number],
  from: [number, number],
  targets: Iterable<[number, number]>,
  cone = 0.3,
  range = 14,
): [number, number] {
  let best = cone
  let result = aim
  const aimAngle = Math.atan2(aim[1], aim[0])
  for (const [tx, tz] of targets) {
    const dx = tx - from[0]
    const dz = tz - from[1]
    const distance = Math.hypot(dx, dz)
    if (distance > range || distance < 0.01) continue
    let delta = Math.atan2(dz, dx) - aimAngle
    delta = Math.atan2(Math.sin(delta), Math.cos(delta))
    if (Math.abs(delta) < best) {
      best = Math.abs(delta)
      result = [dx / distance, dz / distance]
    }
  }
  return result
}
