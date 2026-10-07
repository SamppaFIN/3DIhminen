// Controls. Phone: twin sticks that appear where the thumbs land (left half moves, right half
// aims and fires while held) plus on-screen buttons. Desktop: WASD, mouse aim, left button fires,
// Space dashes, right button or G throws a grenade, Q / wheel / 1-6 change weapon, Esc pauses.

export type Action = 'dash' | 'grenade' | 'next' | 'prev' | 'pause' | 'weapon0' | 'weapon1' | 'weapon2' | 'weapon3' | 'weapon4' | 'weapon5'

type Stick = { id: number; ox: number; oy: number; x: number; y: number; el: HTMLElement; knob: HTMLElement }

const STICK_RADIUS = 56
const FIRE_THRESHOLD = 14

export class Input {
  move = { x: 0, z: 0 }
  aim = { x: 0, z: 1 }
  firing = false
  usingMouse = false
  mouse = { x: 0, y: 0 }
  touchAiming = false
  private keys = new Set<string>()
  private pressed = new Set<Action>()
  private mouseDown = false
  private moveStick: Stick | null = null
  private aimStick: Stick | null = null
  private stickEls: { el: HTMLElement; knob: HTMLElement }[]

  private surface: HTMLElement

  constructor(surface: HTMLElement, overlay: HTMLElement) {
    this.surface = surface
    this.stickEls = [0, 1].map(() => {
      const el = document.createElement('div')
      el.className = 'tk-stick'
      const knob = document.createElement('div')
      knob.className = 'tk-knob'
      el.append(knob)
      overlay.append(el)
      return { el, knob }
    })

    surface.addEventListener('pointerdown', this.down)
    window.addEventListener('pointermove', this.moveHandler)
    window.addEventListener('pointerup', this.up)
    window.addEventListener('pointercancel', this.up)
    surface.addEventListener('contextmenu', (e) => e.preventDefault())
    surface.addEventListener('wheel', (e) => this.press(e.deltaY > 0 ? 'next' : 'prev'), { passive: true })
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase()
      if (!this.keys.has(key)) {
        if (key === ' ') this.press('dash')
        if (key === 'g' || key === 'f') this.press('grenade')
        if (key === 'q' || key === 'e') this.press(key === 'q' ? 'prev' : 'next')
        if (key === 'escape' || key === 'p') this.press('pause')
        if (key >= '1' && key <= '6') this.press(`weapon${Number(key) - 1}` as Action)
      }
      this.keys.add(key)
      if (key === ' ') e.preventDefault()
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()))
    window.addEventListener('blur', () => {
      this.keys.clear()
      this.mouseDown = false
      this.release(this.moveStick)
      this.release(this.aimStick)
      this.moveStick = this.aimStick = null
    })
  }

  press(action: Action) {
    this.pressed.add(action)
  }

  // True once per press.
  take(action: Action) {
    return this.pressed.delete(action)
  }

  clearPresses() {
    this.pressed.clear()
  }

  private down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') {
      this.usingMouse = true
      this.mouse.x = e.clientX
      this.mouse.y = e.clientY
      if (e.button === 0) this.mouseDown = true
      if (e.button === 2) this.press('grenade')
      return
    }
    this.usingMouse = false
    e.preventDefault()
    const left = e.clientX < this.surface.clientWidth / 2
    if (left && !this.moveStick) this.moveStick = this.grab(e, 0)
    else if (!left && !this.aimStick) this.aimStick = this.grab(e, 1)
  }

  private grab(e: PointerEvent, which: number): Stick {
    const { el, knob } = this.stickEls[which]
    el.style.left = `${e.clientX}px`
    el.style.top = `${e.clientY}px`
    el.classList.add('on')
    knob.style.transform = 'translate(-50%, -50%)'
    return { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0, el, knob }
  }

  private release(stick: Stick | null) {
    stick?.el.classList.remove('on')
  }

  private moveHandler = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') {
      this.usingMouse = true
      this.mouse.x = e.clientX
      this.mouse.y = e.clientY
      return
    }
    for (const stick of [this.moveStick, this.aimStick]) {
      if (!stick || stick.id !== e.pointerId) continue
      let dx = e.clientX - stick.ox
      let dy = e.clientY - stick.oy
      const length = Math.hypot(dx, dy)
      // The stick follows a thumb that drifts too far, so it never runs out of travel.
      if (length > STICK_RADIUS) {
        const over = length - STICK_RADIUS
        stick.ox += (dx / length) * over
        stick.oy += (dy / length) * over
        dx = e.clientX - stick.ox
        dy = e.clientY - stick.oy
        stick.el.style.left = `${stick.ox}px`
        stick.el.style.top = `${stick.oy}px`
      }
      stick.x = dx
      stick.y = dy
      stick.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
    }
  }

  private up = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') {
      if (e.button === 0) this.mouseDown = false
      return
    }
    if (this.moveStick?.id === e.pointerId) {
      this.release(this.moveStick)
      this.moveStick = null
    }
    if (this.aimStick?.id === e.pointerId) {
      this.release(this.aimStick)
      this.aimStick = null
    }
  }

  // Reads the sticks and keys into move, aim and firing. `player` is the player's screen position,
  // for mouse aiming.
  update(player: { x: number; y: number }) {
    let mx = 0
    let mz = 0
    if (this.keys.has('a') || this.keys.has('arrowleft')) mx -= 1
    if (this.keys.has('d') || this.keys.has('arrowright')) mx += 1
    if (this.keys.has('w') || this.keys.has('arrowup')) mz -= 1
    if (this.keys.has('s') || this.keys.has('arrowdown')) mz += 1
    if (this.moveStick) {
      const length = Math.hypot(this.moveStick.x, this.moveStick.y)
      // A small dead zone, then a curve that gives fine control near the centre.
      const amount = length < 6 ? 0 : Math.min(1, (length - 6) / (STICK_RADIUS - 6)) ** 0.8
      if (length > 0) {
        mx = (this.moveStick.x / length) * amount
        mz = (this.moveStick.y / length) * amount
      }
    }
    const length = Math.hypot(mx, mz)
    if (length > 1) {
      mx /= length
      mz /= length
    }
    this.move.x = mx
    this.move.z = mz

    this.touchAiming = false
    if (this.aimStick) {
      const l = Math.hypot(this.aimStick.x, this.aimStick.y)
      if (l > 4) {
        this.aim.x = this.aimStick.x / l
        this.aim.z = this.aimStick.y / l
      }
      this.firing = l > FIRE_THRESHOLD
      this.touchAiming = true
    } else if (this.usingMouse) {
      const dx = this.mouse.x - player.x
      const dy = this.mouse.y - player.y
      const l = Math.hypot(dx, dy)
      if (l > 1) {
        this.aim.x = dx / l
        this.aim.z = dy / l
      }
      this.firing = this.mouseDown
    } else {
      this.firing = false
      // Without an aim stick the fighter faces where they walk.
      if (Math.hypot(mx, mz) > 0.2) {
        this.aim.x = mx / Math.hypot(mx, mz)
        this.aim.z = mz / Math.hypot(mx, mz)
      }
    }
  }
}
