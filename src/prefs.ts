// Pengaturan gaya menulis, disimpan per perangkat.
import { PAPERS, type PaperId } from './model'
export type ThemeId = 'siang' | 'malam'
export type SkinId = 'perpus' | 'neon' | 'glossy' | 'sumi' | 'woodblock'
export const SKINS: { id: SkinId; label: string; desc: string; sw: Record<ThemeId, [string, string, string]> }[] = [
  { id: 'perpus', label: 'Perpustakaan', desc: 'Rak kayu dan lampu baca', sw: { siang: ['#b98c5e', '#6d4b28', '#f1ebdd'], malam: ['#2b1d14', '#4a3119', '#f0b860'] } },
  { id: 'neon', label: 'Neon', desc: 'Tabung cahaya di ruang gelap', sw: { siang: ['#f3eeff', '#ff2fa8', '#12b5ff'], malam: ['#0b0820', '#ff2fa8', '#19e3ff'] } },
  { id: 'glossy', label: 'Glossy', desc: 'Kaca dan plastik mengilap', sw: { siang: ['#cfe9ff', '#6aa7ff', '#ffffff'], malam: ['#10173a', '#4f7dff', '#9ad0ff'] } },
  { id: 'sumi', label: 'Sumi ink', desc: 'Tinta hitam di kertas nasi', sw: { siang: ['#efeae0', '#1d1b19', '#c0392b'], malam: ['#121110', '#e8e2d4', '#c0392b'] } },
  { id: 'woodblock', label: 'Woodblock print', desc: 'Cetak kayu: indigo, krem, merah', sw: { siang: ['#efe3c6', '#1f3a68', '#d4502a'], malam: ['#14213d', '#e9dfc2', '#e0553a'] } },
]
export type FontId = 'literata' | 'atkinson' | 'mesin'

export interface Prefs {
  theme: ThemeId
  skin: SkinId
  font: FontId
  size: number // px
  measure: number // lebar kolom dalam karakter (ch)
  leading: number // jarak baris
  indent: boolean // paragraf menjorok (true) atau berjarak (false)
  align: 'kiri' | 'tengah' | 'kanan' | 'rata' // perataan teks
  paper: PaperId // ukuran halaman tampilan menulis
  focusPara: boolean // redupkan paragraf lain
  centerCaret: boolean // tahan kursor di tengah layar
  dailyGoal: number // target kata per hari
  dailyMinutes: number // target menit di meja per hari
  lampOn: boolean // lampu baca menyala
  warmth: number // 0 sejuk .. 100 hangat
  glow: number // kecerahan lampu 0..100
  dim: number // gelap di sekeliling sorot 0..100
  beam: number // lebar sorot, derajat
  follow: boolean // sorot mengikuti kursor
  sound: boolean // suara mesin tik
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'siang',
  skin: 'perpus',
  font: 'literata',
  size: 20,
  measure: 62,
  leading: 1.7,
  indent: true,
  align: 'kiri',
  paper: 'bebas',
  focusPara: false,
  centerCaret: true,
  dailyGoal: 300,
  dailyMinutes: 30,
  lampOn: true,
  warmth: 70,
  glow: 75,
  dim: 35,
  beam: 100,
  follow: true,
  sound: true,
}

const KEY = 'rtgs.prefs.v1'

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch {
    /* pakai bawaan */
  }
  return { ...DEFAULT_PREFS }
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* tidak kritis */
  }
}

export function applyPrefs(p: Prefs) {
  const r = document.documentElement
  r.dataset.theme = p.theme
  r.dataset.skin = SKINS.some((x) => x.id === p.skin) ? p.skin : 'perpus'
  r.dataset.font = p.font
  r.dataset.indent = p.indent ? 'ya' : 'tidak'
  r.dataset.align = p.align ?? 'kiri'
  const pp = PAPERS.find((x) => x.id === (p.paper ?? 'bebas'))!
  r.dataset.paper = pp.id
  r.style.setProperty('--paper-w', String(pp.w || 0))
  r.dataset.focus = p.focusPara ? 'ya' : 'tidak'
  r.style.setProperty('--size', `${p.size}px`)
  r.style.setProperty('--measure', `${p.measure}`)
  r.style.setProperty('--leading', `${p.leading}`)
  // lampu: warna dari sejuk ke hangat
  const t = p.warmth / 100
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t)
  r.style.setProperty('--lamp-rgb', `${mix(176, 255)},${mix(204, 184)},${mix(255, 98)}`)
  r.style.setProperty('--glow', String(((p.glow / 100) * 0.5).toFixed(3)))
  r.style.setProperty('--dark', String(((p.dim / 100) * 0.72).toFixed(3)))
  r.style.setProperty('--half', `${p.beam / 2}deg`)
  r.dataset.lamp = p.lampOn ? 'on' : 'off'
}
