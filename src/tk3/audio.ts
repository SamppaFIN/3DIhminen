// Every sound is synthesised with Web Audio, so the game ships without sound files. Shots are
// filtered noise bursts with a pitch drop; repeated sounds get a little random pitch so a long
// burst does not sound like a machine.

let context: AudioContext | null = null
let master: GainNode | null = null
let noise: AudioBuffer | null = null
let muted = false

export function initAudio() {
  if (context) {
    if (context.state === 'suspended') void context.resume()
    return
  }
  try {
    context = new AudioContext()
    master = context.createGain()
    master.gain.value = muted ? 0 : 0.55
    const compressor = context.createDynamicsCompressor()
    compressor.threshold.value = -14
    compressor.ratio.value = 6
    master.connect(compressor).connect(context.destination)
    noise = context.createBuffer(1, context.sampleRate, context.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  } catch {
    context = null
  }
}

export function setMuted(value: boolean) {
  muted = value
  if (master) master.gain.value = value ? 0 : 0.55
}
export const isMuted = () => muted

const jitter = (amount: number) => 1 + (Math.random() - 0.5) * amount

function burst(duration: number, frequency: number, endFrequency: number, gain: number, type: BiquadFilterType = 'lowpass', q = 1) {
  if (!context || !master || !noise) return
  const t = context.currentTime
  const source = context.createBufferSource()
  source.buffer = noise
  source.playbackRate.value = jitter(0.3)
  const filter = context.createBiquadFilter()
  filter.type = type
  filter.Q.value = q
  filter.frequency.setValueAtTime(frequency, t)
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), t + duration)
  const envelope = context.createGain()
  envelope.gain.setValueAtTime(gain, t)
  envelope.gain.exponentialRampToValueAtTime(0.001, t + duration)
  source.connect(filter).connect(envelope).connect(master)
  source.start(t, Math.random() * 0.5)
  source.stop(t + duration + 0.05)
}

function tone(duration: number, frequency: number, endFrequency: number, gain: number, type: OscillatorType = 'square', delay = 0) {
  if (!context || !master) return
  const t = context.currentTime + delay
  const oscillator = context.createOscillator()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, t)
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), t + duration)
  const envelope = context.createGain()
  envelope.gain.setValueAtTime(0.0001, t)
  envelope.gain.exponentialRampToValueAtTime(gain, t + 0.005)
  envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration)
  oscillator.connect(envelope).connect(master)
  oscillator.start(t)
  oscillator.stop(t + duration + 0.05)
}

export const sfx = {
  pistol: () => {
    burst(0.12, 3800 * jitter(0.2), 300, 0.7)
    tone(0.08, 180 * jitter(0.2), 60, 0.35)
  },
  uzi: () => {
    burst(0.07, 4200 * jitter(0.3), 500, 0.45)
    tone(0.05, 220 * jitter(0.3), 80, 0.2)
  },
  shotgun: () => {
    burst(0.35, 2400, 120, 1)
    tone(0.25, 110, 35, 0.6, 'sawtooth')
  },
  flamer: () => burst(0.12, 900 * jitter(0.4), 300, 0.12, 'bandpass', 0.8),
  rocket: () => {
    burst(0.5, 600, 2400, 0.4, 'bandpass', 2)
    tone(0.3, 90, 50, 0.3, 'sawtooth')
  },
  rail: () => {
    tone(0.5, 2400, 120, 0.35, 'sawtooth')
    burst(0.3, 8000, 1500, 0.5, 'highpass')
  },
  enemyShot: () => burst(0.1, 2200 * jitter(0.3), 300, 0.25),
  explosion: () => {
    burst(1.1, 1600, 40, 1.2)
    tone(0.7, 70, 25, 0.8, 'sine')
  },
  hit: () => burst(0.06, 1500 * jitter(0.5), 400, 0.25, 'bandpass', 3),
  splat: () => {
    burst(0.18, 700 * jitter(0.4), 90, 0.5)
    tone(0.12, 140 * jitter(0.3), 50, 0.25, 'triangle')
  },
  crate: () => {
    burst(0.2, 1200, 200, 0.6, 'bandpass', 2)
    tone(0.1, 160, 80, 0.3, 'triangle')
  },
  coin: () => {
    const base = 980 * jitter(0.08)
    tone(0.07, base, base, 0.12, 'square')
    tone(0.12, base * 1.5, base * 1.5, 0.12, 'square', 0.06)
  },
  pickup: () => {
    tone(0.1, 520, 520, 0.15, 'triangle')
    tone(0.1, 780, 780, 0.15, 'triangle', 0.08)
    tone(0.18, 1040, 1040, 0.15, 'triangle', 0.16)
  },
  dash: () => burst(0.22, 300, 3000, 0.35, 'bandpass', 1.5),
  hurt: () => {
    tone(0.2, 220, 90, 0.4, 'sawtooth')
    burst(0.15, 900, 200, 0.4)
  },
  empty: () => tone(0.05, 1800, 1800, 0.1, 'square'),
  throw: () => burst(0.2, 400, 1200, 0.2, 'bandpass', 2),
  combo: (level: number) => tone(0.12, 440 * Math.pow(2, Math.min(level, 12) / 12), 880, 0.12, 'square'),
  wave: () => {
    ;[0, 0.12, 0.24, 0.36].forEach((d, i) => tone(0.3, [392, 523, 659, 784][i], [392, 523, 659, 784][i], 0.18, 'square', d))
  },
  heartbeat: () => {
    tone(0.12, 60, 40, 0.5, 'sine')
    tone(0.12, 55, 35, 0.4, 'sine', 0.18)
  },
  click: () => tone(0.04, 700, 700, 0.1, 'square'),
}

// Short vibrations on phones that support them; a felt hit sells it more than any flash.
export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Not supported.
  }
}
