// Tanda hapus: supaya sesuatu yang dihapus di satu perangkat tidak muncul lagi dari perangkat lain saat disinkronkan.
const KEY = 'rtgs.tomb.v1'
export interface Tomb { kind: 'work' | 'idea'; id: string; at: number }

export function getTombs(): Tomb[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? (v as Tomb[]) : []
  } catch {
    return []
  }
}
export function setTombs(list?: Tomb[]) {
  if (!Array.isArray(list)) return
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(-2000))) } catch { /* tidak kritis */ }
}
export function addTomb(kind: Tomb['kind'], id: string) {
  setTombs([...getTombs().filter((t) => !(t.kind === kind && t.id === id)), { kind, id, at: Date.now() }])
}
