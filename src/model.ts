// Model data dan fungsi bantu murni (tanpa DOM, tanpa penyimpanan).

export type StageId = 'gagasan' | 'kerangka' | 'draf' | 'revisi' | 'final' | 'terbit'
export type KindId = 'novel' | 'kumpulan' | 'esai' | 'memoar' | 'makalah' | 'filsafat' | 'sajak' | 'kutipan' | 'monolog' | 'ebook' | 'jurnal' | 'lain'

export const STAGES: { id: StageId; label: string }[] = [
  { id: 'gagasan', label: 'Gagasan' },
  { id: 'kerangka', label: 'Kerangka' },
  { id: 'draf', label: 'Draf kasar' },
  { id: 'revisi', label: 'Revisi' },
  { id: 'final', label: 'Final' },
  { id: 'terbit', label: 'Terbit' },
]

export const DEFAULT_AUTHOR = 'Gus Sohe'
export const PRO_AUTHOR = 'Arief Sofyan'

export const KINDS: { id: KindId; label: string; target: number; firstPart: string; color: string; author?: string }[] = [
  { id: 'novel', label: 'Novel', target: 60000, firstPart: 'Bab 1', color: '#8f2f22' },
  { id: 'filsafat', label: 'Buku filsafat', target: 50000, firstPart: 'Bab 1', color: '#26344f' },
  { id: 'kumpulan', label: 'Kumpulan esai', target: 40000, firstPart: 'Esai 1', color: '#2f5a4a' },
  { id: 'esai', label: 'Esai tunggal', target: 3000, firstPart: 'Naskah', color: '#5f5b2c' },
  { id: 'memoar', label: 'Memoar', target: 50000, firstPart: 'Bagian 1', color: '#5a3a26' },
  { id: 'sajak', label: 'Sajak atau kumpulan sajak', target: 2500, firstPart: 'Sajak 1', color: '#5a3350' },
  { id: 'kutipan', label: 'Kutipan atau aforisme', target: 1500, firstPart: 'Kutipan 1', color: '#8a6a22' },
  { id: 'monolog', label: 'Monolog atau naskah serial', target: 6000, firstPart: 'Episode 1', color: '#40395f' },
  { id: 'ebook', label: 'E-book profesional (perizinan, hukum)', target: 15000, firstPart: 'Bab 1', color: '#2d4f66', author: PRO_AUTHOR },
  { id: 'makalah', label: 'Makalah kuliah', target: 4000, firstPart: 'Naskah', color: '#4a4038', author: PRO_AUTHOR },
  { id: 'jurnal', label: 'Catatan harian atau jurnal', target: 1000, firstPart: 'Hari ini', color: '#4a3426' },
  { id: 'lain', label: 'Lainnya', target: 10000, firstPart: 'Bagian 1', color: '#4b4b4b' },
]

export interface Part {
  id: string
  title: string
  md: string
  words: number
  updatedAt: number
}

export interface Cover {
  front?: string // data URL
  back?: string
  spine?: string
  ratio?: number // lebar/tinggi cover depan
}

export type PaperId = 'bebas' | 'novel' | 'a5' | 'b5' | 'a4' | 'f4'
export const PAPERS: { id: PaperId; label: string; w: number; h: number }[] = [
  { id: 'bebas', label: 'Bebas (ikut lebar kolom)', w: 0, h: 0 },
  { id: 'novel', label: 'Novel 13 × 20 cm', w: 130, h: 200 },
  { id: 'a5', label: 'A5 14,8 × 21 cm', w: 148, h: 210 },
  { id: 'b5', label: 'B5 17,6 × 25 cm', w: 176, h: 250 },
  { id: 'a4', label: 'A4 / HVS 21 × 29,7 cm', w: 210, h: 297 },
  { id: 'f4', label: 'F4 / Folio 21,5 × 33 cm', w: 215, h: 330 },
]

export interface Work {
  id: string
  title: string
  kind: KindId
  stage: StageId
  targetWords: number
  subtitle?: string
  author?: string
  cover?: Cover
  nextStep: string
  asleep: boolean
  createdAt: number
  touchedAt: number
  lastPartId: string | null
  lastSentence: string
  parts: Part[]
}

export const kindColor = (id: KindId) => KINDS.find((k) => k.id === id)?.color ?? '#4b4b4b'
export const isJournal = (w: Work) => w.kind === 'jurnal'
export const authorOf = (w: Work) => w.author?.trim() || KINDS.find((k) => k.id === w.kind)?.author || DEFAULT_AUTHOR

export function todayTitle(d = new Date()): string {
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d)
}

export const stageLabel = (id: StageId) => STAGES.find((s) => s.id === id)?.label ?? id
export const kindLabel = (id: KindId) => KINDS.find((k) => k.id === id)?.label ?? id

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/** Markdown → teks polos (cukup untuk pencarian dan penghitungan). */
export function plain(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*(?:---|\*\*\*)\s*$/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>~]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Satu kata = rangkaian huruf/angka; "pelan-pelan" dihitung satu kata, seperti di Word. */
export function countWords(text: string): number {
  const m = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)
  return m ? m.length : 0
}

export function lastSentence(md: string): string {
  const paras = plain(md).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const last = paras[paras.length - 1]
  if (!last) return ''
  const sentences = last.split(/(?<=[.!?…])\s+/)
  let s = sentences[sentences.length - 1].replace(/\s+/g, ' ')
  if (s.length > 220) s = '…' + s.slice(s.length - 200).replace(/^\S*\s/, '')
  return s
}

export const workWords = (w: Work) => w.parts.reduce((n, p) => n + p.words, 0)

export function progress(w: Work): number {
  if (!w.targetWords) return 0
  return Math.max(0, Math.min(1, workWords(w) / w.targetWords))
}

const nf = new Intl.NumberFormat('id-ID')
export const fmt = (n: number) => nf.format(Math.round(n))

export function ago(ts: number, now = Date.now()): string {
  const days = Math.floor((startOfDay(now) - startOfDay(ts)) / 86_400_000)
  if (days <= 0) return 'hari ini'
  if (days === 1) return 'kemarin'
  if (days < 7) return `${days} hari lalu`
  if (days < 30) return `${Math.floor(days / 7)} minggu lalu`
  if (days < 365) return `${Math.floor(days / 30)} bulan lalu`
  return `${Math.floor(days / 365)} tahun lalu`
}
const startOfDay = (t: number) => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function newPart(title: string, md = ''): Part {
  return { id: uid(), title, md, words: countWords(plain(md)), updatedAt: Date.now() }
}

export function newWork(init: { title: string; kind: KindId; stage: StageId; targetWords: number; subtitle?: string; author?: string }): Work {
  const k = KINDS.find((x) => x.id === init.kind)!
  const part = newPart(init.kind === 'jurnal' ? todayTitle() : k.firstPart)
  const now = Date.now()
  return {
    id: uid(),
    title: init.title.trim() || 'Tanpa judul',
    kind: init.kind,
    subtitle: init.subtitle?.trim() || undefined,
    author: init.author?.trim() || undefined,
    stage: init.stage,
    targetWords: init.targetWords > 0 ? init.targetWords : k.target,
    nextStep: '',
    asleep: false,
    createdAt: now,
    touchedAt: now,
    lastPartId: part.id,
    lastSentence: '',
    parts: [part],
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
