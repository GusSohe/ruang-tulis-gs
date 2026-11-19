// Suara mesin tik jadul, disintesis langsung dengan Web Audio. Tanpa berkas audio, sepenuhnya offline.
let ac: AudioContext | null = null
let noise: AudioBuffer | null = null
let master: GainNode | null = null
let last = 0

function ctx(): AudioContext | null {
  if (!ac) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!C) return null
    ac = new C()
    const len = Math.floor(ac.sampleRate * 0.3)
    noise = ac.createBuffer(1, len, ac.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    master = ac.createGain()
    master.gain.value = 0.9
    const comp = ac.createDynamicsCompressor()
    master.connect(comp)
    comp.connect(ac.destination)
  }
  if (ac.state === 'suspended') void ac.resume()
  return ac
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a)

function burst(a: AudioContext, t: number, freq: number, q: number, dur: number, gain: number) {
  const s = a.createBufferSource()
  s.buffer = noise
  const f = a.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = freq
  f.Q.value = q
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  s.connect(f)
  f.connect(g)
  g.connect(master!)
  s.start(t, Math.random() * 0.1)
  s.stop(t + dur + 0.03)
}

function thunk(a: AudioContext, t: number, freq: number, dur: number, gain: number) {
  const o = a.createOscillator()
  o.type = 'triangle'
  o.frequency.setValueAtTime(freq, t)
  o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + dur)
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.003)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g)
  g.connect(master!)
  o.start(t)
  o.stop(t + dur + 0.03)
}

function throttle(ms: number) {
  const n = performance.now()
  if (n - last < ms) return true
  last = n
  return false
}

/** Ketukan huruf: palu logam menghantam pita, lalu bunyi tumpul dari rangka. */
export function key() {
  if (throttle(28)) return
  const a = ctx()
  if (!a) return
  const t = a.currentTime
  burst(a, t, rnd(1500, 2400), 0.9, 0.05, rnd(0.4, 0.55))
  burst(a, t, rnd(3800, 4800), 2, 0.02, rnd(0.18, 0.28))
  thunk(a, t, rnd(140, 190), 0.07, rnd(0.28, 0.4))
}

/** Batang spasi: lebih rendah dan lebih panjang. */
export function space() {
  if (throttle(28)) return
  const a = ctx()
  if (!a) return
  const t = a.currentTime
  burst(a, t, rnd(650, 850), 0.8, 0.075, rnd(0.38, 0.5))
  thunk(a, t, rnd(85, 105), 0.12, rnd(0.45, 0.55))
}

/** Hapus mundur: ketukan ringan. */
export function back() {
  if (throttle(28)) return
  const a = ctx()
  if (!a) return
  const t = a.currentTime
  burst(a, t, rnd(2000, 2600), 1.1, 0.03, 0.26)
  thunk(a, t, rnd(170, 200), 0.05, 0.18)
}

/** Enter: tuas ditarik, rel bergerigi bergeser, lalu benturan di ujung. */
export function enter() {
  const a = ctx()
  if (!a) return
  last = performance.now()
  const t = a.currentTime
  thunk(a, t, 220, 0.06, 0.32)
  let at = t + 0.04
  let gap = 0.016
  for (let i = 0; i < 15; i++) {
    burst(a, at, rnd(2400, 3000), 3, 0.012, 0.2)
    at += gap
    gap *= 1.11
  }
  burst(a, at + 0.02, 620, 0.9, 0.1, 0.5)
  thunk(a, at + 0.02, 105, 0.18, 0.6)
}

/** "Ting": lonceng kecil saat kata mendekati tepi kertas. */
export function bell() {
  const a = ctx()
  if (!a) return
  const t = a.currentTime
  const base = 2637
  for (const [mult, gain, dur] of [[1, 0.2, 1.5], [2.76, 0.09, 0.9], [5.4, 0.04, 0.5]] as const) {
    const o = a.createOscillator()
    o.type = 'sine'
    o.frequency.value = base * mult * rnd(0.998, 1.002)
    const g = a.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(gain, t + 0.003)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(master!)
    o.start(t)
    o.stop(t + dur + 0.05)
  }
}
