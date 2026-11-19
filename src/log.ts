// Catatan kata per hari (untuk bagan "Panen kata" dan target harian).
const KEY = 'rtgs.log.v1'
export type Log = Record<string, number>

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function getLog(): Log {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Log
  } catch {
    return {}
  }
}
export function setLog(l: Log) {
  try {
    localStorage.setItem(KEY, JSON.stringify(l))
  } catch {
    /* tidak kritis */
  }
}
export function addWords(n: number) {
  if (n <= 0) return
  const l = getLog()
  const k = dayKey()
  l[k] = (l[k] ?? 0) + n
  setLog(l)
  const h = rd(HK)
  const hh = String(new Date().getHours())
  h[hh] = (h[hh] ?? 0) + n
  wr(HK, h)
}
export function lastDays(n: number) {
  const l = getLog()
  const out: { key: string; date: Date; words: number }[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    d.setDate(d.getDate() - i)
    const key = dayKey(d)
    out.push({ key, date: d, words: l[key] ?? 0 })
  }
  return out
}
/* ───────── waktu di meja (detik) dan kata dipangkas, per hari ───────── */
const HK = 'rtgs.hour.v1'
const TK = 'rtgs.time.v1'
const CK = 'rtgs.cut.v1'
const rd = (k: string): Log => {
  try {
    return JSON.parse(localStorage.getItem(k) ?? '{}') as Log
  } catch {
    return {}
  }
}
const wr = (k: string, v: Log) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* tidak kritis */
  }
}
export const getTime = () => rd(TK)
export const getCut = () => rd(CK)
export const setExtra = (time?: Log, cut?: Log) => {
  if (time) wr(TK, time)
  if (cut) wr(CK, cut)
}
export function addSeconds(n: number) {
  const t = rd(TK)
  const k = dayKey()
  t[k] = (t[k] ?? 0) + n
  wr(TK, t)
}
export function addCut(n: number) {
  if (n <= 0) return
  const c = rd(CK)
  const k = dayKey()
  c[k] = (c[k] ?? 0) + n
  wr(CK, c)
}
export const todayWords = () => getLog()[dayKey()] ?? 0
export const todayMinutes = () => Math.floor((getTime()[dayKey()] ?? 0) / 60)

/** Hari berturut-turut yang ada tulisannya, dihitung mundur dari hari ini (hari ini yang kosong tidak memutus). */
export function streak(): number {
  const l = getLog()
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  let n = 0
  if (!(l[dayKey(d)] > 0)) d.setDate(d.getDate() - 1)
  while (l[dayKey(d)] > 0) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

export type Range = '7' | '28' | '84'
export interface Slot { label: string; title: string; words: number; cut: number; secs: number; now: boolean }
/** Deret untuk bagan: 7 hari, 28 hari, atau 12 minggu (minggu mulai Senin). */
export function series(range: Range): Slot[] {
  const w = getLog(), c = getCut(), t = getTime()
  const fmtD = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' })
  const wd = new Intl.DateTimeFormat('id-ID', { weekday: 'short' })
  const at = (i: number) => {
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    d.setDate(d.getDate() - i)
    return d
  }
  if (range !== '84') {
    const n = Number(range)
    return Array.from({ length: n }, (_, j) => {
      const d = at(n - 1 - j), k = dayKey(d)
      return { label: n === 7 ? wd.format(d).slice(0, 3) : String(d.getDate()), title: fmtD.format(d), words: w[k] ?? 0, cut: c[k] ?? 0, secs: t[k] ?? 0, now: j === n - 1 }
    })
  }
  const mon = at(0)
  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7))
  return Array.from({ length: 12 }, (_, j) => {
    const start = new Date(mon)
    start.setDate(start.getDate() - (11 - j) * 7)
    let words = 0, cut = 0, secs = 0
    for (let k = 0; k < 7; k++) {
      const d = new Date(start)
      d.setDate(d.getDate() + k)
      const key = dayKey(d)
      words += w[key] ?? 0
      cut += c[key] ?? 0
      secs += t[key] ?? 0
    }
    return { label: fmtD.format(start).replace(/ .*/, ''), title: `Minggu ${fmtD.format(start)}`, words, cut, secs, now: j === 11 }
  })
}

/** Riwayat contoh agar bagan tidak kosong saat mencoba. */
export function seedLog() {
  const l = getLog()
  const base = [420, 0, 310, 650, 180, 0, 520, 740, 260, 0, 390, 480, 150]
  base.forEach((w, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (base.length - i))
    const k = dayKey(d)
    if (l[k] === undefined) l[k] = w
  })
  setLog(l)
  const t = getTime(), c = getCut()
  base.forEach((w, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (base.length - i))
    const k = dayKey(d)
    if (t[k] === undefined && w) {
      t[k] = Math.round(w * 4.2)
      c[k] = Math.round(w * 0.12)
    }
  })
  setExtra(t, c)
  if (!Object.keys(rd(HK)).length) wr(HK, { 6: 120, 7: 300, 8: 180, 9: 90, 13: 140, 19: 420, 20: 780, 21: 940, 22: 650, 23: 260 })
}

/** Menghitung menit di meja: hanya saat jendela terlihat dan ada gerak atau ketikan dalam 90 detik terakhir. */
let tracking = false
export function startTimeTracker() {
  if (tracking) return
  tracking = true
  let last = Date.now()
  const bump = () => { last = Date.now() }
  for (const ev of ['keydown', 'pointerdown', 'pointermove', 'wheel', 'touchstart']) window.addEventListener(ev, bump, { passive: true })
  window.setInterval(() => {
    if (document.visibilityState !== 'visible' || Date.now() - last > 90_000) return
    addSeconds(5)
    window.dispatchEvent(new Event('rtgs:tick'))
  }, 5000)
}

/* ───────── statistik lengkap untuk halaman Ikhtisar ───────── */
export const getHours = () => rd(HK)
export const setHours = (h?: Log) => { if (h) wr(HK, h) }

export function longestStreak(): number {
  const l = getLog()
  const ks = Object.keys(l).filter((k) => l[k] > 0).sort()
  let best = 0, run = 0, prev = ''
  for (const k of ks) {
    const d = new Date(k + 'T12:00:00')
    if (prev) {
      const p = new Date(prev + 'T12:00:00')
      p.setDate(p.getDate() + 1)
      run = dayKey(p) === k ? run + 1 : 1
    } else run = 1
    best = Math.max(best, run)
    prev = dayKey(d)
  }
  return best
}

export interface Heat { key: string; date: Date; words: number; fut: boolean }
/** 53 minggu ke belakang, kolom per minggu (Senin di atas). */
export function heatmap(): Heat[][] {
  const l = getLog()
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const mon = new Date(today)
  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7) - 52 * 7)
  const cols: Heat[][] = []
  for (let w = 0; w < 53; w++) {
    const col: Heat[] = []
    for (let d = 0; d < 7; d++) {
      const x = new Date(mon)
      x.setDate(x.getDate() + w * 7 + d)
      const key = dayKey(x)
      col.push({ key, date: x, words: l[key] ?? 0, fut: x > today })
    }
    cols.push(col)
  }
  return cols
}

/** Kata menurut hari dalam pekan (Senin..Minggu), jumlah dan hari menulisnya. */
export function weekdays(): { words: number; days: number }[] {
  const l = getLog()
  const out = Array.from({ length: 7 }, () => ({ words: 0, days: 0 }))
  for (const k of Object.keys(l)) {
    if (!(l[k] > 0)) continue
    const i = (new Date(k + 'T12:00:00').getDay() + 6) % 7
    out[i].words += l[k]
    out[i].days++
  }
  return out
}
