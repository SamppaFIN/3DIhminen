// The DOM layer over the 3D view: HUD, touch buttons, floating texts, banners and the screens
// (title, shop, pause, game over).

import { WEAPONS, type Perk, type WeaponId } from './weapons'

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}

export type HudState = {
  hp: number
  maxHp: number
  armor: number
  money: number
  score: number
  wave: number
  enemiesLeft: number
  weapon: WeaponId
  ammo: number
  grenades: number
  combo: number
  comboTime: number // 0..1 left of the combo window.
  dash: number // 0..1 charged.
}

export type ShopItem = { id: string; name: string; text: string; price: number; disabled: boolean }

type Float = { el: HTMLElement; x: number; y: number; z: number; life: number; maxLife: number; rise: number }

export class UI {
  root: HTMLElement
  overlay: HTMLElement
  private hudEl: HTMLElement
  private hpBar: HTMLElement
  private armorBar: HTMLElement
  private hpText: HTMLElement
  private moneyEl: HTMLElement
  private scoreEl: HTMLElement
  private waveEl: HTMLElement
  private weaponEl: HTMLElement
  private ammoEl: HTMLElement
  private grenadeEl: HTMLElement
  private comboEl: HTMLElement
  private comboBar: HTMLElement
  private dashFill: HTMLElement
  private bannerEl: HTMLElement
  private screen: HTMLElement
  private vignette: HTMLElement
  private flashEl: HTMLElement
  private arrows: HTMLElement[] = []
  private floats: Float[] = []
  private last = new Map<HTMLElement, string>()
  buttons: { dash: HTMLElement; grenade: HTMLElement; weapon: HTMLElement; pause: HTMLElement }

  constructor(container: HTMLElement) {
    this.root = container
    this.overlay = el('div', 'tk-overlay')
    this.vignette = el('div', 'tk-vignette')
    this.flashEl = el('div', 'tk-flash')
    this.hudEl = el('div', 'tk-hud')

    const left = el('div', 'tk-hud-left')
    const bars = el('div', 'tk-bars')
    const hp = el('div', 'tk-bar tk-hp')
    this.hpBar = el('i')
    this.hpText = el('span')
    hp.append(this.hpBar, this.hpText)
    const armor = el('div', 'tk-bar tk-armor')
    this.armorBar = el('i')
    armor.append(this.armorBar)
    bars.append(hp, armor)
    this.moneyEl = el('div', 'tk-money')
    left.append(bars, this.moneyEl)

    const centre = el('div', 'tk-hud-centre')
    this.waveEl = el('div', 'tk-wave')
    this.comboEl = el('div', 'tk-combo')
    this.comboBar = el('i', 'tk-combo-bar')
    centre.append(this.waveEl, this.comboEl, this.comboBar)

    const right = el('div', 'tk-hud-right')
    this.scoreEl = el('div', 'tk-score')
    const pause = el('button', 'tk-icon-btn', 'II')
    pause.setAttribute('aria-label', 'Tauko')
    right.append(this.scoreEl, pause)
    this.hudEl.append(left, centre, right)

    // Touch buttons: weapon (shows name and ammo), grenade and dash, within the right thumb's reach.
    const controls = el('div', 'tk-controls')
    const weapon = el('button', 'tk-btn tk-btn-weapon')
    this.weaponEl = el('b')
    this.ammoEl = el('span')
    weapon.append(this.weaponEl, this.ammoEl)
    const grenade = el('button', 'tk-btn tk-btn-round tk-btn-grenade')
    this.grenadeEl = el('span')
    grenade.append(el('b', '', 'KRAN'), this.grenadeEl)
    const dash = el('button', 'tk-btn tk-btn-round tk-btn-dash')
    this.dashFill = el('i')
    dash.append(this.dashFill, el('b', '', 'SYÖKSY'))
    controls.append(weapon, grenade, dash)
    this.buttons = { dash, grenade, weapon, pause }

    this.bannerEl = el('div', 'tk-banner')
    this.screen = el('div', 'tk-screen')
    for (let i = 0; i < 6; i++) {
      const arrow = el('div', 'tk-arrow')
      this.arrows.push(arrow)
      this.overlay.append(arrow)
    }
    this.overlay.append(this.vignette, this.flashEl, this.hudEl, controls, this.bannerEl, this.screen)
    container.append(this.overlay)
  }

  private text(node: HTMLElement, value: string) {
    if (this.last.get(node) === value) return
    this.last.set(node, value)
    node.textContent = value
  }

  private style(node: HTMLElement, key: 'width' | 'height' | 'opacity', value: string) {
    if (node.style[key] !== value) node.style[key] = value
  }

  setPlaying(playing: boolean) {
    this.overlay.classList.toggle('playing', playing)
  }

  hud(s: HudState) {
    this.style(this.hpBar, 'width', `${Math.max(0, (s.hp / s.maxHp) * 100).toFixed(1)}%`)
    this.text(this.hpText, `${Math.ceil(Math.max(0, s.hp))}`)
    this.style(this.armorBar, 'width', `${Math.min(100, s.armor)}%`)
    this.text(this.moneyEl, `€ ${s.money}`)
    this.text(this.scoreEl, s.score.toLocaleString('fi-FI'))
    this.text(this.waveEl, `TASO ${s.wave} · ${s.enemiesLeft}`)
    this.text(this.weaponEl, WEAPONS[s.weapon].name)
    this.text(this.ammoEl, Number.isFinite(s.ammo) ? `${s.ammo}` : '∞')
    this.text(this.grenadeEl, `×${s.grenades}`)
    this.text(this.comboEl, s.combo > 1 ? `TAPPOPUTKI ×${s.combo}` : '')
    this.style(this.comboBar, 'width', `${s.combo > 1 ? s.comboTime * 100 : 0}%`)
    this.style(this.dashFill, 'height', `${s.dash * 100}%`)
    this.buttons.dash.classList.toggle('ready', s.dash >= 1)
    const low = s.hp / s.maxHp < 0.3
    this.vignette.classList.toggle('low', low && s.hp > 0)
  }

  hurt() {
    this.flashEl.classList.remove('on')
    void this.flashEl.offsetWidth
    this.flashEl.classList.add('on')
  }

  banner(title: string, sub = '', duration = 1.6) {
    this.bannerEl.replaceChildren(el('b', '', title), el('span', '', sub))
    this.bannerEl.classList.remove('on')
    void this.bannerEl.offsetWidth
    this.bannerEl.style.animationDuration = `${duration}s`
    this.bannerEl.classList.add('on')
  }

  // Off-screen enemy markers: `points` are screen positions clamped to the edge, with angles.
  markers(points: { x: number; y: number; angle: number; boss: boolean }[]) {
    this.arrows.forEach((arrow, i) => {
      const p = points[i]
      if (!p) {
        arrow.style.display = 'none'
        return
      }
      arrow.style.display = 'block'
      arrow.classList.toggle('boss', p.boss)
      arrow.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.angle}rad)`
    })
  }

  float(x: number, y: number, z: number, text: string, kind: string, life = 0.9) {
    if (this.floats.length > 40) this.floats.shift()?.el.remove()
    const node = el('div', `tk-float ${kind}`, text)
    this.overlay.append(node)
    this.floats.push({ el: node, x, y, z, life, maxLife: life, rise: kind === 'big' ? 0.6 : 1.4 })
  }

  updateFloats(dt: number, project: (x: number, y: number, z: number) => { x: number; y: number }) {
    this.floats = this.floats.filter((f) => {
      f.life -= dt
      if (f.life <= 0) {
        f.el.remove()
        return false
      }
      const t = 1 - f.life / f.maxLife
      const p = project(f.x, f.y + t * f.rise, f.z)
      const pop = t < 0.15 ? 1 + (0.15 - t) * 4 : 1
      f.el.style.transform = `translate(-50%, -50%) translate(${p.x}px, ${p.y}px) scale(${pop})`
      f.el.style.opacity = `${Math.min(1, (f.life / f.maxLife) * 3)}`
      return true
    })
  }

  clearFloats() {
    for (const f of this.floats) f.el.remove()
    this.floats = []
  }

  private show(...children: HTMLElement[]) {
    this.screen.replaceChildren(...children)
    this.screen.classList.add('on')
  }

  hide() {
    this.screen.classList.remove('on')
    this.screen.replaceChildren()
  }

  private button(label: string, onClick: () => void, className = 'tk-cta') {
    const b = el('button', className, label)
    b.addEventListener('click', onClick)
    return b
  }

  title(best: { score: number; wave: number }, onStart: () => void, muted: boolean, onMute: () => boolean) {
    const box = el('div', 'tk-title')
    const logo = el('h1', 'tk-logo')
    logo.append(el('span', '', 'TAPAN'), el('span', '', 'KAIKKI'), el('em', '', '3'))
    const tag = el('p', 'tk-tag', 'Taskuversio. Yksi sormi liikkuu, toinen tappaa.')
    const start = this.button('ALOITA', onStart)
    const mute = this.button(muted ? 'Äänet: pois' : 'Äänet: päällä', () => {
      mute.textContent = onMute() ? 'Äänet: pois' : 'Äänet: päällä'
    }, 'tk-ghost')
    const help = el('div', 'tk-help')
    help.append(
      el('p', '', 'Puhelin: vasen peukalo liikkuu, oikea tähtää ja ampuu. Napit: syöksy (väistää kaiken), kranaatti ja aseen vaihto.'),
      el('p', '', 'Kone: WASD, hiiri tähtää ja ampuu, välilyönti syöksyy, oikea nappi tai G heittää kranaatin, Q/E tai rulla vaihtaa asetta.'),
    )
    const record = el('p', 'tk-best', best.score ? `Ennätys: ${best.score.toLocaleString('fi-FI')} pistettä · taso ${best.wave}` : '')
    const credit = el('p', 'tk-credit', 'Epävirallinen fanikunnianosoitus klassiselle Tapan Kaikki -pelisarjalle. Hahmot: Lihastohtorin kehomalli (Z-Anatomy, CC BY-SA 4.0).')
    const back = el('a', 'tk-link', '← Lihastohtori')
    back.setAttribute('href', './')
    box.append(logo, tag, start, mute, help, record, credit, back)
    this.show(box)
    start.focus()
  }

  shop(o: {
    wave: number
    money: number
    perks: Perk[]
    perkPicked: boolean
    items: ShopItem[]
    onPerk: (perk: Perk) => void
    onBuy: (id: string) => void
    onContinue: () => void
  }) {
    const box = el('div', 'tk-shop')
    box.append(el('h2', '', `TASO ${o.wave} SELVÄ`), el('p', 'tk-money-big', `€ ${o.money}`))
    if (o.perks.length) {
      box.append(el('h3', '', o.perkPicked ? 'Kyky valittu' : 'Valitse ilmainen kyky'))
      const cards = el('div', 'tk-cards')
      for (const perk of o.perks) {
        const card = el('button', 'tk-card')
        card.append(el('b', '', perk.name), el('span', '', perk.text))
        card.disabled = o.perkPicked
        card.addEventListener('click', () => o.onPerk(perk))
        cards.append(card)
      }
      box.append(cards)
    }
    box.append(el('h3', '', 'Kauppa'))
    const list = el('div', 'tk-items')
    for (const item of o.items) {
      const row = el('button', 'tk-item')
      row.append(el('b', '', item.name), el('span', '', item.text), el('em', '', `€ ${item.price}`))
      row.disabled = item.disabled
      row.addEventListener('click', () => o.onBuy(item.id))
      list.append(row)
    }
    box.append(list, this.button(`SEURAAVA TASO →`, o.onContinue))
    this.show(box)
  }

  pause(onResume: () => void, onQuit: () => void, muted: boolean, onMute: () => boolean) {
    const box = el('div', 'tk-title')
    box.append(el('h2', '', 'TAUKO'))
    const mute = this.button(muted ? 'Äänet: pois' : 'Äänet: päällä', () => {
      mute.textContent = onMute() ? 'Äänet: pois' : 'Äänet: päällä'
    }, 'tk-ghost')
    box.append(this.button('JATKA', onResume), mute, this.button('Lopeta peli', onQuit, 'tk-ghost'))
    this.show(box)
  }

  gameOver(o: { score: number; wave: number; kills: number; best: boolean; onRetry: () => void; onMenu: () => void }) {
    const box = el('div', 'tk-title')
    box.append(
      el('h2', 'tk-dead', 'KUOLIT'),
      el('p', 'tk-final', `${o.score.toLocaleString('fi-FI')} pistettä`),
      el('p', '', `Taso ${o.wave} · ${o.kills} tappoa`),
    )
    if (o.best) box.append(el('p', 'tk-record', 'UUSI ENNÄTYS!'))
    box.append(this.button('UUDESTAAN', o.onRetry), this.button('Valikkoon', o.onMenu, 'tk-ghost'))
    this.show(box)
  }
}
