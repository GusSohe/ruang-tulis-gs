// Lapisan penyimpanan. Prototipe browser memakai IndexedDB.
// Versi desktop nanti memakai adapter berkas (folder berisi .md) dengan antarmuka yang sama.
import { createStore, del, entries, set } from 'idb-keyval'
import type { Work } from './model'

export interface Store {
  list(): Promise<Work[]>
  save(w: Work): Promise<void>
  remove(id: string): Promise<void>
  replaceAll(ws: Work[]): Promise<void>
}

const db = createStore('ruang-tulis-gs', 'karya')

export const store: Store = {
  async list() {
    const all = await entries(db)
    return all.map(([, v]) => v as Work)
  },
  async save(w) {
    await set(w.id, JSON.parse(JSON.stringify(w)), db)
  },
  async remove(id) {
    await del(id, db)
  },
  async replaceAll(ws) {
    const all = await entries(db)
    await Promise.all(all.map(([k]) => del(k, db)))
    await Promise.all(ws.map((w) => set(w.id, JSON.parse(JSON.stringify(w)), db)))
  },
}

export async function requestPersistence() {
  try {
    await navigator.storage?.persist?.()
  } catch {
    /* tidak kritis */
  }
}

export function downloadBackup(works: Work[], log: Record<string, number> = {}, ideas: unknown[] = [], extra: { time?: Record<string, number>; cut?: Record<string, number>; hours?: Record<string, number>; sprints?: unknown[]; tombs?: unknown[] } = {}) {
  const stamp = new Date().toISOString().slice(0, 10)
  const blob = new Blob([JSON.stringify({ app: 'ruang-tulis-gs', version: 2, works, log, ideas, ...extra }, null, 2)], {
    type: 'application/json',
  })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `ruang-tulis-gs-cadangan-${stamp}.json`
  try { localStorage.setItem('rtgs.backup.at', String(Date.now())) } catch { /* tidak kritis */ }
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

export function parseBackup(text: string): Work[] {
  const data = JSON.parse(text)
  if (data?.app !== 'ruang-tulis-gs' || !Array.isArray(data.works)) throw new Error('Berkas ini bukan cadangan Ruang Tulis GS.')
  if (typeof data.version === 'number' && data.version > 2) throw new Error('Cadangan ini dibuat oleh versi aplikasi yang lebih baru. Perbarui aplikasi dulu.')
  return data.works as Work[]
}
