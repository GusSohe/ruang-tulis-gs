// Penggabungan dua salinan data (perangkat ini dan Drive) per butir: karya, bagian, ide, angka harian.
// Murni (tanpa DOM) supaya bisa diuji sendiri.
import type { Part, Work } from './model'
import { uid } from './model'
import type { Idea } from './ideas'
import type { Tomb } from './tomb'

export interface Snapshot {
  app: 'ruang-tulis-gs'
  version: number
  savedAt: number
  device: string
  works: Work[]
  log: Record<string, number>
  time: Record<string, number>
  cut: Record<string, number>
  hours: Record<string, number>
  ideas: Idea[]
  sprints: { at: number; minutes: number; goal: number; words: number }[]
  tombs: Tomb[]
}

const maxMap = (a: Record<string, number> = {}, b: Record<string, number> = {}) => {
  const o: Record<string, number> = { ...a }
  for (const [k, v] of Object.entries(b)) o[k] = Math.max(o[k] ?? 0, v)
  return o
}
const stampIdea = (i: Idea) => i.upd ?? i.at
const mergeTombs = (a: Tomb[] = [], b: Tomb[] = []) => {
  const m = new Map<string, Tomb>()
  for (const t of [...a, ...b]) {
    const k = t.kind + ':' + t.id
    if ((m.get(k)?.at ?? 0) < t.at) m.set(k, t)
  }
  return [...m.values()]
}

function mergeWork(l: Work, r: Work, lastSync: number, now: number): { work: Work; conflicts: number } {
  const [base, other] = l.touchedAt >= r.touchedAt ? [l, r] : [r, l]
  let conflicts = 0
  const oMap = new Map(other.parts.map((p) => [p.id, p]))
  const seen = new Set<string>()
  const parts: Part[] = []
  const extra: Part[] = []
  for (const p of base.parts) {
    seen.add(p.id)
    const o = oMap.get(p.id)
    if (o && o.md !== p.md && o.updatedAt > lastSync && p.updatedAt > lastSync) {
      // keduanya diubah sejak sinkron terakhir: yang lebih baru jadi utama, yang lama disimpan sebagai salinan
      const [win, lose] = p.updatedAt >= o.updatedAt ? [p, o] : [o, p]
      parts.push(win)
      extra.push({ ...lose, id: uid(), title: `${lose.title} (salinan konflik)`, updatedAt: now })
      conflicts++
    } else if (o && o.updatedAt > p.updatedAt) parts.push(o)
    else parts.push(p)
  }
  for (const o of other.parts) if (!seen.has(o.id)) parts.push(o)
  return { work: { ...base, parts: [...parts, ...extra], touchedAt: Math.max(l.touchedAt, r.touchedAt) }, conflicts }
}

export function mergeSnapshots(local: Snapshot, remote: Snapshot, lastSync: number, now = Date.now()): { snap: Snapshot; conflicts: number } {
  const tombs = mergeTombs(local.tombs, remote.tombs)
  const dead = (kind: Tomb['kind'], id: string, stamp: number) => tombs.some((t) => t.kind === kind && t.id === id && t.at > stamp)
  let conflicts = 0

  const lw = new Map(local.works.map((w) => [w.id, w]))
  const rw = new Map(remote.works.map((w) => [w.id, w]))
  const works: Work[] = []
  for (const id of new Set([...lw.keys(), ...rw.keys()])) {
    const l = lw.get(id), r = rw.get(id)
    const w = l && r ? (() => { const m = mergeWork(l, r, lastSync, now); conflicts += m.conflicts; return m.work })() : (l ?? r)!
    if (!dead('work', id, w.touchedAt)) works.push(w)
  }

  const li = new Map(local.ideas.map((i) => [i.id, i]))
  const ri = new Map(remote.ideas.map((i) => [i.id, i]))
  const ideas: Idea[] = []
  for (const id of new Set([...li.keys(), ...ri.keys()])) {
    const a = li.get(id), b = ri.get(id)
    const i = a && b ? (stampIdea(a) >= stampIdea(b) ? a : b) : (a ?? b)!
    if (!dead('idea', id, stampIdea(i))) ideas.push(i)
  }

  const sp = new Map<string, Snapshot['sprints'][number]>()
  for (const s of [...(local.sprints ?? []), ...(remote.sprints ?? [])]) sp.set(`${s.at}:${s.minutes}`, s)

  return {
    conflicts,
    snap: {
      app: 'ruang-tulis-gs', version: 2, savedAt: now, device: local.device,
      works, ideas,
      log: maxMap(local.log, remote.log), time: maxMap(local.time, remote.time), cut: maxMap(local.cut, remote.cut), hours: maxMap(local.hours, remote.hours),
      sprints: [...sp.values()].sort((a, b) => a.at - b.at), tombs,
    },
  }
}

/** Stempel perubahan terbaru di salinan ini, untuk tahu apakah ada yang perlu diunggah. */
export const localStamp = (s: Pick<Snapshot, 'works' | 'ideas' | 'tombs'>) =>
  Math.max(0, ...s.works.map((w) => Math.max(w.touchedAt, ...w.parts.map((p) => p.updatedAt))), ...s.ideas.map(stampIdea), ...s.tombs.map((t) => t.at))
