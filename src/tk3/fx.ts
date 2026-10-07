// Effects: particles (sparks, flames, smoke, blood, shells), the floor that keeps every splat and
// scorch mark for the rest of the wave, beams and tracers.

import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  Mesh,
  Quaternion,
  type Scene,
  SRGBColorSpace,
  Vector3,
  Euler,
} from 'three'

export const GLOW = 0 // Unlit, additive: sparks, flames, muzzle flashes.
export const LIT = 1 // Lit blobs: smoke, blood drops, gore.
export const CHUNK = 2 // Lit boxes: shells, wood splinters, concrete.

type Particle = {
  channel: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  maxLife: number
  size: number
  grow: number
  gravity: number
  drag: number
  colour: Color
  blood: boolean // Paints the floor when it lands.
  spin: number
}

const MAX_PARTICLES = 1400

// Particles share one Color per hex string instead of allocating one each.
const palette = new Map<string, Color>()
const cached = (hex: string) => palette.get(hex) ?? palette.set(hex, new Color(hex)).get(hex)!

export class Particles {
  private list: Particle[] = []
  private meshes: InstancedMesh[]
  private m = new Matrix4()
  private q = new Quaternion()
  private e = new Euler()
  private s = new Vector3()
  private p = new Vector3()
  onLand: ((x: number, z: number, size: number) => void) | null = null

  constructor(scene: Scene) {
    const glow = new MeshBasicMaterial({ color: '#ffffff', blending: AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })
    const lit = new MeshLambertMaterial({ color: '#ffffff' })
    const ico = new IcosahedronGeometry(0.5, 0)
    const box = new BoxGeometry(1, 1, 1)
    this.meshes = [
      new InstancedMesh(ico, glow, MAX_PARTICLES),
      new InstancedMesh(ico, lit, MAX_PARTICLES),
      new InstancedMesh(box, lit, MAX_PARTICLES),
    ]
    for (const mesh of this.meshes) {
      mesh.instanceMatrix.setUsage(DynamicDrawUsage)
      mesh.setColorAt(0, new Color())
      mesh.frustumCulled = false
      scene.add(mesh)
    }
  }

  get count() {
    return this.list.length
  }

  spawn(p: Partial<Omit<Particle, 'colour'>> & { x: number; y: number; z: number; colour: Color | string }) {
    if (this.list.length >= MAX_PARTICLES) this.list.shift()
    const life = p.life ?? 0.5
    this.list.push({
      channel: p.channel ?? GLOW,
      x: p.x,
      y: p.y,
      z: p.z,
      vx: p.vx ?? 0,
      vy: p.vy ?? 0,
      vz: p.vz ?? 0,
      life,
      maxLife: life,
      size: p.size ?? 0.1,
      grow: p.grow ?? 0,
      gravity: p.gravity ?? 0,
      drag: p.drag ?? 0,
      colour: typeof p.colour === 'string' ? cached(p.colour) : p.colour.clone(),
      blood: p.blood ?? false,
      spin: p.spin ?? 0,
    })
  }

  update(dt: number) {
    let write = 0
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i]
      p.life -= dt
      p.vy -= p.gravity * dt
      const drag = Math.max(0, 1 - p.drag * dt)
      p.vx *= drag
      p.vz *= drag
      p.vy *= p.gravity ? 1 : drag
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      p.size += p.grow * dt
      if (p.y < 0.02 && p.gravity) {
        if (p.blood) {
          this.onLand?.(p.x, p.z, p.size)
          continue
        }
        p.y = 0.02
        p.vy *= -0.3
        p.vx *= 0.6
        p.vz *= 0.6
      }
      if (p.life <= 0 || p.size <= 0) continue
      this.list[write++] = p
    }
    this.list.length = write
  }

  render(time: number) {
    const counts = [0, 0, 0]
    for (const p of this.list) {
      const mesh = this.meshes[p.channel]
      const i = counts[p.channel]++
      // Glow fades out by shrinking; lit blobs (smoke, blood) shrink away in the last part of their life.
      const fade = Math.min(1, (p.life / p.maxLife) * (p.channel === GLOW ? 1.5 : 2.5))
      const size = p.size * (p.channel === CHUNK ? 1 : fade)
      this.e.set(p.spin * time, p.spin * time * 0.7, 0)
      this.q.setFromEuler(this.e)
      this.s.set(size, size, p.channel === CHUNK ? size * 0.5 : size)
      this.p.set(p.x, p.y, p.z)
      this.m.compose(this.p, this.q, this.s)
      mesh.setMatrixAt(i, this.m)
      mesh.setColorAt(i, p.colour)
    }
    this.meshes.forEach((mesh, c) => {
      mesh.count = counts[c]
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    })
  }

  clear() {
    this.list.length = 0
  }
}

// The floor is a canvas: concrete slabs drawn once, and blood and scorch marks painted on top for
// as long as the wave lasts.
export class Floor {
  mesh: Mesh
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private texture: CanvasTexture
  private scale: number
  private dirty = false
  private base: ImageData | null = null
  private size: number

  constructor(scene: Scene, size: number) {
    this.size = size
    this.scale = Math.min(48, Math.floor(2048 / size))
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.canvas.height = size * this.scale
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!
    this.texture = new CanvasTexture(this.canvas)
    this.texture.colorSpace = SRGBColorSpace
    this.texture.anisotropy = 4
    this.mesh = new Mesh(new PlaneGeometry(size, size), new MeshLambertMaterial({ map: this.texture }))
    this.mesh.rotation.x = -Math.PI / 2
    this.mesh.position.set(size / 2, 0, size / 2)
    this.mesh.receiveShadow = true
    scene.add(this.mesh)
  }

  // Concrete slabs with a few stains; done once per level layout.
  paintBase(seed: () => number) {
    const { ctx, scale, size } = this
    ctx.fillStyle = '#4a4540'
    ctx.fillRect(0, 0, size * scale, size * scale)
    for (let z = 0; z < size; z += 2) {
      for (let x = 0; x < size; x += 2) {
        const shade = 64 + Math.floor(seed() * 14)
        ctx.fillStyle = `rgb(${shade + 6}, ${shade}, ${shade - 6})`
        ctx.fillRect(x * scale + 1, z * scale + 1, scale * 2 - 2, scale * 2 - 2)
      }
    }
    for (let i = 0; i < size * 3; i++) {
      ctx.fillStyle = `rgba(20, 16, 12, ${0.05 + seed() * 0.08})`
      ctx.beginPath()
      ctx.arc(seed() * size * scale, seed() * size * scale, (0.3 + seed() * 1.4) * scale, 0, Math.PI * 2)
      ctx.fill()
    }
    this.base = ctx.getImageData(0, 0, size * scale, size * scale)
    this.dirty = true
  }

  reset() {
    if (this.base) this.ctx.putImageData(this.base, 0, 0)
    this.dirty = true
  }

  splat(x: number, z: number, radius: number, alpha = 0.8, dark = false) {
    const { ctx, scale } = this
    const cx = x * scale
    const cz = z * scale
    const r = radius * scale
    ctx.fillStyle = dark ? `rgba(70, 6, 8, ${alpha})` : `rgba(120, 8, 12, ${alpha})`
    ctx.beginPath()
    ctx.ellipse(cx, cz, r, r * (0.7 + Math.random() * 0.3), Math.random() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2
      const d = r * (1 + Math.random() * 1.5)
      ctx.beginPath()
      ctx.arc(cx + Math.cos(a) * d, cz + Math.sin(a) * d, r * 0.25 * Math.random() + 1, 0, Math.PI * 2)
      ctx.fill()
    }
    this.dirty = true
  }

  // A smear in the direction a body slid.
  streak(x: number, z: number, dx: number, dz: number, width: number) {
    const { ctx, scale } = this
    ctx.strokeStyle = 'rgba(110, 8, 10, 0.5)'
    ctx.lineWidth = width * scale
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x * scale, z * scale)
    ctx.lineTo((x + dx) * scale, (z + dz) * scale)
    ctx.stroke()
    this.dirty = true
  }

  scorch(x: number, z: number, radius: number) {
    const { ctx, scale } = this
    const gradient = ctx.createRadialGradient(x * scale, z * scale, 0, x * scale, z * scale, radius * scale)
    gradient.addColorStop(0, 'rgba(10, 8, 6, 0.85)')
    gradient.addColorStop(0.6, 'rgba(20, 14, 10, 0.5)')
    gradient.addColorStop(1, 'rgba(20, 14, 10, 0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(x * scale, z * scale, radius * scale, 0, Math.PI * 2)
    ctx.fill()
    this.dirty = true
  }

  // Uploads the canvas at most every few frames; texture uploads are the expensive part.
  flush(frame: number) {
    if (this.dirty && frame % 3 === 0) {
      this.texture.needsUpdate = true
      this.dirty = false
    }
  }
}

type Beam = { ax: number; az: number; bx: number; bz: number; y: number; life: number; maxLife: number; width: number; colour: Color }

// Glowing boxes stretched between two points: tracers, the rail beam, aim lasers.
export class Beams {
  private list: Beam[] = []
  private mesh: InstancedMesh
  private m = new Matrix4()
  private q = new Quaternion()
  private s = new Vector3()
  private p = new Vector3()
  private up = new Vector3(0, 1, 0)

  constructor(scene: Scene, capacity = 600) {
    this.mesh = new InstancedMesh(
      new BoxGeometry(1, 1, 1),
      new MeshBasicMaterial({ color: '#ffffff', blending: AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }),
      capacity,
    )
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    this.mesh.setColorAt(0, new Color())
    this.mesh.frustumCulled = false
    scene.add(this.mesh)
  }

  add(ax: number, az: number, bx: number, bz: number, y: number, life: number, width: number, colour: Color) {
    this.list.push({ ax, az, bx, bz, y, life, maxLife: life, width, colour })
  }

  // Beams that live a single frame (tracers of moving bullets, lasers) go through here.
  private frameBeams: Beam[] = []
  draw(ax: number, az: number, bx: number, bz: number, y: number, width: number, colour: Color) {
    this.frameBeams.push({ ax, az, bx, bz, y, life: 1, maxLife: 1, width, colour })
  }

  update(dt: number) {
    this.list = this.list.filter((b) => (b.life -= dt) > 0)
  }

  render() {
    let i = 0
    const capacity = this.mesh.instanceMatrix.count
    for (const b of [...this.list, ...this.frameBeams]) {
      if (i >= capacity) break
      const dx = b.bx - b.ax
      const dz = b.bz - b.az
      const length = Math.hypot(dx, dz)
      if (length < 1e-4) continue
      const width = b.width * (b.life / b.maxLife)
      this.q.setFromAxisAngle(this.up, Math.atan2(dx, dz))
      this.p.set((b.ax + b.bx) / 2, b.y, (b.az + b.bz) / 2)
      this.s.set(width, width, length)
      this.m.compose(this.p, this.q, this.s)
      this.mesh.setMatrixAt(i, this.m)
      this.mesh.setColorAt(i, b.colour)
      i++
    }
    this.frameBeams.length = 0
    this.mesh.count = i
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  clear() {
    this.list.length = 0
  }
}
