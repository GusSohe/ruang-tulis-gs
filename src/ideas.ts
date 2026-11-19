// Ide-ide singkat (sticky note). Kecil, jadi cukup di localStorage; ikut dicadangkan bersama karya.
import { uid } from './model'
import { addTomb } from './tomb'

const KEY = 'rtgs.ideas.v1'
export interface Idea {
  id: string
  title?: string
  text: string
  tone: number // 0-3, warna kertas
  at: number
  upd?: number // waktu ubah terakhir, dipakai saat menggabungkan antarperangkat
}

export function getIdeas(): Idea[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? (v as Idea[]).sort((a, b) => b.at - a.at) : []
  } catch {
    return []
  }
}
export function setIdeas(list: Idea[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* tidak kritis */
  }
}
export const ideaTitle = (i: Idea) => i.title?.trim() || (i.text.length > 48 ? i.text.slice(0, 46).trimEnd() + '…' : i.text)

export function addIdea(title: string, text: string, at = Date.now()): Idea {
  const list = getIdeas()
  const idea: Idea = { id: uid(), title: title.trim(), text: text.trim(), tone: list.length % 4, at, upd: Date.now() }
  setIdeas([idea, ...list])
  return idea
}
export function updateIdea(id: string, title: string, text: string, at?: number) {
  setIdeas(getIdeas().map((i) => (i.id === id ? { ...i, title: title.trim(), text: text.trim(), at: at ?? i.at, upd: Date.now() } : i)))
}
export function removeIdea(id: string) {
  addTomb('idea', id)
  setIdeas(getIdeas().filter((i) => i.id !== id))
}
export function seedIdeas() {
  if (getIdeas().length) return
  const now = Date.now()
  const t: [string, string][] = [
    ['Sunyi sebagai jawaban', 'Esai: sunyi bukan ketiadaan jawaban, tetapi jawaban yang menolak bentuk.'],
    ['Tokoh yang terlambat', 'Tokoh yang selalu terlambat satu kalimat dari percakapannya sendiri.'],
    ['Kota yang lupa namanya', 'Sajak tentang kota yang pelan-pelan lupa nama dirinya.'],
    ['Bertanya dan menuntut', 'Apa beda bertanya dengan menuntut jawaban?'],
  ]
  setIdeas(t.map(([title, text], i) => ({ id: uid() + i, title, text, tone: i % 4, at: now - i * 3_600_000 })))
}
