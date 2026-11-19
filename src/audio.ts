// Pemutar suasana: suara bawaan dibangkitkan langsung dengan Web Audio (tanpa berkas, tanpa internet),
// ditambah audio milikmu sendiri yang disimpan di IndexedDB peramban.
import { createStore, del, entries, set } from 'idb-keyval'

export type CatId = 'alam' | 'dunia' | 'fokus'
export interface Track { id: string; title: string; sub: string; cat: CatId | 'milik'; icon: string; builtin: boolean }
export const CATS: { id: CatId; label: string; blurb: string }[] = [
  { id: 'alam', label: 'Alam', blurb: 'Bawa sedikit dunia luar ke dalam.' },
  { id: 'dunia', label: 'Dunia', blurb: 'Masuk ke latar yang ingin kamu tulis.' },
  { id: 'fokus', label: 'Fokus', blurb: 'Temukan iramamu. Sisakan ruang untuk kata-kata.' },
]
export const BUILTIN: Track[] = [
  { id: 'hujan', title: 'Hujan di beranda', sub: 'Rintik di atap seng', cat: 'alam', icon: 'rain', builtin: true },
  { id: 'ombak', title: 'Ombak pesisir', sub: 'Pasang yang datang dan pergi', cat: 'alam', icon: 'wave', builtin: true },
  { id: 'hutan', title: 'Hutan malam', sub: 'Jangkrik dan angin tipis', cat: 'alam', icon: 'moon', builtin: true },
  { id: 'api', title: 'Api unggun', sub: 'Kayu berderak pelan', cat: 'alam', icon: 'fire', builtin: true },
  { id: 'perpus', title: 'Perpustakaan tua', sub: 'Detak jam di ruang lengang', cat: 'dunia', icon: 'book', builtin: true },
  { id: 'kafe', title: 'Kafe saat gerimis', sub: 'Gumam jauh dan cangkir', cat: 'dunia', icon: 'cup', builtin: true },
  { id: 'kereta', title: 'Kereta malam', sub: 'Gerbong dan sambungan rel', cat: 'dunia', icon: 'train', builtin: true },
  { id: 'cokelat', title: 'Dengung cokelat', sub: 'Derau coklat yang berat dan rata', cat: 'fokus', icon: 'bars', builtin: true },
  { id: 'kabut', title: 'Kabut pagi', sub: 'Pad yang pelan berganti nada', cat: 'fokus', icon: 'mist', builtin: true },
  { id: 'lofi', title: 'Denyut lo-fi', sub: 'Piano usang, ketukan malas', cat: 'fokus', icon: 'phones', builtin: true },
]

interface Saved { name: string; blob: Blob }
const db = createStore('ruang-tulis-gs-audio', 'berkas')
const PKEY = 'rtgs.audio.v1'
interface Persist { vol: number; loop: boolean; track: string | null }
const loadP = (): Persist => {
  try {
    return { vol: 0.6, loop: false, track: null, ...JSON.parse(localStorage.getItem(PKEY) ?? '{}') }
  } catch {
    return { vol: 0.6, loop: false, track: null }
  }
}

/* ───────── mesin suara ───────── */
let ac: AudioContext | null = null
let master: GainNode | null = null
let white: AudioBuffer, brown: AudioBuffer, pink: AudioBuffer
const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const NOTE = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

function engine(): AudioContext | null {
  if (!ac) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!C) return null
    ac = new C()
    const len = ac.sampleRate * 4
    white = ac.createBuffer(1, len, ac.sampleRate)
    brown = ac.createBuffer(1, len, ac.sampleRate)
    pink = ac.createBuffer(1, len, ac.sampleRate)
    const w = white.getChannelData(0), b = brown.getChannelData(0), p = pink.getChannelData(0)
    let last = 0, b0 = 0, b1 = 0, b2 = 0
    for (let i = 0; i < len; i++) {
      const x = Math.random() * 2 - 1
      w[i] = x
      last = (last + 0.02 * x) / 1.02
      b[i] = last * 3.5
      b0 = 0.99765 * b0 + x * 0.099046
      b1 = 0.963 * b1 + x * 0.2965164
      b2 = 0.57 * b2 + x * 1.0526913
      p[i] = (b0 + b1 + b2 + x * 0.1848) * 0.16
    }
    master = ac.createGain()
    const comp = ac.createDynamicsCompressor()
    master.connect(comp)
    comp.connect(ac.destination)
  }
  if (ac.state === 'suspended') void ac.resume()
  return ac
}

interface Voice { stop(): void }
type Kit = { a: AudioContext; out: GainNode; timers: number[]; srcs: AudioScheduledSourceNode[] }

function noise(k: Kit, buf: AudioBuffer, ...chain: AudioNode[]) {
  const s = k.a.createBufferSource()
  s.buffer = buf
  s.loop = true
  s.start(0, rnd(0, 3))
  k.srcs.push(s)
  let n: AudioNode = s
  for (const c of chain) {
    n.connect(c)
    n = c
  }
  return n
}
const filt = (a: AudioContext, type: BiquadFilterType, f: number, q = 0.7) => {
  const x = a.createBiquadFilter()
  x.type = type
  x.frequency.value = f
  x.Q.value = q
  return x
}
const gain = (a: AudioContext, v: number) => {
  const g = a.createGain()
  g.gain.value = v
  return g
}
function lfo(k: Kit, target: AudioParam, rate: number, depth: number) {
  const o = k.a.createOscillator()
  const g = gain(k.a, depth)
  o.frequency.value = rate
  o.connect(g)
  g.connect(target)
  o.start()
  k.srcs.push(o)
}
function burst(k: Kit, t: number, buf: AudioBuffer, type: BiquadFilterType, f: number, q: number, dur: number, v: number, dest: AudioNode = k.out) {
  const s = k.a.createBufferSource()
  s.buffer = buf
  const fl = filt(k.a, type, f, q)
  const g = k.a.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(v, t + 0.003)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  s.connect(fl)
  fl.connect(g)
  g.connect(dest)
  s.start(t, rnd(0, 3), dur + 0.05)
}
function tone(k: Kit, t: number, f: number, dur: number, v: number, type: OscillatorType = 'sine', attack = 0.005, dest: AudioNode = k.out) {
  const o = k.a.createOscillator()
  const g = k.a.createGain()
  o.type = type
  o.frequency.value = f
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(v, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g)
  g.connect(dest)
  o.start(t)
  o.stop(t + dur + 0.05)
}
/** Jalankan fn berulang pada selang acak (ms) selama suara hidup. */
function every(k: Kit, min: number, max: number, fn: () => void) {
  const tick = () => {
    fn()
    k.timers.push(window.setTimeout(tick, rnd(min, max)))
  }
  k.timers.push(window.setTimeout(tick, rnd(min, max) * 0.3))
}

const BUILDERS: Record<string, (k: Kit) => void> = {
  hujan(k) {
    noise(k, white, filt(k.a, 'highpass', 900), filt(k.a, 'lowpass', 9000), gain(k.a, 0.3)).connect(k.out)
    noise(k, brown, filt(k.a, 'lowpass', 420), gain(k.a, 0.3)).connect(k.out)
    every(k, 40, 170, () => burst(k, k.a.currentTime, white, 'bandpass', rnd(2200, 5200), 3, rnd(0.015, 0.05), rnd(0.03, 0.12)))
  },
  ombak(k) {
    const swell = gain(k.a, 0.45)
    noise(k, brown, filt(k.a, 'lowpass', 750), swell).connect(k.out)
    lfo(k, swell.gain, 0.085, 0.38)
    const hiss = gain(k.a, 0.05)
    noise(k, white, filt(k.a, 'bandpass', 2400, 0.6), hiss).connect(k.out)
    lfo(k, hiss.gain, 0.085, 0.045)
    noise(k, pink, filt(k.a, 'lowpass', 300), gain(k.a, 0.25)).connect(k.out)
  },
  hutan(k) {
    const wind = gain(k.a, 0.22)
    noise(k, pink, filt(k.a, 'bandpass', 420, 0.5), wind).connect(k.out)
    lfo(k, wind.gain, 0.07, 0.15)
    for (let v = 0; v < 3; v++) {
      const base = rnd(4300, 4900)
      every(k, 1300, 3200, () => {
        const t = k.a.currentTime
        for (let i = 0; i < 4; i++) tone(k, t + i * 0.075, base + rnd(-60, 60), 0.035, 0.012 + v * 0.004, 'sine', 0.004)
      })
    }
  },
  api(k) {
    noise(k, brown, filt(k.a, 'lowpass', 520), gain(k.a, 0.55)).connect(k.out)
    noise(k, white, filt(k.a, 'highpass', 5000), gain(k.a, 0.02)).connect(k.out)
    every(k, 35, 380, () => {
      const t = k.a.currentTime
      const n = Math.random() < 0.2 ? 4 : 1
      for (let i = 0; i < n; i++) burst(k, t + i * rnd(0.01, 0.05), white, 'bandpass', rnd(1200, 5200), 1.4, rnd(0.008, 0.03), rnd(0.08, 0.35))
    })
  },
  perpus(k) {
    const hum = k.a.createOscillator()
    const hg = gain(k.a, 0.035)
    hum.frequency.value = 55
    hum.connect(hg)
    hg.connect(k.out)
    hum.start()
    k.srcs.push(hum)
    noise(k, brown, filt(k.a, 'lowpass', 220), gain(k.a, 0.16)).connect(k.out)
    let flip = false
    const tick = () => {
      const t = k.a.currentTime + 0.05
      burst(k, t, white, 'bandpass', flip ? 2300 : 2900, 9, 0.014, 0.16)
      flip = !flip
      k.timers.push(window.setTimeout(tick, 1000))
    }
    tick()
    every(k, 14000, 32000, () => burst(k, k.a.currentTime, pink, 'bandpass', 3200, 0.8, rnd(0.18, 0.32), 0.07))
  },
  kafe(k) {
    const mur = gain(k.a, 0.26)
    noise(k, pink, filt(k.a, 'bandpass', 620, 0.7), mur).connect(k.out)
    lfo(k, mur.gain, 0.31, 0.12)
    const mur2 = gain(k.a, 0.1)
    noise(k, pink, filt(k.a, 'bandpass', 1250, 1), mur2).connect(k.out)
    lfo(k, mur2.gain, 0.17, 0.07)
    noise(k, white, filt(k.a, 'highpass', 3500), gain(k.a, 0.045)).connect(k.out)
    every(k, 5000, 14000, () => {
      const t = k.a.currentTime
      const f = rnd(2900, 4400)
      tone(k, t, f, 0.3, 0.03)
      tone(k, t + 0.012, f * 1.5, 0.2, 0.012)
    })
  },
  kereta(k) {
    const rum = gain(k.a, 0.7)
    noise(k, brown, filt(k.a, 'lowpass', 170), rum).connect(k.out)
    lfo(k, rum.gain, 0.45, 0.1)
    noise(k, pink, filt(k.a, 'bandpass', 700, 0.4), gain(k.a, 0.05)).connect(k.out)
    let beat = 0
    const clack = () => {
      const t = k.a.currentTime + 0.03
      const v = beat % 8 < 4 ? 0.3 : 0.22
      burst(k, t, brown, 'lowpass', 190, 1, 0.1, v)
      burst(k, t, white, 'bandpass', 1700, 2, 0.02, v * 0.3)
      burst(k, t + 0.115, brown, 'lowpass', 200, 1, 0.1, v * 0.85)
      burst(k, t + 0.115, white, 'bandpass', 1900, 2, 0.02, v * 0.25)
      beat++
      k.timers.push(window.setTimeout(clack, 560))
    }
    clack()
  },
  cokelat(k) {
    noise(k, brown, filt(k.a, 'lowpass', 900), gain(k.a, 0.6)).connect(k.out)
    const o = k.a.createOscillator()
    const g = gain(k.a, 0.03)
    o.frequency.value = 82
    o.connect(g)
    g.connect(k.out)
    o.start()
    k.srcs.push(o)
  },
  kabut(k) {
    noise(k, pink, filt(k.a, 'lowpass', 500), gain(k.a, 0.05)).connect(k.out)
    const lp = filt(k.a, 'lowpass', 1100, 0.3)
    lp.connect(k.out)
    const chords = [[50, 57, 62, 65, 69], [46, 53, 58, 62, 65], [53, 57, 60, 64, 67], [48, 55, 60, 64, 67]]
    let i = 0
    const play = () => {
      const t = k.a.currentTime
      for (const m of chords[i % chords.length]) {
        for (const det of [-5, 5]) {
          const o = k.a.createOscillator()
          const g = k.a.createGain()
          o.type = 'triangle'
          o.frequency.value = NOTE(m)
          o.detune.value = det
          g.gain.setValueAtTime(0.0001, t)
          g.gain.linearRampToValueAtTime(0.02, t + 4)
          g.gain.linearRampToValueAtTime(0.0001, t + 13)
          o.connect(g)
          g.connect(lp)
          o.start(t)
          o.stop(t + 13.2)
        }
      }
      i++
      k.timers.push(window.setTimeout(play, 9000))
    }
    play()
  },
  lofi(k) {
    const bpm = 74, beat = 60 / bpm
    const lp = filt(k.a, 'lowpass', 2300, 0.5)
    const keys = gain(k.a, 0.7)
    keys.connect(lp)
    lp.connect(k.out)
    noise(k, white, filt(k.a, 'highpass', 3000), gain(k.a, 0.012)).connect(k.out)
    every(k, 60, 500, () => burst(k, k.a.currentTime, white, 'highpass', 4500, 0.5, 0.006, rnd(0.03, 0.1)))
    const chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]
    let step = 0
    let next = k.a.currentTime + 0.2
    const sched = () => {
      while (next < k.a.currentTime + 0.25) {
        const bar = Math.floor(step / 8) % chords.length
        const s = step % 8
        const sw = s % 2 ? beat * 0.09 : 0
        const t = next + sw
        const ch = chords[bar]
        if (s === 0 || s === 5) for (const m of ch) tone(k, t + rnd(0, 0.02), NOTE(m + 12), 1.4, 0.05, 'triangle', 0.01, keys)
        else if (Math.random() < 0.45) tone(k, t, NOTE(ch[Math.floor(rnd(0, 4))] + 24), 0.9, 0.04, 'sine', 0.006, keys)
        if (s === 0 || s === 4) tone(k, t, NOTE(ch[0] - 12), 0.9, 0.16, 'sine', 0.01)
        if (s === 0 || s === 3 || s === 4 + (bar % 2)) {
          const o = k.a.createOscillator()
          const g = k.a.createGain()
          o.frequency.setValueAtTime(130, t)
          o.frequency.exponentialRampToValueAtTime(42, t + 0.12)
          g.gain.setValueAtTime(0.3, t)
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
          o.connect(g)
          g.connect(k.out)
          o.start(t)
          o.stop(t + 0.25)
        }
        if (s % 2) burst(k, t, white, 'highpass', 7000, 0.5, 0.04, 0.05)
        else if (s === 2 || s === 6) burst(k, t, white, 'bandpass', 1900, 1, 0.09, 0.1)
        next += beat / 2
        step++
      }
      k.timers.push(window.setTimeout(sched, 60))
    }
    sched()
  },
}

const LEVEL: Record<string, number> = { hutan: 1.5, perpus: 1.8, kafe: 1.8, kabut: 1.6 }
function startSynth(id: string): Voice | null {
  const a = engine()
  const build = BUILDERS[id]
  if (!a || !build || !master) return null
  const out = a.createGain()
  out.gain.setValueAtTime(0.0001, a.currentTime)
  out.gain.linearRampToValueAtTime(0.8 * (LEVEL[id] ?? 1), a.currentTime + 1.2)
  out.connect(master)
  const k: Kit = { a, out, timers: [], srcs: [] }
  build(k)
  return {
    stop() {
      k.timers.forEach((t) => clearTimeout(t))
      k.timers.length = 0
      out.gain.cancelScheduledValues(a.currentTime)
      out.gain.setValueAtTime(out.gain.value, a.currentTime)
      out.gain.linearRampToValueAtTime(0.0001, a.currentTime + 0.5)
      window.setTimeout(() => {
        k.srcs.forEach((s) => {
          try { s.stop() } catch { /* sudah berhenti */ }
        })
        out.disconnect()
      }, 650)
    },
  }
}

/* ───────── pemutar ───────── */
export interface PlayerState { track: Track | null; playing: boolean; vol: number; loop: boolean }
const subs = new Set<() => void>()
const P = loadP()
let mine: Track[] = []
let voice: Voice | null = null
let el: HTMLAudioElement | null = null
let elUrl = ''
let cur: Track | null = null
let playing = false
let ready: Promise<void> | null = null

const save = () => {
  try { localStorage.setItem(PKEY, JSON.stringify({ vol: P.vol, loop: P.loop, track: cur?.id ?? null })) } catch { /* tidak kritis */ }
}
const emit = () => subs.forEach((f) => f())
const applyVol = () => {
  if (master) master.gain.value = P.vol * 0.9
  if (el) el.volume = P.vol
}

async function loadMine() {
  try {
    const all = await entries(db)
    mine = all
      .map(([k, v]) => ({ id: String(k), title: (v as Saved).name.replace(/\.[^.]+$/, ''), sub: 'Audio-mu', cat: 'milik' as const, icon: 'note', builtin: false }))
      .sort((a, b) => a.title.localeCompare(b.title, 'id'))
  } catch {
    mine = []
  }
}
function init(): Promise<void> {
  ready ??= (async () => {
    await loadMine()
    cur = [...BUILTIN, ...mine].find((t) => t.id === P.track) ?? null
    emit()
  })()
  return ready
}

function halt() {
  voice?.stop()
  voice = null
  if (el) {
    el.pause()
    el.removeAttribute('src')
    el.load()
  }
  if (elUrl) URL.revokeObjectURL(elUrl)
  elUrl = ''
}

export const player = {
  init,
  subscribe(fn: () => void) {
    subs.add(fn)
    return () => subs.delete(fn)
  },
  state(): PlayerState {
    return { track: cur, playing, vol: P.vol, loop: P.loop }
  },
  tracks: (): Track[] => [...BUILTIN, ...mine],
  group(cat: CatId | 'milik'): Track[] {
    return cat === 'milik' ? mine : BUILTIN.filter((t) => t.cat === cat)
  },
  async play(id?: string): Promise<void> {
    await init()
    const t = id ? [...BUILTIN, ...mine].find((x) => x.id === id) : cur ?? BUILTIN[0]
    if (!t) return
    if (cur && cur.id === t.id && playing) return
    halt()
    cur = t
    playing = true
    if (t.builtin) {
      voice = startSynth(t.id)
      if (!voice) playing = false
    } else {
      try {
        const rows = await entries(db)
        const hit = rows.find(([k]) => String(k) === t.id)
        if (!hit) throw new Error('hilang')
        el ??= new Audio()
        el.onended = () => { if (!P.loop) void player.next() }
        elUrl = URL.createObjectURL((hit[1] as Saved).blob)
        el.src = elUrl
        el.loop = P.loop
        applyVol()
        await el.play()
      } catch {
        playing = false
      }
    }
    applyVol()
    save()
    emit()
  },
  pause() {
    if (!playing) return
    halt()
    playing = false
    emit()
  },
  async toggle() {
    if (playing) player.pause()
    else await player.play()
  },
  stop() {
    halt()
    playing = false
    cur = null
    save()
    emit()
  },
  async step(dir: 1 | -1) {
    await init()
    const list = cur ? player.group(cur.cat) : BUILTIN
    if (!list.length) return
    const i = cur ? list.findIndex((t) => t.id === cur!.id) : -1
    const n = list[(i + dir + list.length) % list.length]
    await player.play(n.id)
  },
  next: () => player.step(1),
  prev: () => player.step(-1),
  setVol(v: number) {
    P.vol = Math.min(1, Math.max(0, v))
    applyVol()
    save()
    emit()
  },
  toggleLoop() {
    P.loop = !P.loop
    if (el) el.loop = P.loop
    save()
    emit()
  },
  async add(files: FileList | File[]): Promise<number> {
    await init()
    let n = 0
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|flac|aac|opus|webm)$/i.test(f.name)) continue
      const id = `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      await set(id, { name: f.name, blob: f } satisfies Saved, db)
      n++
    }
    await loadMine()
    emit()
    return n
  },
  async remove(id: string) {
    if (cur?.id === id) player.stop()
    await del(id, db)
    mine = mine.filter((t) => t.id !== id)
    emit()
  },
}
