// Google Drive: masuk (Google Identity Services), folder "Ruang Tulis GS", unggah, unduh. Hanya izin drive.file:
// aplikasi hanya melihat berkas yang ia buat sendiri, tidak seluruh Drive.
import type { Ctx } from './ctx'
import { getCut, getHours, getLog, getTime, setExtra, setHours, setLog } from './log'
import { getIdeas, setIdeas } from './ideas'
import { getSprints, setSprints } from './sprint'
import { getTombs, setTombs } from './tomb'
import { localStamp, mergeSnapshots, type Snapshot } from './sync'

const FOLDER = 'Ruang Tulis GS'
const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const GIS = 'https://accounts.google.com/gsi/client'
const API = 'https://www.googleapis.com/drive/v3'
const UP = 'https://www.googleapis.com/upload/drive/v3'
const KEEP = 14

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* tidak kritis */ } },
  del: (k: string) => { try { localStorage.removeItem(k) } catch { /* tidak kritis */ } },
}
/** Client ID: bisa dibawa saat build (VITE_GOOGLE_CLIENT_ID) atau ditempel pengguna di dialog Drive. */
export const getClientId = () => ls.get('rtgs.gcid') || ((import.meta as { env?: Record<string, string> }).env?.VITE_GOOGLE_CLIENT_ID ?? '')
export const setClientId = (v: string) => (v.trim() ? ls.set('rtgs.gcid', v.trim()) : ls.del('rtgs.gcid'))
export const isLinked = () => ls.get('rtgs.drive.on') === '1'
export const lastPush = () => Number(ls.get('rtgs.drive.push')) || 0
export const device = () => {
  let d = ls.get('rtgs.device')
  if (!d) { d = Math.random().toString(36).slice(2, 10); ls.set('rtgs.device', d) }
  return d
}

export class DriveError extends Error {}

/* ───────── token ───────── */
interface TokenResp { access_token?: string; expires_in?: number; error?: string }
interface TokenClient { requestAccessToken(o?: { prompt?: string }): void }
declare global { interface Window { google?: { accounts: { oauth2: { initTokenClient(c: { client_id: string; scope: string; callback: (r: TokenResp) => void; error_callback?: (e: { type?: string }) => void }): TokenClient; revoke(t: string, cb: () => void): void } } } } }

let token = '', tokenExp = 0
let client: TokenClient | null = null
let pending: { ok: (t: string) => void; fail: (e: Error) => void } | null = null

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  return new Promise((ok, fail) => {
    const s = document.createElement('script')
    s.src = GIS
    s.async = true
    s.onload = () => ok()
    s.onerror = () => fail(new DriveError('Tidak bisa memuat layanan masuk Google. Periksa koneksi internet.'))
    document.head.append(s)
  })
}

export function canUseGoogle(): string | null {
  if (location.protocol === 'file:') return 'Sambungan Google tidak berjalan dari berkas yang dibuka langsung. Buka aplikasi lewat alamat https (misalnya GitHub Pages).'
  if (!getClientId()) return 'Client ID Google belum diisi.'
  if (!navigator.onLine) return 'Sedang offline.'
  return null
}

/** Minta token. interactive=false mencoba diam-diam (tanpa jendela) dan gagal bila perlu klik pengguna. */
export async function getToken(interactive: boolean): Promise<string> {
  if (token && Date.now() < tokenExp - 60_000) return token
  const why = canUseGoogle()
  if (why) throw new DriveError(why)
  await loadGis()
  if (!client) {
    client = window.google!.accounts.oauth2.initTokenClient({
      client_id: getClientId(),
      scope: SCOPE,
      callback: (r) => {
        if (r.access_token) {
          token = r.access_token
          tokenExp = Date.now() + (r.expires_in ?? 3600) * 1000
          pending?.ok(token)
        } else pending?.fail(new DriveError(r.error === 'access_denied' ? 'Izin ditolak.' : 'Masuk Google gagal.'))
        pending = null
      },
      error_callback: (e) => { pending?.fail(new DriveError(e.type === 'popup_closed' ? 'Jendela masuk ditutup.' : 'Masuk Google gagal.')); pending = null },
    })
  }
  return new Promise<string>((ok, fail) => {
    pending = { ok, fail }
    client!.requestAccessToken({ prompt: interactive ? (isLinked() ? '' : 'consent') : 'none' })
  })
}

export function unlink() {
  const t = token
  token = ''; tokenExp = 0
  ls.del('rtgs.drive.on'); ls.del('rtgs.drive.push'); ls.del('rtgs.drive.seen'); ls.del('rtgs.drive.sync'); ls.del('rtgs.drive.folder'); ls.del('rtgs.drive.daily')
  if (t) try { window.google?.accounts.oauth2.revoke(t, () => {}) } catch { /* tidak kritis */ }
}

/* ───────── REST ───────── */
async function api(path: string, init: RequestInit = {}, base = API): Promise<Response> {
  const t = await getToken(false)
  const res = await fetch(base + path, { ...init, headers: { Authorization: `Bearer ${t}`, ...(init.headers ?? {}) } })
  if (res.status === 401) { token = ''; throw new DriveError('Sesi Google berakhir. Sambungkan ulang.') }
  if (!res.ok) throw new DriveError(`Drive menolak permintaan (${res.status}).`)
  return res
}
const q = (s: string) => encodeURIComponent(s)

async function folderId(): Promise<string> {
  const c = ls.get('rtgs.drive.folder')
  if (c) {
    try { const r = await api(`/files/${c}?fields=id,trashed`); if (!(await r.json()).trashed) return c } catch { /* cari ulang */ }
  }
  const r = await api(`/files?q=${q(`name='${FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id)`)
  let id: string = (await r.json()).files?.[0]?.id
  if (!id) {
    const cr = await api('/files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: FOLDER, mimeType: 'application/vnd.google-apps.folder' }) })
    id = (await cr.json()).id
  }
  ls.set('rtgs.drive.folder', id)
  return id
}
async function findFile(parent: string, name: string): Promise<string | null> {
  const r = await api(`/files?q=${q(`name='${name}' and '${parent}' in parents and trashed=false`)}&fields=files(id)`)
  return (await r.json()).files?.[0]?.id ?? null
}
async function putJson(parent: string, name: string, body: string) {
  const id = await findFile(parent, name)
  if (id) { await api(`/files/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body }, UP); return }
  const b = '-rtgs-' + Math.random().toString(36).slice(2)
  const multi = `--${b}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ name, parents: [parent] })}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`
  await api('/files?uploadType=multipart', { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${b}` }, body: multi }, UP)
}
async function pruneDaily(parent: string) {
  const r = await api(`/files?q=${q(`name contains 'cadangan-' and '${parent}' in parents and trashed=false`)}&fields=files(id,name)&pageSize=100`)
  const files: { id: string; name: string }[] = (await r.json()).files ?? []
  files.sort((a, b) => b.name.localeCompare(a.name))
  for (const f of files.slice(KEEP)) await api(`/files/${f.id}`, { method: 'DELETE' }).catch(() => {})
}

/* ───────── salinan data ───────── */
export function snapshot(ctx: Ctx): Snapshot {
  return {
    app: 'ruang-tulis-gs', version: 2, savedAt: Date.now(), device: device(),
    works: ctx.works, log: getLog(), time: getTime(), cut: getCut(), hours: getHours(),
    ideas: getIdeas(), sprints: getSprints(), tombs: getTombs(),
  }
}
export async function applySnapshot(ctx: Ctx, s: Snapshot) {
  await ctx.replaceAll(s.works)
  setLog(s.log); setExtra(s.time, s.cut); setHours(s.hours)
  setIdeas(s.ideas); setSprints(s.sprints); setTombs(s.tombs)
}

export interface Remote { snap: Snapshot; fresh: boolean }
/** Baca salinan terbaru di Drive. fresh = ditulis perangkat lain sejak terakhir kali kita lihat. */
export async function fetchRemote(): Promise<Remote | null> {
  const dir = await folderId()
  const id = await findFile(dir, 'terbaru.json')
  if (!id) return null
  const snap = (await (await api(`/files/${id}?alt=media`)).json()) as Snapshot
  if (snap?.app !== 'ruang-tulis-gs' || !Array.isArray(snap.works)) throw new DriveError('Berkas di Drive bukan milik Ruang Tulis GS.')
  if (snap.version > 2) throw new DriveError('Salinan di Drive dibuat versi aplikasi yang lebih baru. Perbarui aplikasi dulu.')
  const seen = Number(ls.get('rtgs.drive.seen')) || 0
  return { snap, fresh: snap.device !== device() && snap.savedAt > seen }
}

export async function push(ctx: Ctx, snap = snapshot(ctx)) {
  const dir = await folderId()
  const body = JSON.stringify(snap)
  await putJson(dir, 'terbaru.json', body)
  const day = new Date().toISOString().slice(0, 10)
  if (ls.get('rtgs.drive.daily') !== day) {
    await putJson(dir, `cadangan-${day}.json`, body)
    ls.set('rtgs.drive.daily', day)
    await pruneDaily(dir)
  }
  const now = Date.now()
  ls.set('rtgs.drive.push', String(now))
  ls.set('rtgs.drive.seen', String(snap.savedAt))
  ls.set('rtgs.drive.sync', String(now))
  ls.set('rtgs.drive.stamp', String(localStamp(snap)))
  ls.set('rtgs.backup.at', String(now))
}

/** Gabungkan salinan Drive ke perangkat ini lalu unggah hasilnya. Mengembalikan jumlah salinan konflik. */
export async function pullAndPush(ctx: Ctx, remote: Snapshot): Promise<number> {
  const last = Number(ls.get('rtgs.drive.sync')) || 0
  const { snap, conflicts } = mergeSnapshots(snapshot(ctx), remote, last)
  await applySnapshot(ctx, snap)
  await push(ctx, snap)
  return conflicts
}

export const hasLocalChanges = (ctx: Ctx) => localStamp(snapshot(ctx)) > (Number(ls.get('rtgs.drive.stamp')) || 0)
export const markLinked = () => ls.set('rtgs.drive.on', '1')
