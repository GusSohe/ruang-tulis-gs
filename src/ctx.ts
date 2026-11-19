import type { Prefs } from './prefs'
import type { Work } from './model'

export interface Ctx {
  works: Work[]
  prefs: Prefs
  save(w: Work): Promise<void>
  remove(id: string): Promise<void>
  replaceAll(ws: Work[]): Promise<void>
  setPrefs(p: Partial<Prefs>): void
  go(hash: string): void
  toast(msg: string): void
  openFind(): void
}
