import { initPwa } from './pwa'
import './style.css'
import './skins.css'
import { applyPrefs, loadPrefs, savePrefs } from './prefs'
import { requestPersistence, store } from './store'
import type { Ctx } from './ctx'
import { escapeHtml, plain, type Work } from './model'
import { renderDesk } from './desk'
import { renderEditor, type EditorHandle } from './editor'
import { renderBook } from './book'
import { renderOverview } from './overview'
import { watchSprint } from './sprint'
import { startTimeTracker } from './log'
import { addTomb } from './tomb'
import { openWelcome } from './welcome'
import { getMode } from './mode'
import { openDrive, startDriveAuto } from './driveui'
import { bindSoundIndicator } from './soundui'

const root = document.getElementById('app')!
let current: EditorHandle | null = null
let toastTimer = 0

const ctx: Ctx = {
  works: [],
  prefs: loadPrefs(),
  async save(w) {
    const i = ctx.works.findIndex((x) => x.id === w.id)
    if (i >= 0) ctx.works[i] = w
    else ctx.works.push(w)
    await store.save(w)
  },
  async remove(id) {
    ctx.works = ctx.works.filter((w) => w.id !== id)
    addTomb('work', id)
    await store.remove(id)
  },
  async replaceAll(ws) {
    ctx.works = ws
    await store.replaceAll(ws)
  },
  setPrefs(p) {
    ctx.prefs = { ...ctx.prefs, ...p }
    savePrefs(ctx.prefs)
    applyPrefs(ctx.prefs)
  },
  go(hash) {
    if (location.hash === hash) void route()
    else location.hash = hash
  },
  toast(msg) {
    document.querySelector('.toast')?.remove()
    const t = document.createElement('div')
    t.className = 'toast'
    t.setAttribute('role', 'status')
    t.textContent = msg
    document.body.append(t)
    clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => t.remove(), 2600)
  },
  openFind,
}

let routing = Promise.resolve()
function route() {
  routing = routing.then(async () => {
    if (current) {
      await current.destroy()
      current = null
    }
    const m = location.hash.match(/^#\/w\/([^?]+)(?:\?p=(.+))?$/)
    const work = m ? ctx.works.find((w) => w.id === decodeURIComponent(m[1])) : null
    window.scrollTo(0, 0)
    const b = location.hash.match(/^#\/b\/([^?]+)/)
    const bw = b ? ctx.works.find((w) => w.id === decodeURIComponent(b[1])) : null
    if (location.hash === '#/ikhtisar') {
      const h = renderOverview(root, ctx)
      current = { destroy: async () => h.destroy() } as EditorHandle
    } else if (bw) {
      const h = renderBook(root, ctx, bw)
      current = { destroy: async () => h.destroy() } as EditorHandle
    } else if (m && work) {
      current = renderEditor(root, ctx, work, m[2] ? decodeURIComponent(m[2]) : null)
    } else {
      renderDesk(root, ctx)
    }
  })
  return routing
}

/* ───────── Cari di semua karya (Ctrl+K) ───────── */
function openFind() {
  if (document.querySelector('dialog.find-box')) return
  const dlg = document.createElement('dialog')
  dlg.className = 'find-box'
  dlg.innerHTML = `<form method="dialog" style="margin:0"><input type="search" placeholder="Cari kata di semua karya" aria-label="Cari di semua karya" autocomplete="off"><ul class="find-results" aria-live="polite"></ul></form>`
  document.body.append(dlg)
  const input = dlg.querySelector('input')!
  const list = dlg.querySelector('.find-results')!
  const render = () => {
    const q = input.value.trim().toLowerCase()
    list.innerHTML = ''
    if (q.length < 2) return
    let n = 0
    for (const w of ctx.works) {
      for (const p of w.parts) {
        const text = plain(p.md)
        const i = text.toLowerCase().indexOf(q)
        const inTitle = w.title.toLowerCase().includes(q) || p.title.toLowerCase().includes(q)
        if (i < 0 && !inTitle) continue
        if (n++ >= 40) break
        const from = Math.max(0, i - 50)
        const raw = i >= 0 ? text.slice(from, i + q.length + 70) : text.slice(0, 120)
        const esc = escapeHtml(raw)
        const snip = i >= 0 ? esc.replace(new RegExp(escapeHtml(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), (s) => `<mark>${s}</mark>`) : esc
        const li = document.createElement('li')
        li.innerHTML = `<button type="button"><div class="where">${escapeHtml(w.title)} · ${escapeHtml(p.title)}</div><div class="snip">${i > from ? '…' : ''}${snip}…</div></button>`
        li.firstElementChild!.addEventListener('click', () => {
          dlg.close()
          ctx.go(`#/w/${w.id}?p=${p.id}`)
        })
        list.append(li)
      }
    }
    if (!n) list.innerHTML = `<li class="find-empty">Tidak ada yang cocok dengan “${escapeHtml(input.value.trim())}”.</li>`
  }
  input.addEventListener('input', render)
  dlg.addEventListener('close', () => dlg.remove())
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close() })
  dlg.showModal()
  input.focus()
}

window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    openFind()
  }
})
window.addEventListener('hashchange', () => void route())

async function boot() {
  initPwa()
  applyPrefs(ctx.prefs)
  startTimeTracker()
  watchSprint()
  bindSoundIndicator()
  ctx.works = await store.list()
  void requestPersistence()
  await route()
  const home = location.hash === '' || location.hash === '#/' || location.hash === '#'
  const refresh = () => void route()
  if (getMode() === null) openWelcome({ first: true, done: () => { refresh(); if (getMode() === 'drive') openDrive(ctx, refresh) } })
  else if (home) openWelcome({ first: false, done: () => startDriveAuto(ctx, refresh) })
  else startDriveAuto(ctx, refresh)
}
void boot()

export type { Work }
