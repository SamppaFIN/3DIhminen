// Tapan Kaikki 3: the game state and its rules. One instance runs from the title screen through
// waves and the shop to game over. main.ts only creates it.

import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  Plane,
  PointLight,
  Quaternion,
  Raycaster,
  RingGeometry,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  PCFShadowMap,
  ACESFilmicToneMapping,
  DynamicDrawUsage,
  Euler,
} from 'three'
import { buzz, initAudio, isMuted, setMuted, sfx } from './audio'
import { Beams, CHUNK, Floor, LIT, Particles } from './fx'
import { Input } from './input'
import {
  BARREL,
  CRATE,
  EMPTY,
  type Level,
  UNREACHED,
  WALL,
  collideCircle,
  flowDirection,
  flowField,
  generateLevel,
  lineOfSight,
  rng,
  solid,
  tileAt,
} from './level'
import { type FigureData, FigureRenderer, MUZZLE_OFFSET, P, PARTS, PART_LABEL, type Pose, type Stance, animate, newPose, solvePose } from './rig'
import { type ShopItem, UI } from './ui'
import { BASE_STATS, type Perk, type Stats, WEAPONS, WEAPON_ORDER, type WeaponId, aimAssist, pickPerks } from './weapons'

const SIZE = 34
const GRAVITY = 20
const COMBO_WINDOW = 2.6
const MAX_GIBS = 420

type Kind = 'player' | 'runner' | 'shooter' | 'bomber' | 'brute' | 'boss'

type Fighter = {
  kind: Kind
  x: number
  z: number
  vx: number
  vz: number
  kx: number // Knockback velocity, decays.
  kz: number
  yaw: number
  hp: number
  maxHp: number
  radius: number
  speed: number
  scale: number
  colour: Color
  flash: number
  phase: number
  recoil: number
  cooldown: number
  windup: number // > 0 while telegraphing an attack.
  missing: number
  pose: Pose
  burn: number
  elite: boolean
  value: number
  lastPart: number
  stagger: number
}

type Projectile = {
  x: number
  z: number
  y: number
  vx: number
  vz: number
  life: number
  damage: number
  enemy: boolean
  pierce: number
  ricochet: number
  explode: number
  knockback: number
  weapon: WeaponId | 'enemy' | 'rocketEnemy'
  hits: Fighter[]
}

type Gib = {
  part: number
  p: Vector3
  q: Quaternion
  v: Vector3
  w: Vector3
  scale: number
  colour: Color
  age: number
  bleed: number
  rest: boolean
}

type Pickup = { kind: 'coin' | 'health' | 'ammo' | 'armor' | 'weapon'; x: number; z: number; y: number; vy: number; value: number; weapon?: WeaponId; age: number }
type Grenade = { x: number; y: number; z: number; vx: number; vy: number; vz: number; fuse: number }
type Portal = { x: number; z: number; kind: Kind; time: number; elite: boolean }

const ENEMY: Record<Exclude<Kind, 'player'>, { hp: number; speed: number; radius: number; scale: number; colour: string; value: number; stance: Stance; score: number }> = {
  runner: { hp: 40, speed: 3.5, radius: 0.32, scale: 1, colour: '#c4503f', value: 3, stance: 'run', score: 100 },
  shooter: { hp: 50, speed: 2.5, radius: 0.32, scale: 1, colour: '#5b8f5e', value: 5, stance: 'aim', score: 150 },
  bomber: { hp: 26, speed: 4.4, radius: 0.3, scale: 0.92, colour: '#e09a2d', value: 4, stance: 'run', score: 120 },
  brute: { hp: 280, speed: 2.1, radius: 0.48, scale: 1.4, colour: '#7656a8', value: 16, stance: 'brute', score: 500 },
  boss: { hp: 1800, speed: 1.9, radius: 0.75, scale: 2.2, colour: '#3c3c46', value: 120, stance: 'aim', score: 5000 },
}

const PLAYER_COLOUR = new Color('#efeae0')
const WHITE = new Color('#ffffff')
const BURN = new Color('#ff8a2a')
const GOLD = new Color('#ffcf4a')
const tmpColour = new Color()
const v3 = new Vector3()
const m4 = new Matrix4()
const q4 = new Quaternion()
const s3 = new Vector3()
const e3 = new Euler()
const UP = new Vector3(0, 1, 0)

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const rand = (a: number, b: number) => a + Math.random() * (b - a)

function loadBest() {
  try {
    const raw = localStorage.getItem('tk3-best')
    if (raw) return JSON.parse(raw) as { score: number; wave: number }
  } catch {
    // Storage unavailable.
  }
  return { score: 0, wave: 0 }
}

function saveBest(best: { score: number; wave: number }) {
  try {
    localStorage.setItem('tk3-best', JSON.stringify(best))
  } catch {
    // Storage unavailable.
  }
}

export class Game {
  private renderer: WebGLRenderer
  private scene = new Scene()
  private camera = new PerspectiveCamera(42, 1, 0.5, 120)
  private sun: DirectionalLight
  private muzzleLight = new PointLight('#ffc070', 0, 7, 1.6)
  private blastLights: PointLight[] = []
  private figures: FigureRenderer
  private particles: Particles
  private floor: Floor
  private beams: Beams
  private input: Input
  private ui: UI
  private wallMesh: InstancedMesh
  private crateMesh: InstancedMesh
  private barrelMesh: InstancedMesh
  private pickupMesh: InstancedMesh
  private coinMesh: InstancedMesh
  private grenadeMesh: InstancedMesh
  private portalMesh: InstancedMesh
  private ring: Mesh
  private raycaster = new Raycaster()
  private recentre = new Matrix4()
  private groundPlane = new Plane(new Vector3(0, 1, 0), -1.2)

  private level!: Level
  private flow: Uint16Array = new Uint16Array(0)
  private flowTimer = 0
  private tilesDirty = true

  private player!: Fighter
  private enemies: Fighter[] = []
  private projectiles: Projectile[] = []
  private gibs: Gib[] = []
  private pickups: Pickup[] = []
  private grenades: Grenade[] = []
  private portals: Portal[] = []
  private pendingBlasts: { x: number; z: number; r: number; damage: number; time: number }[] = []

  private mode: 'title' | 'play' | 'shop' | 'pause' | 'dead' = 'title'
  private stats: Stats = { ...BASE_STATS }
  private perksTaken: Record<string, number> = {}
  private owned = new Set<WeaponId>(['pistol'])
  private ammo: Record<WeaponId, number> = { pistol: Infinity, uzi: 0, shotgun: 0, flamer: 0, rocket: 0, rail: 0 }
  private weapon: WeaponId = 'pistol'
  private armor = 0
  private grenadeCount = 3
  private money = 0
  private score = 0
  private kills = 0
  private wave = 0
  private toSpawn: Kind[] = []
  private spawnTimer = 0
  private waveCleared = false
  private combo = 0
  private comboTimer = 0
  private multiKill = 0
  private multiTimer = 0
  private fireTimer = 0
  private dashTimer = 0
  private dashCharge = 1
  private invulnerable = 0
  private hurtBeat = 0
  private best = loadBest()

  private time = 0
  private frame = 0
  private timeScale = 1
  private slowTarget = 1
  private hitStop = 0
  private trauma = 0
  private camTarget = new Vector3(SIZE / 2, 0, SIZE / 2)
  private camKick = new Vector2()
  private lastFrame = performance.now()
  private frameTimes: number[] = []
  private pixelRatio: number
  private shopPerks: Perk[] = []
  private perkPicked = false

  private container: HTMLElement
  private figureData: FigureData

  constructor(container: HTMLElement, figureData: FigureData) {
    this.container = container
    this.figureData = figureData
    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.pixelRatio = Math.min(window.devicePixelRatio, 2)
    this.renderer.setPixelRatio(this.pixelRatio)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFShadowMap
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.setClearColor('#0d0b0a')
    this.renderer.domElement.className = 'tk-canvas'
    container.append(this.renderer.domElement)

    this.scene.add(new HemisphereLight('#c5cfdf', '#3b302a', 1.5))
    this.sun = new DirectionalLight('#fff0d8', 2.4)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(1024, 1024)
    Object.assign(this.sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 50 })
    this.sun.shadow.bias = -0.0015
    this.scene.add(this.sun, this.sun.target, this.muzzleLight)
    for (let i = 0; i < 3; i++) {
      const light = new PointLight('#ff8a3a', 0, 12, 1.5)
      this.blastLights.push(light)
      this.scene.add(light)
    }

    this.floor = new Floor(this.scene, SIZE)
    this.figures = new FigureRenderer(this.scene, figureData, 160)
    this.particles = new Particles(this.scene)
    this.particles.onLand = (x, z, size) => this.floor.splat(x, z, Math.max(0.05, size * 0.9), 0.7)
    this.beams = new Beams(this.scene)

    const instanced = (geometry: BoxGeometry | CylinderGeometry | SphereGeometry | RingGeometry, material: MeshLambertMaterial | MeshBasicMaterial, count: number, shadows = true) => {
      const mesh = new InstancedMesh(geometry, material, count)
      mesh.instanceMatrix.setUsage(DynamicDrawUsage)
      mesh.castShadow = shadows
      mesh.receiveShadow = shadows
      mesh.frustumCulled = false
      mesh.count = 0
      this.scene.add(mesh)
      return mesh
    }
    const wallGeometry = new BoxGeometry(1, 1.3, 1).translate(0, 0.65, 0)
    this.wallMesh = instanced(wallGeometry, new MeshLambertMaterial({ color: '#6f6a64' }), SIZE * SIZE)
    this.crateMesh = instanced(new BoxGeometry(0.9, 0.9, 0.9).translate(0, 0.45, 0), new MeshLambertMaterial({ color: '#a8733d' }), SIZE * SIZE)
    this.barrelMesh = instanced(new CylinderGeometry(0.36, 0.36, 1, 12).translate(0, 0.5, 0), new MeshLambertMaterial({ color: '#c9302c' }), 200)
    this.pickupMesh = instanced(new BoxGeometry(0.45, 0.45, 0.45), new MeshLambertMaterial({ color: '#ffffff' }), 200)
    this.pickupMesh.setColorAt(0, new Color())
    this.coinMesh = instanced(new CylinderGeometry(0.16, 0.16, 0.05, 10).rotateX(Math.PI / 2), new MeshLambertMaterial({ color: '#ffcc33', emissive: '#6a4a00' }), 600, false)
    this.grenadeMesh = instanced(new SphereGeometry(0.12, 8, 6), new MeshLambertMaterial({ color: '#4d5a32' }), 40)
    this.portalMesh = instanced(
      new RingGeometry(0.35, 0.6, 24).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ color: '#ff3040', transparent: true, opacity: 0.8, toneMapped: false }),
      60,
      false,
    )
    this.ring = new Mesh(new RingGeometry(0.42, 0.5, 32).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: '#5fe3ff', transparent: true, opacity: 0.55, toneMapped: false }))
    this.scene.add(this.ring)

    this.ui = new UI(container)
    this.input = new Input(this.renderer.domElement, this.ui.overlay)
    const tap = (node: HTMLElement, action: () => void) =>
      node.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        action()
      })
    tap(this.ui.buttons.dash, () => this.input.press('dash'))
    tap(this.ui.buttons.grenade, () => this.input.press('grenade'))
    tap(this.ui.buttons.weapon, () => this.input.press('next'))
    tap(this.ui.buttons.pause, () => this.input.press('pause'))

    window.addEventListener('resize', () => this.resize())
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === 'play') this.pause()
    })
    this.resize()
    this.newLevel(1)
    this.player = this.makePlayer()
    this.showTitle()
    this.renderer.setAnimationLoop(() => this.tick())
  }

  // --- Setup -------------------------------------------------------------------------------------

  private resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private makePlayer(): Fighter {
    return {
      kind: 'player', x: SIZE / 2, z: SIZE / 2, vx: 0, vz: 0, kx: 0, kz: 0, yaw: Math.PI, hp: this.stats.maxHp, maxHp: this.stats.maxHp,
      radius: 0.32, speed: this.stats.speed, scale: 1, colour: PLAYER_COLOUR.clone(), flash: 0, phase: 0, recoil: 0, cooldown: 0,
      windup: 0, missing: 0, pose: newPose(), burn: 0, elite: false, value: 0, lastPart: 0, stagger: 0,
    }
  }

  private newLevel(seed: number) {
    this.level = generateLevel(SIZE, seed * 7919 + 13)
    this.floor.paintBase(rng(seed * 31 + 7))
    this.tilesDirty = true
    this.flow = flowField(this.level, SIZE / 2, SIZE / 2)
  }

  private showTitle() {
    this.mode = 'title'
    this.ui.setPlaying(false)
    this.ui.title(this.best, () => this.start(), isMuted(), () => {
      setMuted(!isMuted())
      return isMuted()
    })
  }

  private start() {
    initAudio()
    sfx.click()
    try {
      if (matchMedia('(pointer: coarse)').matches && !document.fullscreenElement) {
        void document.documentElement.requestFullscreen?.().then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape')).catch(() => {})
      }
    } catch {
      // Fullscreen is a nicety.
    }
    this.stats = { ...BASE_STATS }
    this.perksTaken = {}
    this.owned = new Set(['pistol'])
    this.ammo = { pistol: Infinity, uzi: 0, shotgun: 0, flamer: 0, rocket: 0, rail: 0 }
    this.weapon = 'pistol'
    this.armor = 0
    this.grenadeCount = 3
    this.money = 0
    this.score = 0
    this.kills = 0
    this.wave = 0
    this.combo = 0
    this.player = this.makePlayer()
    this.nextWave()
  }

  private nextWave() {
    this.wave++
    this.newLevel(this.wave + Math.floor(Math.random() * 1000))
    this.enemies = []
    this.projectiles = []
    this.gibs = []
    this.pickups = []
    this.grenades = []
    this.portals = []
    this.pendingBlasts = []
    this.particles.clear()
    this.beams.clear()
    this.ui.clearFloats()
    this.player.x = SIZE / 2
    this.player.z = SIZE / 2
    this.player.missing = 0
    this.camTarget.set(this.player.x, 0, this.player.z)
    this.toSpawn = this.waveRoster(this.wave)
    this.spawnTimer = 1.2
    this.waveCleared = false
    this.slowTarget = 1
    this.timeScale = 1
    this.mode = 'play'
    this.input.clearPresses()
    this.ui.hide()
    this.ui.setPlaying(true)
    this.ui.banner(this.wave % 5 === 0 ? `TASO ${this.wave}: JÄTTI` : `TASO ${this.wave}`, this.wave === 1 ? 'Tapa kaikki.' : `${this.toSpawn.length} vihollista`)
  }

  // A spawn budget that grows every wave, with tougher kinds mixed in as the waves go on.
  private waveRoster(wave: number): Kind[] {
    const roster: Kind[] = []
    let budget = 8 + wave * 5
    if (wave % 5 === 0) {
      roster.push('boss')
      budget -= 10
    }
    const cost: Record<string, number> = { runner: 1, shooter: 2, bomber: 2, brute: 6 }
    while (budget > 0) {
      const roll = Math.random()
      let kind: Kind = 'runner'
      if (wave >= 2 && roll < 0.3) kind = 'shooter'
      else if (wave >= 3 && roll < 0.45) kind = 'bomber'
      else if (wave >= 4 && roll < 0.53) kind = 'brute'
      roster.push(kind)
      budget -= cost[kind]
    }
    return roster
  }

  // --- Loop --------------------------------------------------------------------------------------

  private tick() {
    const now = performance.now()
    const realDt = Math.min(0.05, (now - this.lastFrame) / 1000)
    this.lastFrame = now
    this.adaptQuality(realDt)
    this.frame++

    if (this.mode === 'play' || this.mode === 'dead') {
      if (this.hitStop > 0) {
        this.hitStop -= realDt
      } else {
        this.timeScale += (this.slowTarget - this.timeScale) * Math.min(1, realDt * 4)
        const dt = realDt * this.timeScale
        this.time += dt
        this.update(dt, realDt)
      }
    } else if (this.mode === 'title') {
      this.time += realDt
      this.attract(realDt)
    }
    this.render(realDt)
  }

  // Lowers the resolution when frames run long and raises it back when there is headroom, so
  // older phones keep a steady frame rate.
  private adaptQuality(dt: number) {
    this.frameTimes.push(dt)
    if (this.frameTimes.length < 60) return
    const average = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
    this.frameTimes.length = 0
    const max = Math.min(window.devicePixelRatio, 2)
    let next = this.pixelRatio
    if (average > 1 / 45) next = Math.max(0.6, this.pixelRatio - 0.2)
    else if (average < 1 / 58) next = Math.min(max, this.pixelRatio + 0.1)
    if (next !== this.pixelRatio) {
      this.pixelRatio = next
      this.renderer.setPixelRatio(next)
    }
  }

  // The title screen's background: the camera drifts over an empty arena.
  private attract(dt: number) {
    this.camTarget.x = SIZE / 2 + Math.sin(this.time * 0.15) * 6
    this.camTarget.z = SIZE / 2 + Math.cos(this.time * 0.12) * 6
    this.particles.update(dt)
  }

  private update(dt: number, realDt: number) {
    const player = this.player
    const alive = this.mode === 'play'
    this.input.update(this.toScreen(player.x, 1.2, player.z))
    if (alive && this.input.take('pause')) {
      this.pause()
      return
    }
    if (alive) this.updatePlayer(dt)
    this.updateEnemies(dt)
    this.updateProjectiles(dt)
    this.updateGrenades(dt)
    this.updateGibs(dt)
    this.updatePickups(dt)
    this.updatePortals(dt)
    this.particles.update(dt)
    this.beams.update(dt)
    for (const blast of this.pendingBlasts) blast.time -= dt
    const due = this.pendingBlasts.filter((b) => b.time <= 0)
    this.pendingBlasts = this.pendingBlasts.filter((b) => b.time > 0)
    for (const b of due) this.explode(b.x, b.z, b.r, b.damage, false)

    this.flowTimer -= dt
    if (this.flowTimer <= 0) {
      this.flowTimer = 0.2
      this.flow = flowField(this.level, player.x, player.z)
    }
    if (this.comboTimer > 0) {
      this.comboTimer -= realDt
      if (this.comboTimer <= 0) this.combo = 0
    }
    this.multiTimer -= dt
    if (this.multiTimer <= 0 && this.multiKill > 0) {
      if (this.multiKill >= 2) {
        const names = ['', '', 'TUPLATAPPO', 'TRIPLATAPPO', 'NELOSTAPPO', 'VERILÖYLY']
        this.ui.banner(names[Math.min(5, this.multiKill)] + '!', `+${this.multiKill * 50 * this.multiKill} pistettä`, 1)
        this.score += this.multiKill * 50 * this.multiKill
      }
      this.multiKill = 0
    }

    if (alive) {
      this.spawnTimer -= dt
      if (this.toSpawn.length && this.spawnTimer <= 0 && this.enemies.length + this.portals.length < 40) {
        const group = Math.min(this.toSpawn.length, 1 + Math.floor(Math.random() * (2 + this.wave / 3)))
        for (let i = 0; i < group; i++) this.openPortal(this.toSpawn.pop()!)
        this.spawnTimer = Math.max(0.6, 2.4 - this.wave * 0.12)
      }
      if (!this.waveCleared && !this.toSpawn.length && !this.portals.length && !this.enemies.length) this.clearWave()
      // Low health: a heartbeat that speeds up as health drops.
      if (player.hp / player.maxHp < 0.3) {
        this.hurtBeat -= realDt
        if (this.hurtBeat <= 0) {
          sfx.heartbeat()
          this.hurtBeat = 0.5 + (player.hp / player.maxHp) * 2
        }
      }
    }
  }

  // --- Player ------------------------------------------------------------------------------------

  private updatePlayer(dt: number) {
    const p = this.player
    const input = this.input
    // Mouse: aim at the point under the cursor on the plane at gun height.
    if (input.usingMouse && !input.touchAiming) {
      const ndc = new Vector2((input.mouse.x / this.container.clientWidth) * 2 - 1, -(input.mouse.y / this.container.clientHeight) * 2 + 1)
      this.raycaster.setFromCamera(ndc, this.camera)
      if (this.raycaster.ray.intersectPlane(this.groundPlane, v3)) {
        const dx = v3.x - p.x
        const dz = v3.z - p.z
        const l = Math.hypot(dx, dz)
        if (l > 0.2) {
          input.aim.x = dx / l
          input.aim.z = dz / l
        }
      }
    }
    let aim: [number, number] = [input.aim.x, input.aim.z]
    if (input.touchAiming || (!input.usingMouse && !input.firing)) {
      aim = aimAssist(aim, [p.x, p.z], this.visibleEnemies(), 0.28)
    }
    const targetYaw = Math.atan2(aim[0], aim[1])
    p.yaw += wrap(targetYaw - p.yaw) * Math.min(1, dt * 25)

    // Dash: a burst of speed with invulnerability, through enemies and bullets.
    this.dashCharge = Math.min(1, this.dashCharge + dt / this.stats.dashCooldown)
    if (input.take('dash') && this.dashCharge >= 1) {
      const mx = Math.hypot(input.move.x, input.move.z) > 0.1 ? input.move.x : aim[0]
      const mz = Math.hypot(input.move.x, input.move.z) > 0.1 ? input.move.z : aim[1]
      const l = Math.hypot(mx, mz) || 1
      p.kx = (mx / l) * 17
      p.kz = (mz / l) * 17
      this.dashTimer = 0.22
      this.dashCharge = 0
      this.invulnerable = Math.max(this.invulnerable, 0.3)
      sfx.dash()
      buzz(15)
    }
    if (this.dashTimer > 0) {
      this.dashTimer -= dt
      // Afterimage: pale sparks along the path.
      this.particles.spawn({ x: p.x + rand(-0.2, 0.2), y: rand(0.3, 1.5), z: p.z + rand(-0.2, 0.2), colour: '#7fe8ff', size: 0.25, life: 0.3, grow: -0.6 })
    }
    this.invulnerable -= dt

    const speed = this.stats.speed
    const target = [input.move.x * speed, input.move.z * speed]
    const accel = Math.min(1, dt * 14)
    p.vx += (target[0] - p.vx) * accel
    p.vz += (target[1] - p.vz) * accel
    this.moveFighter(p, dt)

    // Weapon selection.
    if (input.take('next')) this.cycleWeapon(1)
    if (input.take('prev')) this.cycleWeapon(-1)
    for (let i = 0; i < WEAPON_ORDER.length; i++) {
      if (input.take(`weapon${i}` as 'weapon0')) {
        const id = WEAPON_ORDER[i]
        if (this.owned.has(id) && this.ammo[id] > 0) this.selectWeapon(id)
      }
    }
    if (input.take('grenade')) this.throwGrenade(aim)

    this.fireTimer -= dt
    if (input.firing && this.fireTimer <= 0) this.fire(aim)
    p.recoil = Math.max(0, p.recoil - dt * 6)
    if (p.flash > 0) p.flash -= dt * 5
    // Aim laser: a faint line shows where the shots go.
    const muzzle = this.muzzleOf(p)
    const end = this.rayEnd(muzzle.x, muzzle.z, aim[0], aim[1], 7)
    this.beams.draw(muzzle.x, muzzle.z, end[0], end[1], muzzle.y, 0.014, tmpColour.set('#ff2020').multiplyScalar(0.45))
  }

  private cycleWeapon(direction: number) {
    const usable = WEAPON_ORDER.filter((id) => this.owned.has(id) && this.ammo[id] > 0)
    const i = usable.indexOf(this.weapon)
    this.selectWeapon(usable[(i + direction + usable.length) % usable.length])
  }

  private selectWeapon(id: WeaponId) {
    if (id === this.weapon) return
    this.weapon = id
    this.fireTimer = Math.max(this.fireTimer, 0.12)
    sfx.click()
    this.ui.float(this.player.x, 2.2, this.player.z, WEAPONS[id].name, 'info', 0.8)
  }

  private muzzleOf(f: Fighter) {
    const world = solvePose(this.baseMatrix(f), f.pose)
    return MUZZLE_OFFSET.clone().applyMatrix4(world[P['foreArm.r']])
  }

  // Where a ray from (x, z) in direction (dx, dz) hits a wall, up to maxLength.
  private rayEnd(x: number, z: number, dx: number, dz: number, maxLength: number): [number, number] {
    for (let d = 0; d < maxLength; d += 0.15) {
      if (solid(tileAt(this.level, x + dx * d, z + dz * d))) return [x + dx * d, z + dz * d]
    }
    return [x + dx * maxLength, z + dz * maxLength]
  }

  private fire(aim: [number, number]) {
    const w = WEAPONS[this.weapon]
    const p = this.player
    if (this.ammo[this.weapon] <= 0) {
      sfx.empty()
      this.ui.float(p.x, 2.2, p.z, 'TYHJÄ!', 'info', 0.7)
      this.selectWeapon('pistol')
      return
    }
    this.fireTimer = 1 / (w.rate * this.stats.fireRate)
    if (Number.isFinite(this.ammo[this.weapon])) this.ammo[this.weapon]--
    const muzzle = this.muzzleOf(p)
    const pellets = w.pellets + this.stats.extraProjectiles
    const baseAngle = Math.atan2(aim[1], aim[0])

    if (w.speed === 0) {
      // Hitscan rail: everything on the line until a wall.
      const end = this.rayEnd(muzzle.x, muzzle.z, aim[0], aim[1], 40)
      for (const e of [...this.enemies]) {
        if (distanceToSegment(e.x, e.z, muzzle.x, muzzle.z, end[0], end[1]) < e.radius * e.scale + 0.15) {
          this.damage(e, w.damage * this.stats.damage, aim[0] * w.knockback, aim[1] * w.knockback, 'rail')
        }
      }
      const colour = new Color(w.colour)
      this.beams.add(muzzle.x, muzzle.z, end[0], end[1], muzzle.y, 0.35, 0.22, colour)
      this.beams.add(muzzle.x, muzzle.z, end[0], end[1], muzzle.y, 0.6, 0.06, new Color('#ffffff'))
      for (let d = 0; d < Math.hypot(end[0] - muzzle.x, end[1] - muzzle.z); d += 0.5) {
        this.particles.spawn({ x: muzzle.x + aim[0] * d, y: muzzle.y, z: muzzle.z + aim[1] * d, vy: rand(0, 1), colour: '#8ae9ff', size: 0.12, life: rand(0.2, 0.5), drag: 2 })
      }
      this.damageTile(end[0] + aim[0] * 0.1, end[1] + aim[1] * 0.1, w.damage)
    } else {
      for (let i = 0; i < pellets; i++) {
        const spread = w.spread + (pellets > w.pellets ? 0.08 * this.stats.extraProjectiles : 0)
        const angle = baseAngle + (pellets > 1 ? (i / (pellets - 1) - 0.5) * spread : 0) + rand(-0.5, 0.5) * w.spread * (pellets > 1 ? 0.3 : 1)
        const speed = w.speed * rand(0.9, 1.1)
        this.projectiles.push({
          x: muzzle.x, z: muzzle.z, y: muzzle.y, vx: Math.cos(angle) * speed, vz: Math.sin(angle) * speed, life: w.life * rand(0.85, 1.1),
          damage: w.damage * this.stats.damage, enemy: false, pierce: w.pierce + this.stats.pierce, ricochet: this.stats.ricochet, explode: w.explode,
          knockback: w.knockback, weapon: w.id, hits: [],
        })
      }
    }
    // Feel: muzzle flash, light, recoil, shell, shake, sound.
    p.recoil = Math.min(1, p.recoil + (w.id === 'flamer' ? 0.05 : 0.6))
    this.trauma = Math.min(1, this.trauma + w.shake)
    this.camKick.set(-aim[0] * w.shake * 0.6, -aim[1] * w.shake * 0.6)
    if (w.id !== 'flamer') {
      this.muzzleLight.intensity = w.id === 'rail' ? 30 : 18
      this.muzzleLight.color.set(w.colour)
      this.muzzleLight.position.set(muzzle.x + aim[0] * 0.3, muzzle.y, muzzle.z + aim[1] * 0.3)
      this.particles.spawn({ x: muzzle.x + aim[0] * 0.15, y: muzzle.y, z: muzzle.z + aim[1] * 0.15, colour: '#fff3c4', size: w.id === 'shotgun' ? 0.6 : 0.35, life: 0.06 })
      if (w.id !== 'rocket' && w.id !== 'rail') {
        this.particles.spawn({
          channel: CHUNK, x: muzzle.x, y: muzzle.y, z: muzzle.z, vx: -aim[1] * rand(2, 3.5), vy: rand(2, 4), vz: aim[0] * rand(2, 3.5),
          gravity: GRAVITY, colour: '#d9a838', size: 0.06, life: 2.5, spin: 18,
        })
      }
    }
    if (w.id === 'rocket') {
      for (let i = 0; i < 6; i++) this.particles.spawn({ channel: LIT, x: muzzle.x - aim[0] * 0.4, y: muzzle.y, z: muzzle.z - aim[1] * 0.4, vx: -aim[0] * rand(1, 4) + rand(-1, 1), vz: -aim[1] * rand(1, 4) + rand(-1, 1), colour: '#8a8580', size: 0.2, grow: 0.6, life: 0.5, drag: 3 })
    }
    sfx[w.id]()
    if (w.id === 'shotgun' || w.id === 'rail' || w.id === 'rocket') buzz(25)
  }

  private throwGrenade(aim: [number, number]) {
    if (this.grenadeCount <= 0) {
      sfx.empty()
      this.ui.float(this.player.x, 2.2, this.player.z, 'EI KRANAATTEJA', 'info', 0.8)
      return
    }
    this.grenadeCount--
    const p = this.player
    this.grenades.push({ x: p.x + aim[0] * 0.4, y: 1.4, z: p.z + aim[1] * 0.4, vx: aim[0] * 11 + p.vx * 0.5, vy: 5, vz: aim[1] * 11 + p.vz * 0.5, fuse: 1.3 })
    sfx.throw()
  }

  // --- Enemies -----------------------------------------------------------------------------------

  private visibleEnemies(): [number, number][] {
    const p = this.player
    return this.enemies.filter((e) => lineOfSight(this.level, p.x, p.z, e.x, e.z, 0.4)).map((e) => [e.x, e.z])
  }

  private openPortal(kind: Kind) {
    const p = this.player
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = 1 + Math.floor(Math.random() * (SIZE - 2))
      const z = 1 + Math.floor(Math.random() * (SIZE - 2))
      const d = this.flow[z * SIZE + x]
      if (this.level.tiles[z * SIZE + x] !== EMPTY || d === UNREACHED || Math.hypot(x - p.x, z - p.z) < 9) continue
      this.portals.push({ x: x + 0.5, z: z + 0.5, kind, time: 1.0, elite: kind !== 'boss' && Math.random() < 0.06 + this.wave * 0.01 })
      return
    }
  }

  private updatePortals(dt: number) {
    for (const portal of this.portals) {
      portal.time -= dt
      if (Math.random() < 0.5) this.particles.spawn({ x: portal.x + rand(-0.5, 0.5), y: 0.1, z: portal.z + rand(-0.5, 0.5), vy: rand(1, 3), colour: '#ff3a4a', size: 0.12, life: 0.5 })
      if (portal.time <= 0) this.spawnEnemy(portal)
    }
    this.portals = this.portals.filter((p) => p.time > 0)
  }

  private spawnEnemy(portal: Portal) {
    const kind = portal.kind as Exclude<Kind, 'player'>
    const def = ENEMY[kind]
    const waveHp = 1 + (this.wave - 1) * 0.12
    const hp = def.hp * waveHp * (portal.elite ? 2.2 : 1)
    this.enemies.push({
      kind, x: portal.x, z: portal.z, vx: 0, vz: 0, kx: 0, kz: 0, yaw: Math.atan2(this.player.x - portal.x, this.player.z - portal.z), hp, maxHp: hp,
      radius: def.radius, speed: def.speed * (1 + Math.min(0.4, this.wave * 0.025)) * rand(0.9, 1.1), scale: def.scale * (portal.elite ? 1.12 : 1),
      colour: portal.elite ? GOLD.clone() : new Color(def.colour).offsetHSL(rand(-0.02, 0.02), 0, rand(-0.05, 0.05)), flash: 0, phase: Math.random() * 6,
      recoil: 0, cooldown: rand(1, 2), windup: 0, missing: 0, pose: newPose(), burn: 0, elite: portal.elite, value: def.value * (portal.elite ? 5 : 1),
      lastPart: 0, stagger: 0,
    })
    for (let i = 0; i < 14; i++) this.particles.spawn({ x: portal.x, y: rand(0.2, 1.8), z: portal.z, vx: rand(-3, 3), vy: rand(0, 3), vz: rand(-3, 3), colour: '#ff5060', size: 0.15, life: 0.5, drag: 3 })
    if (kind === 'boss') {
      this.trauma = 0.8
      sfx.explosion()
      this.ui.banner('JÄTTI SAAPUI', 'Ammu jalat alta', 1.6)
    }
  }

  private updateEnemies(dt: number) {
    const p = this.player
    const playerAlive = this.mode === 'play'
    for (const e of this.enemies) {
      e.flash = Math.max(0, e.flash - dt * 6)
      e.recoil = Math.max(0, e.recoil - dt * 4)
      e.cooldown -= dt
      e.stagger -= dt
      if (e.burn > 0) {
        e.burn -= dt
        this.damage(e, 12 * dt, 0, 0, 'burn')
        if (Math.random() < 0.4) this.particles.spawn({ x: e.x + rand(-0.2, 0.2), y: rand(0.5, 1.6) * e.scale, z: e.z + rand(-0.2, 0.2), vy: rand(1, 2.5), colour: '#ff8a2a', size: 0.2, grow: -0.3, life: 0.4 })
      }
      if (e.hp <= 0) continue
      const dx = p.x - e.x
      const dz = p.z - e.z
      const distance = Math.hypot(dx, dz)
      const sees = distance < 16 && lineOfSight(this.level, e.x, e.z, p.x, p.z, 0.5)
      // Direction: straight at the player when in sight, else down the flow field.
      let dirX = 0
      let dirZ = 0
      if (sees) {
        dirX = dx / (distance || 1)
        dirZ = dz / (distance || 1)
      } else {
        const flow = flowDirection(this.level, this.flow, e.x, e.z)
        if (flow) [dirX, dirZ] = flow
      }
      let want = playerAlive ? 1 : 0
      const reach = e.radius * e.scale + p.radius + 0.35
      if (e.kind === 'shooter' || e.kind === 'boss') {
        // Keep a fighting distance and strafe.
        const ideal = e.kind === 'boss' ? 7 : 6.5
        if (sees && distance < ideal) want = distance < ideal - 2 ? -0.6 : 0
        const strafe = Math.sin(this.time * 0.8 + e.phase) * 0.6
        if (sees) {
          dirX += -dz / (distance || 1) * strafe
          dirZ += dx / (distance || 1) * strafe
        }
        if (sees && playerAlive && e.cooldown <= 0 && !(e.missing & (1 << P['foreArm.r']))) {
          if (e.windup <= 0) e.windup = e.kind === 'boss' ? 0.7 : 0.45
        }
      }
      if (e.windup > 0) {
        e.windup -= dt
        want *= 0.2
        if (e.kind === 'shooter' || e.kind === 'boss') {
          // Telegraph: a red laser shows the shot before it comes.
          const m = this.muzzleOf(e)
          const end = this.rayEnd(m.x, m.z, Math.sin(e.yaw), Math.cos(e.yaw), 20)
          this.beams.draw(m.x, m.z, end[0], end[1], m.y, 0.03 + (1 - e.windup) * 0.03, tmpColour.set('#ff1020'))
        }
        if (e.windup <= 0) this.enemyAttack(e, distance, reach)
      } else if ((e.kind === 'runner' || e.kind === 'brute') && distance < reach + 0.3 && e.cooldown <= 0 && playerAlive) {
        e.windup = e.kind === 'brute' ? 0.45 : 0.25
      } else if (e.kind === 'bomber' && distance < reach + 0.2 && playerAlive) {
        e.hp = 0
        this.kill(e, 0, 0, 'blast')
        continue
      }
      if (e.stagger > 0) want *= 0.3
      const length = Math.hypot(dirX, dirZ) || 1
      const speed = e.speed * want * (e.missing & ((1 << P['shin.l']) | (1 << P['shin.r'])) ? 0.4 : 1)
      const accel = Math.min(1, dt * 8)
      e.vx += ((dirX / length) * speed - e.vx) * accel
      e.vz += ((dirZ / length) * speed - e.vz) * accel
      const faceX = sees ? dx : e.vx
      const faceZ = sees ? dz : e.vz
      if (Math.hypot(faceX, faceZ) > 0.01 && e.windup <= 0.05) e.yaw += wrap(Math.atan2(faceX, faceZ) - e.yaw) * Math.min(1, dt * 8)
    }
    // Crowd separation: enemies push apart instead of stacking into one blob.
    for (let i = 0; i < this.enemies.length; i++) {
      const a = this.enemies[i]
      for (let j = i + 1; j < this.enemies.length; j++) {
        const b = this.enemies[j]
        const dx = b.x - a.x
        const dz = b.z - a.z
        const min = a.radius * a.scale + b.radius * b.scale
        const d2 = dx * dx + dz * dz
        if (d2 >= min * min || d2 < 1e-6) continue
        const d = Math.sqrt(d2)
        const push = (min - d) / 2
        const wa = b.scale / (a.scale + b.scale)
        a.x -= (dx / d) * push * wa * 2
        a.z -= (dz / d) * push * wa * 2
        b.x += (dx / d) * push * (1 - wa) * 2
        b.z += (dz / d) * push * (1 - wa) * 2
      }
    }
    for (const e of this.enemies) if (e.hp > 0) this.moveFighter(e, dt)
    this.enemies = this.enemies.filter((e) => e.hp > 0)
  }

  private enemyAttack(e: Fighter, distance: number, reach: number) {
    const p = this.player
    if (e.kind === 'shooter' || e.kind === 'boss') {
      const m = this.muzzleOf(e)
      const shots = e.kind === 'boss' ? 5 : 1
      for (let i = 0; i < shots; i++) {
        const angle = Math.atan2(Math.cos(e.yaw), Math.sin(e.yaw)) + (shots > 1 ? (i / (shots - 1) - 0.5) * 0.6 : rand(-0.04, 0.04))
        const rocket = e.kind === 'boss' && i % 2 === 0
        const speed = rocket ? 11 : 17
        this.projectiles.push({
          x: m.x, z: m.z, y: m.y, vx: Math.cos(angle) * speed, vz: Math.sin(angle) * speed, life: 2.2, damage: rocket ? 22 : 9 + this.wave * 0.5, enemy: true,
          pierce: 0, ricochet: 0, explode: rocket ? 2.2 : 0, knockback: 3, weapon: rocket ? 'rocketEnemy' : 'enemy', hits: [],
        })
      }
      e.recoil = 1
      e.cooldown = e.kind === 'boss' ? 1.6 : rand(1.4, 2.2)
      sfx.enemyShot()
      this.particles.spawn({ x: m.x, y: m.y, z: m.z, colour: '#ffcf8a', size: 0.3, life: 0.06 })
    } else {
      e.recoil = 1
      e.cooldown = e.kind === 'brute' ? 1.3 : 0.9
      // A lunge forward with the swing.
      e.kx += Math.sin(e.yaw) * 5
      e.kz += Math.cos(e.yaw) * 5
      if (distance < reach + 0.45) {
        const damage = e.kind === 'brute' ? 26 : 11 + this.wave * 0.6
        const nx = (p.x - e.x) / (distance || 1)
        const nz = (p.z - e.z) / (distance || 1)
        this.hurtPlayer(damage, nx * (e.kind === 'brute' ? 14 : 6), nz * (e.kind === 'brute' ? 14 : 6))
      }
    }
  }

  private moveFighter(f: Fighter, dt: number) {
    const decay = Math.max(0, 1 - dt * 9)
    f.kx *= decay
    f.kz *= decay
    const vx = f.vx + f.kx
    const vz = f.vz + f.kz
    const r = f.radius * f.scale
    ;[f.x, f.z] = collideCircle(this.level, f.x + vx * dt, f.z + vz * dt, r)
    const speed = Math.hypot(f.vx, f.vz)
    // Stride phase advances with distance; backwards walking runs the cycle backwards.
    const moveYaw = Math.atan2(f.vx, f.vz)
    let hips = wrap(moveYaw - f.yaw)
    let direction = 1
    if (Math.abs(hips) > Math.PI / 2) {
      hips = wrap(hips - Math.PI)
      direction = -1
    }
    f.pose.hipsYaw += ((speed > 0.3 ? hips : 0) - f.pose.hipsYaw) * Math.min(1, dt * 10)
    f.phase += (speed * dt * 2.4 * direction) / f.scale
  }

  // --- Damage ------------------------------------------------------------------------------------

  private hurtPlayer(amount: number, kx: number, kz: number) {
    const p = this.player
    if (this.invulnerable > 0 || this.mode !== 'play') return
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, amount * 0.6)
      this.armor -= absorbed
      amount -= absorbed
    }
    p.hp -= amount
    p.kx += kx
    p.kz += kz
    p.flash = 1
    this.invulnerable = 0.45
    this.trauma = Math.min(1, this.trauma + 0.45)
    this.hitStop = 0.05
    this.ui.hurt()
    sfx.hurt()
    buzz(45)
    this.bleed(p.x, 1.1, p.z, kx, kz, 6)
    if (p.hp <= 0) this.playerDies(kx, kz)
  }

  private playerDies(kx: number, kz: number) {
    const p = this.player
    this.mode = 'dead'
    this.gibFighter(p, kx * 0.6, kz * 0.6, true)
    this.slowTarget = 0.25
    this.trauma = 1
    buzz([80, 40, 160])
    sfx.explosion()
    const record = this.score > this.best.score
    if (record) {
      this.best = { score: this.score, wave: this.wave }
      saveBest(this.best)
    }
    setTimeout(() => {
      this.ui.setPlaying(false)
      this.ui.gameOver({
        score: this.score, wave: this.wave, kills: this.kills, best: record,
        onRetry: () => this.start(),
        onMenu: () => this.showTitle(),
      })
    }, 1800)
  }

  // Which body part a hit lands on: a weighted roll, the head being the critical one.
  private rollPart(f: Fighter) {
    const roll = Math.random()
    if (roll < 0.1 + this.stats.crit) return P.head
    if (roll < 0.5) return P.torso
    const limbs = [P['upperArm.l'], P['foreArm.l'], P['upperArm.r'], P['foreArm.r'], P['thigh.l'], P['shin.l'], P['thigh.r'], P['shin.r']].filter((i) => !(f.missing & (1 << i)))
    return limbs.length ? limbs[Math.floor(Math.random() * limbs.length)] : P.torso
  }

  private damage(e: Fighter, amount: number, kx: number, kz: number, source: WeaponId | 'blast' | 'burn') {
    if (e.hp <= 0) return
    let part = P.torso
    let crit = false
    if (source !== 'burn') {
      part = this.rollPart(e)
      crit = part === P.head && source !== 'blast'
      if (crit) amount *= 2.2
      e.lastPart = part
      e.flash = 1
      const resist = e.kind === 'brute' || e.kind === 'boss' ? 0.25 : 1
      e.kx += kx * resist
      e.kz += kz * resist
      e.stagger = 0.12
      this.bleed(e.x, rand(0.8, 1.4) * e.scale, e.z, kx, kz, Math.min(10, 2 + amount / 12))
      this.ui.float(e.x + rand(-0.3, 0.3), 1.9 * e.scale, e.z, `${Math.round(amount)}`, crit ? 'crit' : 'dmg', 0.6)
      sfx.hit()
    }
    if (source === 'flamer') e.burn = 2
    e.hp -= amount
    // Big hits can take a limb off without killing: the fighter keeps coming, slower or unarmed.
    if (e.hp > 0 && part !== P.torso && part !== P.head && amount > 30 && Math.random() < 0.25 && e.kind !== 'boss') {
      this.detach(e, part, kx, kz)
    }
    if (e.hp <= 0) this.kill(e, kx, kz, source, crit)
  }

  private detach(e: Fighter, part: number, kx: number, kz: number) {
    const child = part === P['upperArm.l'] || part === P['upperArm.r'] || part === P['thigh.l'] || part === P['thigh.r'] ? part + 1 : -1
    const world = solvePose(this.baseMatrix(e), e.pose)
    for (const i of child >= 0 ? [part, child] : [part]) {
      if (e.missing & (1 << i)) continue
      e.missing |= 1 << i
      this.addGib(i, world[i], e.colour, kx * 0.6 + rand(-2, 2), rand(3, 6), kz * 0.6 + rand(-2, 2))
    }
    this.ui.float(e.x, 2.1 * e.scale, e.z, `${PART_LABEL[PARTS[part]]} irti!`, 'gore', 0.9)
    this.bleed(e.x, 1.2 * e.scale, e.z, kx, kz, 14)
  }

  private kill(e: Fighter, kx: number, kz: number, source: WeaponId | 'blast' | 'burn', crit = false) {
    e.hp = 0
    this.kills++
    this.combo = Math.min(99, this.combo + 1)
    this.comboTimer = COMBO_WINDOW
    this.multiKill++
    this.multiTimer = 0.35
    if (this.combo > 1 && this.combo % 5 === 0) sfx.combo(this.combo / 5)
    const def = ENEMY[e.kind as Exclude<Kind, 'player'>]
    const multiplier = 1 + Math.floor(this.combo / 5) * 0.5
    this.score += Math.round(def.score * multiplier * (e.elite ? 3 : 1))
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.stats.vampire)

    const violent = source === 'blast' || source === 'rocket' || source === 'shotgun' || source === 'rail' || e.kind === 'bomber'
    this.gibFighter(e, kx, kz, violent)
    if (crit && !violent) {
      this.ui.float(e.x, 2.3, e.z, 'PÄÄOSUMA!', 'gore', 1)
    }
    sfx.splat()
    this.hitStop = Math.max(this.hitStop, e.kind === 'boss' ? 0.3 : violent ? 0.045 : 0.025)
    this.trauma = Math.min(1, this.trauma + (e.kind === 'boss' ? 1 : 0.12))
    buzz(e.kind === 'boss' ? [60, 30, 120] : 12)

    // Loot: coins burst out and fly to the player; sometimes health, ammo, armour or a weapon.
    const coins = Math.min(12, Math.ceil(e.value * multiplier / 2))
    const total = Math.round(e.value * multiplier)
    for (let i = 0; i < coins; i++) {
      this.pickups.push({ kind: 'coin', x: e.x + rand(-0.3, 0.3), z: e.z + rand(-0.3, 0.3), y: 1, vy: rand(3, 6), value: Math.max(1, Math.round(total / coins)), age: -i * 0.02 })
    }
    const roll = Math.random()
    if (roll < 0.06) this.pickups.push({ kind: 'health', x: e.x, z: e.z, y: 1, vy: 4, value: 30, age: 0 })
    else if (roll < 0.13) this.pickups.push({ kind: 'ammo', x: e.x, z: e.z, y: 1, vy: 4, value: 1, age: 0 })
    else if (roll < 0.15 || e.kind === 'boss') {
      const locked = WEAPON_ORDER.filter((id) => !this.owned.has(id))
      if (locked.length) this.pickups.push({ kind: 'weapon', x: e.x, z: e.z, y: 1, vy: 5, value: 1, weapon: locked[Math.floor(Math.random() * locked.length)], age: 0 })
      else this.pickups.push({ kind: 'armor', x: e.x, z: e.z, y: 1, vy: 4, value: 40, age: 0 })
    }

    if (e.kind === 'bomber') this.pendingBlasts.push({ x: e.x, z: e.z, r: 2.6, damage: 45, time: 0.05 })
    else if (this.stats.chainExplode > 0 && Math.random() < this.stats.chainExplode) this.pendingBlasts.push({ x: e.x, z: e.z, r: 2.2, damage: 50, time: 0.12 })

    // The last enemy of the wave goes down in slow motion.
    if (!this.toSpawn.length && !this.portals.length && this.enemies.filter((o) => o.hp > 0).length === 0) {
      this.slowTarget = 0.2
      this.timeScale = 0.2
      setTimeout(() => (this.slowTarget = 1), 900)
    }
  }

  // Turns a fighter into flying body parts. Violent deaths throw every part; others crumple, with
  // the last hit part knocked loose.
  private gibFighter(f: Fighter, kx: number, kz: number, violent: boolean) {
    const world = solvePose(this.baseMatrix(f), f.pose)
    const colour = f.colour.clone().multiplyScalar(0.85)
    for (let i = 0; i < PARTS.length; i++) {
      if (f.missing & (1 << i)) continue
      const power = violent ? rand(4, 9) : i === f.lastPart ? rand(2, 4) : rand(0.3, 1.2)
      const up = violent ? rand(4, 9) : i === f.lastPart ? rand(3, 5) : rand(0, 1.5)
      const angle = Math.random() * Math.PI * 2
      this.addGib(i, world[i], colour, kx * 0.4 + Math.cos(angle) * power, up, kz * 0.4 + Math.sin(angle) * power)
    }
    this.bleed(f.x, 1, f.z, kx, kz, violent ? 40 : 18)
    this.floor.splat(f.x, f.z, violent ? 1.1 : 0.7, 0.85, true)
  }

  private addGib(part: number, world: Matrix4, colour: Color, vx: number, vy: number, vz: number) {
    if (this.gibs.length >= MAX_GIBS) this.gibs.shift()
    const p = new Vector3()
    const q = new Quaternion()
    const s = new Vector3()
    world.decompose(p, q, s)
    const centre = this.figureData.centres[part].clone().applyMatrix4(world)
    this.gibs.push({
      part, p: centre, q, v: new Vector3(vx, vy, vz), w: new Vector3(rand(-12, 12), rand(-12, 12), rand(-12, 12)), scale: s.x, colour,
      age: 0, bleed: 1.2, rest: false,
    })
  }

  private updateGibs(dt: number) {
    for (const g of this.gibs) {
      g.age += dt
      if (g.rest) continue
      g.v.y -= GRAVITY * dt
      g.p.addScaledVector(g.v, dt)
      const floor = this.figureData.radii[g.part] * g.scale
      if (solid(tileAt(this.level, g.p.x, g.p.z)) && g.p.y < 1.3) {
        g.p.x -= g.v.x * dt
        g.p.z -= g.v.z * dt
        g.v.x *= -0.4
        g.v.z *= -0.4
      }
      if (g.p.y < floor) {
        g.p.y = floor
        if (g.v.y < -3) this.floor.splat(g.p.x, g.p.z, 0.25 * g.scale, 0.6)
        else if (Math.hypot(g.v.x, g.v.z) > 1) this.floor.streak(g.p.x, g.p.z, -g.v.x * dt * 2, -g.v.z * dt * 2, 0.12 * g.scale)
        g.v.y *= -0.25
        g.v.x *= 0.7
        g.v.z *= 0.7
        g.w.multiplyScalar(0.6)
        if (g.v.lengthSq() < 0.05) g.rest = true
      }
      // Integrate the spin.
      const angle = g.w.length() * dt
      if (angle > 0) {
        q4.setFromAxisAngle(v3.copy(g.w).normalize(), angle)
        g.q.premultiply(q4)
      }
      if (g.bleed > 0) {
        g.bleed -= dt
        if (Math.random() < 0.5) this.particles.spawn({ channel: LIT, x: g.p.x, y: g.p.y, z: g.p.z, vx: rand(-0.5, 0.5), vy: rand(0, 1), vz: rand(-0.5, 0.5), gravity: GRAVITY, colour: '#7a0a0e', size: 0.07, life: 2, blood: true })
      }
    }
  }

  private bleed(x: number, y: number, z: number, kx: number, kz: number, count: number) {
    const l = Math.hypot(kx, kz) || 1
    for (let i = 0; i < count; i++) {
      const s = rand(1, 5)
      this.particles.spawn({
        channel: LIT, x, y, z, vx: (kx / l) * s + rand(-2, 2), vy: rand(1, 5), vz: (kz / l) * s + rand(-2, 2), gravity: GRAVITY,
        colour: Math.random() < 0.5 ? '#8c0c12' : '#b0141a', size: rand(0.05, 0.13), life: 2, blood: true,
      })
    }
  }

  // --- Projectiles and explosions ------------------------------------------------------------------

  private updateProjectiles(dt: number) {
    const p = this.player
    for (const b of this.projectiles) {
      b.life -= dt
      const steps = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vz) * dt) / 0.2))
      let dead = false
      for (let s = 0; s < steps && !dead; s++) {
        const px = b.x
        const pz = b.z
        b.x += (b.vx * dt) / steps
        b.z += (b.vz * dt) / steps
        const tile = tileAt(this.level, b.x, b.z)
        if (solid(tile)) {
          if (b.explode) {
            this.explode(px, pz, b.explode, b.damage, b.enemy)
            dead = true
          } else if (b.weapon === 'flamer') {
            dead = true
          } else {
            this.damageTile(b.x, b.z, b.damage)
            this.sparks(px, b.y, pz, tile === CRATE ? '#c9925a' : '#ffd890', 4)
            if (b.ricochet > 0 && tile === WALL) {
              b.ricochet--
              // Reflect on the axis that crossed into the wall.
              if (Math.floor(px) !== Math.floor(b.x)) b.vx = -b.vx
              if (Math.floor(pz) !== Math.floor(b.z)) b.vz = -b.vz
              b.x = px
              b.z = pz
            } else dead = true
          }
          continue
        }
        if (b.enemy) {
          if (Math.hypot(p.x - b.x, p.z - b.z) < p.radius + 0.1 && this.mode === 'play') {
            if (this.invulnerable > 0) continue
            if (b.explode) this.explode(b.x, b.z, b.explode, b.damage, true)
            else this.hurtPlayer(b.damage, b.vx * 0.15, b.vz * 0.15)
            dead = true
          }
          continue
        }
        for (const e of this.enemies) {
          if (e.hp <= 0 || b.hits.includes(e)) continue
          if (Math.hypot(e.x - b.x, e.z - b.z) > e.radius * e.scale + 0.12) continue
          if (b.explode) {
            this.explode(b.x, b.z, b.explode, b.damage, false)
            dead = true
            break
          }
          const l = Math.hypot(b.vx, b.vz) || 1
          b.hits.push(e)
          this.damage(e, b.damage, (b.vx / l) * b.knockback, (b.vz / l) * b.knockback, b.weapon as WeaponId)
          if (b.pierce-- <= 0) {
            dead = true
            break
          }
        }
      }
      if (dead || b.life <= 0) {
        if (!dead && b.explode) this.explode(b.x, b.z, b.explode, b.damage, b.enemy)
        b.life = 0
        continue
      }
      // Trails.
      if (b.weapon === 'rocket' || b.weapon === 'rocketEnemy') {
        this.particles.spawn({ channel: LIT, x: b.x, y: b.y, z: b.z, vy: rand(0.2, 0.8), colour: '#9a948c', size: 0.12, grow: 0.4, life: 0.45, drag: 2 })
        this.particles.spawn({ x: b.x, y: b.y, z: b.z, colour: '#ffb050', size: 0.25, life: 0.08 })
      }
      if (b.weapon === 'flamer') {
        const t = 1 - b.life / WEAPONS.flamer.life
        if (Math.random() < 0.7) {
          this.particles.spawn({ x: b.x, y: b.y + t * 0.4, z: b.z, vx: b.vx * 0.3, vy: rand(0.5, 1.5), vz: b.vz * 0.3, colour: t < 0.3 ? '#ffe28a' : t < 0.6 ? '#ff8a2a' : '#c93a1a', size: 0.15 + t * 0.6, life: 0.12, drag: 2 })
        }
      }
    }
    this.projectiles = this.projectiles.filter((b) => b.life > 0)
  }

  private sparks(x: number, y: number, z: number, colour: string, count: number) {
    for (let i = 0; i < count; i++) this.particles.spawn({ x, y, z, vx: rand(-4, 4), vy: rand(0, 4), vz: rand(-4, 4), gravity: GRAVITY, colour, size: 0.06, life: 0.3 })
  }

  private damageTile(x: number, z: number, amount: number) {
    const tx = Math.floor(x)
    const tz = Math.floor(z)
    if (tx < 0 || tz < 0 || tx >= SIZE || tz >= SIZE) return
    const i = tz * SIZE + tx
    const tile = this.level.tiles[i]
    if (tile !== CRATE && tile !== BARREL) return
    this.level.hp[i] -= amount
    if (this.level.hp[i] > 0) return
    this.level.tiles[i] = EMPTY
    this.tilesDirty = true
    this.flowTimer = 0
    sfx.crate()
    for (let k = 0; k < 10; k++) {
      this.particles.spawn({ channel: CHUNK, x: tx + 0.5, y: rand(0.2, 0.8), z: tz + 0.5, vx: rand(-4, 4), vy: rand(2, 6), vz: rand(-4, 4), gravity: GRAVITY, colour: tile === CRATE ? '#a8733d' : '#c9302c', size: rand(0.1, 0.25), life: 3, spin: 10 })
    }
    if (tile === BARREL) this.pendingBlasts.push({ x: tx + 0.5, z: tz + 0.5, r: 3.4, damage: 80, time: 0.08 })
    else if (Math.random() < 0.3) this.pickups.push({ kind: Math.random() < 0.5 ? 'coin' : 'ammo', x: tx + 0.5, z: tz + 0.5, y: 0.6, vy: 4, value: 5, age: 0 })
  }

  private explode(x: number, z: number, radius: number, damage: number, byEnemy: boolean) {
    sfx.explosion()
    buzz(35)
    this.trauma = Math.min(1, this.trauma + 0.55)
    this.hitStop = Math.max(this.hitStop, 0.05)
    const light = this.blastLights.find((l) => l.intensity < 1) ?? this.blastLights[0]
    light.position.set(x, 1.5, z)
    light.intensity = 60
    this.floor.scorch(x, z, radius * 0.8)
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2
      const s = rand(2, 9)
      this.particles.spawn({ x, y: rand(0.3, 1.2), z, vx: Math.cos(a) * s, vy: rand(1, 6), vz: Math.sin(a) * s, colour: Math.random() < 0.5 ? '#ffd27a' : '#ff6a2a', size: rand(0.3, 0.7), life: rand(0.25, 0.5), drag: 4 })
    }
    for (let i = 0; i < 12; i++) {
      this.particles.spawn({ channel: LIT, x: x + rand(-1, 1), y: rand(0.4, 1.4), z: z + rand(-1, 1), vx: rand(-1.5, 1.5), vy: rand(0.5, 2), vz: rand(-1.5, 1.5), colour: '#55504a', size: rand(0.3, 0.6), grow: 0.5, life: rand(0.6, 1.1), drag: 2 })
    }
    for (const e of [...this.enemies]) {
      const d = Math.hypot(e.x - x, e.z - z)
      if (d > radius + e.radius * e.scale) continue
      const falloff = 1 - Math.min(1, d / (radius + 0.5)) * 0.6
      const l = d || 1
      this.damage(e, damage * falloff * (byEnemy ? 0.5 : 1), ((e.x - x) / l) * 12, ((e.z - z) / l) * 12, 'blast')
    }
    const p = this.player
    const d = Math.hypot(p.x - x, p.z - z)
    if (d < radius && this.mode === 'play') {
      const l = d || 1
      this.hurtPlayer(damage * (1 - d / radius) * (byEnemy ? 0.6 : 0.35), ((p.x - x) / l) * 10, ((p.z - z) / l) * 10)
    }
    for (const g of this.gibs) {
      const gd = g.p.distanceTo(v3.set(x, 0.5, z))
      if (gd < radius * 1.5) {
        g.rest = false
        g.v.x += ((g.p.x - x) / (gd || 1)) * 8
        g.v.z += ((g.p.z - z) / (gd || 1)) * 8
        g.v.y += rand(4, 8)
      }
    }
    for (let tz = Math.floor(z - radius); tz <= Math.floor(z + radius); tz++) {
      for (let tx = Math.floor(x - radius); tx <= Math.floor(x + radius); tx++) {
        if (Math.hypot(tx + 0.5 - x, tz + 0.5 - z) < radius) this.damageTile(tx + 0.5, tz + 0.5, damage)
      }
    }
  }

  private updateGrenades(dt: number) {
    for (const g of this.grenades) {
      g.fuse -= dt
      g.vy -= GRAVITY * dt
      const nx = g.x + g.vx * dt
      const nz = g.z + g.vz * dt
      if (solid(tileAt(this.level, nx, g.z))) g.vx *= -0.5
      else g.x = nx
      if (solid(tileAt(this.level, g.x, nz))) g.vz *= -0.5
      else g.z = nz
      g.y += g.vy * dt
      if (g.y < 0.12) {
        g.y = 0.12
        g.vy *= -0.4
        g.vx *= 0.7
        g.vz *= 0.7
      }
      if (Math.random() < 0.3) this.particles.spawn({ x: g.x, y: g.y + 0.1, z: g.z, colour: '#ff4030', size: 0.08, life: 0.1 })
      if (g.fuse <= 0) this.explode(g.x, g.z, 3.6, 120, false)
    }
    this.grenades = this.grenades.filter((g) => g.fuse > 0)
  }

  // --- Pickups -----------------------------------------------------------------------------------

  private updatePickups(dt: number) {
    const p = this.player
    const vacuum = this.waveCleared
    for (const k of this.pickups) {
      k.age += dt
      k.vy -= GRAVITY * dt
      k.y = Math.max(k.kind === 'coin' ? 0.25 : 0.3, k.y + k.vy * dt)
      if (k.y <= 0.3 && k.vy < 0) k.vy *= -0.4
      const dx = p.x - k.x
      const dz = p.z - k.z
      const d = Math.hypot(dx, dz)
      // Coins home in on the player; at the end of a wave every pickup does.
      const magnet = k.kind === 'coin' ? this.stats.magnet : 1.2
      if ((d < magnet || vacuum) && k.age > 0.35 && this.mode === 'play') {
        const pull = vacuum ? 22 : 12 * (1 - d / (magnet + 0.01)) + 4
        k.x += (dx / (d || 1)) * Math.min(d, pull * dt)
        k.z += (dz / (d || 1)) * Math.min(d, pull * dt)
      }
      if (d < 0.5 && k.age > 0.35 && this.mode === 'play') {
        this.collect(k)
        k.age = -999
      }
    }
    this.pickups = this.pickups.filter((k) => k.age > -100 && k.age < (k.kind === 'coin' ? 30 : 45))
  }

  private collect(k: Pickup) {
    const p = this.player
    switch (k.kind) {
      case 'coin':
        this.money += k.value
        sfx.coin()
        return
      case 'health':
        p.hp = Math.min(p.maxHp, p.hp + k.value)
        this.ui.float(p.x, 2.2, p.z, `+${k.value} terveys`, 'heal')
        break
      case 'armor':
        this.armor = Math.min(100, this.armor + k.value)
        this.ui.float(p.x, 2.2, p.z, `+${k.value} liivit`, 'heal')
        break
      case 'ammo': {
        const owned = WEAPON_ORDER.filter((id) => this.owned.has(id) && id !== 'pistol')
        if (!owned.length) {
          this.money += 10
          this.ui.float(p.x, 2.2, p.z, '+€10', 'info')
        } else {
          const id = owned[Math.floor(Math.random() * owned.length)]
          this.ammo[id] = Math.min(WEAPONS[id].maxAmmo, this.ammo[id] + Math.ceil(WEAPONS[id].maxAmmo / 3))
          this.ui.float(p.x, 2.2, p.z, `${WEAPONS[id].name}: ammuksia`, 'info')
        }
        break
      }
      case 'weapon': {
        const id = k.weapon!
        this.owned.add(id)
        this.ammo[id] = Math.max(this.ammo[id], Math.ceil(WEAPONS[id].maxAmmo / 2))
        this.weapon = id
        this.ui.banner(WEAPONS[id].name.toUpperCase(), 'Uusi ase!', 1.2)
        break
      }
    }
    sfx.pickup()
    buzz(10)
  }

  // --- Waves and the shop ---------------------------------------------------------------------------

  private clearWave() {
    this.waveCleared = true
    this.score += this.wave * 250
    sfx.wave()
    this.ui.banner(`TASO ${this.wave} SELVÄ`, `+${this.wave * 250} pistettä`, 2)
    setTimeout(() => {
      if (this.mode !== 'play') return
      // Coins still on the floor go to the bank.
      for (const k of this.pickups) if (k.kind === 'coin') this.money += k.value
      this.mode = 'shop'
      this.shopPerks = pickPerks(this.perksTaken, Math.random)
      this.perkPicked = false
      this.ui.setPlaying(false)
      this.showShop()
    }, 2200)
  }

  private shopItems(): ShopItem[] {
    const p = this.player
    const items: ShopItem[] = []
    for (const id of WEAPON_ORDER) {
      const w = WEAPONS[id]
      if (id === 'pistol') continue
      if (!this.owned.has(id)) {
        items.push({ id: `weapon:${id}`, name: w.name, text: 'Uusi ase, puolet ammuksista', price: w.price, disabled: this.money < w.price })
      } else {
        const full = this.ammo[id] >= w.maxAmmo
        items.push({ id: `ammo:${id}`, name: `${w.name}: ammuksia`, text: `${this.ammo[id]} / ${w.maxAmmo}`, price: w.ammoPrice, disabled: full || this.money < w.ammoPrice })
      }
    }
    items.push({ id: 'health', name: 'Ensiapu', text: `+50 terveyttä (${Math.ceil(p.hp)} / ${p.maxHp})`, price: 40, disabled: p.hp >= p.maxHp || this.money < 40 })
    items.push({ id: 'armor', name: 'Luotiliivit', text: `+50 suojaa (${Math.round(this.armor)} / 100)`, price: 60, disabled: this.armor >= 100 || this.money < 60 })
    items.push({ id: 'grenade', name: 'Kranaatit', text: `+3 (${this.grenadeCount} / 9)`, price: 45, disabled: this.grenadeCount >= 9 || this.money < 45 })
    return items
  }

  private showShop() {
    this.ui.shop({
      wave: this.wave,
      money: this.money,
      perks: this.shopPerks,
      perkPicked: this.perkPicked,
      items: this.shopItems(),
      onPerk: (perk) => {
        if (this.perkPicked) return
        this.perkPicked = true
        perk.apply(this.stats)
        this.perksTaken[perk.id] = (this.perksTaken[perk.id] ?? 0) + 1
        this.player.maxHp = this.stats.maxHp
        if (perk.id === 'hp') this.player.hp = this.player.maxHp
        sfx.pickup()
        this.showShop()
      },
      onBuy: (id) => this.buy(id),
      onContinue: () => {
        sfx.click()
        this.nextWave()
      },
    })
  }

  private buy(id: string) {
    const item = this.shopItems().find((i) => i.id === id)
    if (!item || item.disabled) return
    this.money -= item.price
    const [type, weapon] = id.split(':') as [string, WeaponId]
    if (type === 'weapon') {
      this.owned.add(weapon)
      this.ammo[weapon] = Math.ceil(WEAPONS[weapon].maxAmmo / 2)
      this.weapon = weapon
    } else if (type === 'ammo') {
      this.ammo[weapon] = Math.min(WEAPONS[weapon].maxAmmo, this.ammo[weapon] + Math.ceil(WEAPONS[weapon].maxAmmo / 3))
    } else if (type === 'health') {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 50)
    } else if (type === 'armor') {
      this.armor = Math.min(100, this.armor + 50)
    } else if (type === 'grenade') {
      this.grenadeCount = Math.min(9, this.grenadeCount + 3)
    }
    sfx.coin()
    this.showShop()
  }

  private pause() {
    this.mode = 'pause'
    this.ui.setPlaying(false)
    this.ui.pause(
      () => {
        this.mode = 'play'
        this.lastFrame = performance.now()
        this.input.clearPresses()
        this.ui.hide()
        this.ui.setPlaying(true)
      },
      () => this.showTitle(),
      isMuted(),
      () => {
        setMuted(!isMuted())
        return isMuted()
      },
    )
  }

  // --- Rendering -----------------------------------------------------------------------------------

  private baseMatrix(f: Fighter) {
    q4.setFromAxisAngle(UP, f.yaw)
    return m4.compose(v3.set(f.x, 0, f.z), q4, s3.set(f.scale, f.scale, f.scale)).clone()
  }

  private toScreen(x: number, y: number, z: number) {
    v3.set(x, y, z).project(this.camera)
    return { x: (v3.x * 0.5 + 0.5) * this.container.clientWidth, y: (-v3.y * 0.5 + 0.5) * this.container.clientHeight }
  }

  private render(dt: number) {
    const p = this.player
    const playing = this.mode !== 'title'

    // Camera: leads in the aim direction, trails a little, shakes with trauma squared.
    if (playing) {
      const lead = this.mode === 'play' ? 2.4 : 0
      this.camTarget.x += (p.x + this.input.aim.x * lead - this.camTarget.x) * Math.min(1, dt * 5)
      this.camTarget.z += (p.z + this.input.aim.z * lead - this.camTarget.z) * Math.min(1, dt * 5)
    }
    const aspect = this.camera.aspect
    const distance = Math.min(24, Math.max(13, 13 / Math.min(1.2, aspect) ** 0.9))
    const shake = this.trauma * this.trauma
    this.trauma = Math.max(0, this.trauma - dt * 1.6)
    const t = this.time * 40
    const sx = (Math.sin(t * 1.1) + Math.sin(t * 2.3) * 0.5) * shake * 0.35 + this.camKick.x
    const sz = (Math.sin(t * 1.7 + 1) + Math.sin(t * 2.9) * 0.5) * shake * 0.35 + this.camKick.y
    this.camKick.multiplyScalar(Math.max(0, 1 - dt * 12))
    this.camera.position.set(this.camTarget.x + sx, distance * 0.86, this.camTarget.z + distance * 0.5 + sz)
    this.camera.lookAt(this.camTarget.x + sx, 0, this.camTarget.z + sz)
    this.camera.rotation.z += Math.sin(t * 1.3) * shake * 0.02
    this.sun.position.set(this.camTarget.x - 6, 14, this.camTarget.z + 4)
    this.sun.target.position.set(this.camTarget.x, 0, this.camTarget.z)

    this.muzzleLight.intensity *= Math.max(0, 1 - dt * 30)
    for (const light of this.blastLights) light.intensity *= Math.max(0, 1 - dt * 6)

    // Fighters.
    this.figures.begin()
    if (this.mode !== 'dead' && this.mode !== 'title') {
      const stride = Math.min(1, Math.hypot(p.vx, p.vz) / this.stats.speed)
      animate(p.pose, 'aim', p.phase, stride, p.recoil, this.time)
      const blink = this.invulnerable > 0 && this.dashTimer <= 0 && Math.floor(this.time * 30) % 2 === 0
      tmpColour.copy(p.colour).lerp(WHITE, Math.max(0, p.flash))
      if (this.dashTimer > 0) tmpColour.set('#9ff0ff')
      if (!blink) this.figures.addFighter(solvePose(this.baseMatrix(p), p.pose), tmpColour, p.missing, true)
      this.ring.visible = true
      this.ring.position.set(p.x, 0.03, p.z)
    } else this.ring.visible = false
    for (const e of this.enemies) {
      const stride = Math.min(1, Math.hypot(e.vx, e.vz) / Math.max(1, e.speed * 0.7))
      const stance = ENEMY[e.kind as Exclude<Kind, 'player'>].stance
      const windup = e.windup > 0 && stance !== 'aim' ? -0.8 : 0
      animate(e.pose, stance, e.phase, stride, e.recoil + windup, this.time)
      tmpColour.copy(e.colour)
      if (e.kind === 'bomber') tmpColour.lerp(BURN, (Math.sin(this.time * 18) * 0.5 + 0.5) * 0.7)
      if (e.burn > 0) tmpColour.lerp(BURN, 0.5)
      tmpColour.lerp(WHITE, Math.max(0, e.flash))
      this.figures.addFighter(solvePose(this.baseMatrix(e), e.pose), tmpColour, e.missing, stance === 'aim')
    }
    for (const g of this.gibs) {
      const sink = g.age > 20 ? (g.age - 20) * 0.3 : 0
      if (sink > 0.6) continue
      const centre = this.figureData.centres[g.part]
      m4.compose(v3.copy(g.p).setY(g.p.y - sink), g.q, s3.set(g.scale, g.scale, g.scale))
      m4.multiply(this.recentre.makeTranslation(-centre.x, -centre.y, -centre.z))
      this.figures.addPart(g.part, m4, g.colour)
    }
    this.gibs = this.gibs.filter((g) => g.age < 22)
    this.figures.end()

    // Projectiles as tracers.
    for (const b of this.projectiles) {
      if (b.weapon === 'flamer') continue
      const l = Math.hypot(b.vx, b.vz) || 1
      const length = b.weapon === 'rocket' || b.weapon === 'rocketEnemy' ? 0.5 : b.weapon === 'enemy' ? 0.5 : 0.9
      const colour = b.enemy ? tmpColour.set('#ff4a3a') : tmpColour.set(WEAPONS[b.weapon as WeaponId].colour)
      this.beams.draw(b.x - (b.vx / l) * length, b.z - (b.vz / l) * length, b.x, b.z, b.y, b.weapon === 'rocket' || b.weapon === 'rocketEnemy' ? 0.16 : b.enemy ? 0.11 : 0.07, colour)
    }
    this.beams.render()
    this.particles.render(this.time)
    this.floor.flush(this.frame)
    this.renderTiles()
    this.renderPickups()

    // Off-screen enemy markers.
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    const markers: { x: number; y: number; angle: number; boss: boolean; d: number }[] = []
    if (this.mode === 'play') {
      const centre = this.toScreen(p.x, 1, p.z)
      for (const e of this.enemies) {
        const s = this.toScreen(e.x, 1, e.z)
        if (s.x > 0 && s.x < width && s.y > 0 && s.y < height) continue
        const angle = Math.atan2(s.y - centre.y, s.x - centre.x)
        const margin = 22
        const tx = Math.max(margin, Math.min(width - margin, s.x))
        const ty = Math.max(margin + 40, Math.min(height - margin, s.y))
        markers.push({ x: tx, y: ty, angle, boss: e.kind === 'boss', d: Math.hypot(e.x - p.x, e.z - p.z) })
      }
      markers.sort((a, b) => a.d - b.d)
    }
    this.ui.markers(markers.slice(0, 6))
    this.ui.updateFloats(dt, (x, y, z) => this.toScreen(x, y, z))
    if (this.mode === 'play' || this.mode === 'dead') {
      this.ui.hud({
        hp: p.hp, maxHp: p.maxHp, armor: this.armor, money: this.money, score: this.score, wave: this.wave,
        enemiesLeft: this.enemies.length + this.portals.length + this.toSpawn.length, weapon: this.weapon, ammo: this.ammo[this.weapon],
        grenades: this.grenadeCount, combo: this.combo, comboTime: this.comboTimer / COMBO_WINDOW, dash: this.dashCharge,
      })
    }
    this.renderer.render(this.scene, this.camera)
  }

  private renderTiles() {
    if (!this.tilesDirty) return
    this.tilesDirty = false
    const counts = [0, 0, 0]
    const meshes = [this.wallMesh, this.crateMesh, this.barrelMesh]
    const { tiles, size } = this.level
    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        const tile = tiles[z * size + x]
        if (tile === EMPTY) continue
        const index = tile === WALL ? 0 : tile === CRATE ? 1 : 2
        const mesh = meshes[index]
        if (counts[index] >= mesh.instanceMatrix.count) continue
        e3.set(0, tile === CRATE ? ((x * 7 + z * 13) % 5) * 0.08 : 0, 0)
        q4.setFromEuler(e3)
        m4.compose(v3.set(x + 0.5, 0, z + 0.5), q4, s3.set(1, 1, 1))
        mesh.setMatrixAt(counts[index]++, m4)
      }
    }
    meshes.forEach((mesh, i) => {
      mesh.count = counts[i]
      mesh.instanceMatrix.needsUpdate = true
    })
  }

  private renderPickups() {
    let coins = 0
    let boxes = 0
    const colours = { health: '#e8384a', ammo: '#6bbf59', armor: '#4a8ae8', weapon: '#58e0ff' }
    for (const k of this.pickups) {
      const bob = Math.sin(this.time * 4 + k.x) * 0.06
      if (k.kind === 'coin') {
        if (coins >= this.coinMesh.instanceMatrix.count) continue
        q4.setFromAxisAngle(UP, this.time * 5 + k.x * 3)
        m4.compose(v3.set(k.x, k.y + bob, k.z), q4, s3.set(1, 1, 1))
        this.coinMesh.setMatrixAt(coins++, m4)
      } else {
        if (boxes >= this.pickupMesh.instanceMatrix.count) continue
        q4.setFromAxisAngle(UP, this.time * 2)
        const pulse = 1 + Math.sin(this.time * 6) * 0.08
        m4.compose(v3.set(k.x, k.y + 0.1 + bob, k.z), q4, s3.set(pulse, pulse, pulse))
        this.pickupMesh.setMatrixAt(boxes, m4)
        this.pickupMesh.setColorAt(boxes++, tmpColour.set(colours[k.kind]))
      }
    }
    this.coinMesh.count = coins
    this.coinMesh.instanceMatrix.needsUpdate = true
    this.pickupMesh.count = boxes
    this.pickupMesh.instanceMatrix.needsUpdate = true
    if (this.pickupMesh.instanceColor) this.pickupMesh.instanceColor.needsUpdate = true

    let grenades = 0
    for (const g of this.grenades) {
      m4.compose(v3.set(g.x, g.y, g.z), q4.identity(), s3.set(1, 1, 1))
      this.grenadeMesh.setMatrixAt(grenades++, m4)
    }
    this.grenadeMesh.count = grenades
    this.grenadeMesh.instanceMatrix.needsUpdate = true

    let portals = 0
    for (const portal of this.portals) {
      const s = 0.4 + (1 - portal.time) * 1.2
      q4.setFromAxisAngle(UP, this.time * 4)
      m4.compose(v3.set(portal.x, 0.05, portal.z), q4, s3.set(s, 1, s))
      this.portalMesh.setMatrixAt(portals++, m4)
    }
    this.portalMesh.count = portals
    this.portalMesh.instanceMatrix.needsUpdate = true
  }
}

function distanceToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax
  const dz = bz - az
  const l2 = dx * dx + dz * dz
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t))
}
