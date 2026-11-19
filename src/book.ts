// Halaman detail buku: sampul 3D yang bisa diputar, ringkasan, dan pintu masuk ke menulis.
import type { Ctx } from './ctx'
import { STAGES, ago, authorOf, escapeHtml, fmt, isJournal, kindColor, kindLabel, progress, stageLabel, workWords, type Cover, type StageId, type Work } from './model'
import { openForm } from './desk'
import { openExport } from './export'
import { fitTitles } from './fit'

type Side = 'front' | 'spine' | 'back'
const SIDES: { id: Side; label: string; hint: string }[] = [
  { id: 'front', label: 'Depan', hint: 'Rasio bebas; tampil di rak' },
  { id: 'spine', label: 'Punggung', hint: 'Gambar tegak, kira-kira 1 : 8' },
  { id: 'back', label: 'Belakang', hint: 'Sinopsis atau blurb' },
]

function resizeImage(file: File, max: number): Promise<{ url: string; ratio: number }> {
  return new Promise((res, rej) => {
    const src = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
      const w = Math.max(1, Math.round(img.naturalWidth * k))
      const h = Math.max(1, Math.round(img.naturalHeight * k))
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const g = c.getContext('2d')!
      g.fillStyle = '#fff'
      g.fillRect(0, 0, w, h)
      g.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(src)
      res({ url: c.toDataURL('image/jpeg', 0.88), ratio: w / h })
    }
    img.onerror = () => {
      URL.revokeObjectURL(src)
      rej(new Error('Gambar tidak bisa dibaca'))
    }
    img.src = src
  })
}

export function renderBook(root: HTMLElement, ctx: Ctx, work: Work): { destroy(): void } {
  document.title = `${work.title} · Ruang Tulis GS`
  const w = work
  const rerender = () => renderBook(root, ctx, w)
  const words = workWords(w)
  const pg = Math.round(progress(w) * 100)
  const lastPart = w.parts.find((p) => p.id === w.lastPartId) ?? w.parts[w.parts.length - 1]
  const cv: Cover = w.cover ?? {}
  const H = 330
  const W = Math.round(H * Math.max(0.45, Math.min(1.1, cv.ratio ?? 0.68)))
  const T = Math.max(26, Math.min(64, 22 + Math.round(w.parts.length * 3 + words / 4000)))
  const gen = `<div class="f-gen" style="--bk:${kindColor(w.kind)}"><b>${escapeHtml(w.title)}</b>${w.subtitle ? `<i>${escapeHtml(w.subtitle)}</i>` : ''}<span>${escapeHtml(authorOf(w))}</span></div>`
  const img = (u?: string) => (u ? `<img src="${escapeHtml(u)}" alt="" draggable="false">` : '')

  const slot = (s: (typeof SIDES)[number]) => {
    const u = cv[s.id]
    return `<div class="cv-slot" data-side="${s.id}">
      <div class="cv-th${u ? '' : ' empty'}">${u ? `<img src="${escapeHtml(u)}" alt="Sampul ${s.label.toLowerCase()}">` : '<span>Kosong</span>'}</div>
      <div class="cv-t"><b>${s.label}</b><small>${s.hint}</small>
        <span><button type="button" class="btn-text" data-up="${s.id}">${u ? 'Ganti' : 'Unggah'}</button>${u ? `<button type="button" class="btn-text danger" data-rm="${s.id}">Hapus</button>` : ''}</span></div>
    </div>`
  }

  root.innerHTML = `<div class="bd">
    <header class="bd-top">
      <a class="btn" href="#/">Kembali ke rak</a>
      <span class="wordmark">Ruang Tulis GS</span>
    </header>
    <main class="bd-main">
      <section class="bd-book" aria-label="Sampul buku">
        <div class="b3d" style="--W:${W}px;--H:${H}px;--T:${T}px;--ry:28deg;--rx:-5deg" tabindex="0" aria-label="Putar buku dengan menyeret">
          <div class="bk3">
            <div class="f f-front">${cv.front ? img(cv.front) : gen}</div>
            <div class="f f-back">${cv.back ? img(cv.back) : `<div class="f-gen back" style="--bk:${kindColor(w.kind)}"><span>${escapeHtml(authorOf(w))}</span></div>`}</div>
            <div class="f f-spine" style="--bk:${kindColor(w.kind)}">${cv.spine ? img(cv.spine) : `<b>${escapeHtml(w.title)}</b><span>${escapeHtml(authorOf(w))}</span>`}</div>
            <div class="f f-pages"></div><div class="f f-top"></div><div class="f f-bot"></div>
          </div>
          <div class="b3d-shadow"></div>
        </div>
        <div class="b3d-ctl" role="group" aria-label="Sisi buku">
          <button type="button" data-ry="28">Depan</button><button type="button" data-ry="90">Punggung</button><button type="button" data-ry="180">Belakang</button>
        </div>
        <p class="bd-hint">Seret untuk memutar.</p>
      </section>
      <section class="bd-info">
        <p class="bd-kind">${kindLabel(w.kind)}${isJournal(w) ? '' : ` · ${stageLabel(w.stage)}`}</p>
        <h1>${escapeHtml(w.title)}</h1>
        ${w.subtitle ? `<p class="bd-sub">${escapeHtml(w.subtitle)}</p>` : ''}
        <p class="bd-au">${escapeHtml(authorOf(w))}</p>
        <dl class="bd-meta">
          <div><dt>Kata</dt><dd>${fmt(words)}</dd></div>
          <div><dt>Bagian</dt><dd>${w.parts.length}</dd></div>
          ${isJournal(w) ? '' : `<div><dt>Target</dt><dd>${fmt(w.targetWords)}</dd></div>`}
          <div><dt>Diedit</dt><dd>${ago(w.touchedAt)}</dd></div>
        </dl>
        ${isJournal(w) ? '' : `<div class="mini" role="img" aria-label="${pg} persen dari target"><span style="width:${Math.max(pg, words ? 1.5 : 0)}%"></span></div>`}
        <div class="bd-acts">
          <a class="btn btn-primary" href="#/w/${w.id}${lastPart ? `?p=${lastPart.id}` : ''}">Buka buku</a>
          <button class="btn" data-act="edit">Atur detail</button>
          <button class="btn" data-act="export">Ekspor</button>
          <button class="btn danger" data-act="del">Hapus</button>
        </div>
        ${isJournal(w) ? '' : `<div class="bd-row"><label for="bs">Tahap</label><select id="bs">${STAGES.map((s) => `<option value="${s.id}"${w.stage === s.id ? ' selected' : ''}>${s.label}</option>`).join('')}</select></div>
        <div class="bd-row"><label for="bn">Langkah berikutnya</label><input id="bn" maxlength="140" placeholder="Satu hal kecil yang akan kamu kerjakan" value="${escapeHtml(w.nextStep)}"></div>`}
        ${w.lastSentence ? `<blockquote class="bd-last"><p>${escapeHtml(w.lastSentence)}</p></blockquote>` : ''}
        <h2 class="bd-h">Bagian</h2>
        <ol class="bd-parts">${w.parts.map((p) => `<li><a href="#/w/${w.id}?p=${p.id}"><span>${escapeHtml(p.title)}</span><em>${fmt(p.words)} kata</em></a></li>`).join('')}</ol>
        <h2 class="bd-h">Sampul</h2>
        <div class="cv-grid">${SIDES.map(slot).join('')}</div>
        <p class="bd-note">Sampul tersimpan di peramban ini dan ikut di berkas cadangan, jadi ukuran cadangan bertambah.</p>
        <input type="file" accept="image/*" hidden id="cvf">
      </section>
    </main>
  </div>`

  fitTitles(root, '.f-gen:not(.back) b', 14)
  const q = <T extends Element>(s: string) => root.querySelector<T>(s)!
  const box = q<HTMLElement>('.b3d')
  let ry = 28, rx = -5, drag: { x: number; y: number; ry: number; rx: number } | null = null
  const apply = () => {
    box.style.setProperty('--ry', `${ry}deg`)
    box.style.setProperty('--rx', `${rx}deg`)
  }
  box.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, ry, rx }
    box.setPointerCapture(e.pointerId)
    box.classList.add('drag')
  })
  box.addEventListener('pointermove', (e) => {
    if (!drag) return
    ry = drag.ry + (e.clientX - drag.x) * 0.55
    rx = Math.max(-35, Math.min(35, drag.rx - (e.clientY - drag.y) * 0.4))
    apply()
  })
  const end = () => { drag = null; box.classList.remove('drag') }
  box.addEventListener('pointerup', end)
  box.addEventListener('pointercancel', end)
  box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { ry -= 15; apply() } else if (e.key === 'ArrowRight') { ry += 15; apply() }
  })
  root.querySelectorAll<HTMLButtonElement>('.b3d-ctl button').forEach((b) =>
    b.addEventListener('click', () => {
      const target = Number(b.dataset.ry)
      ry = target + Math.round((ry - target) / 360) * 360
      rx = -5
      box.classList.add('snap')
      apply()
      setTimeout(() => box.classList.remove('snap'), 600)
    }),
  )

  const fileIn = q<HTMLInputElement>('#cvf')
  let side: Side = 'front'
  q<HTMLElement>('.bd').addEventListener('click', async (e) => {
    const t = e.target as HTMLElement
    const up = t.closest<HTMLElement>('[data-up]')
    const rm = t.closest<HTMLElement>('[data-rm]')
    const act = t.closest<HTMLElement>('[data-act]')?.dataset.act
    if (up) {
      side = up.dataset.up as Side
      fileIn.value = ''
      fileIn.click()
    } else if (rm) {
      const s = rm.dataset.rm as Side
      const next: Cover = { ...(w.cover ?? {}) }
      delete next[s]
      if (s === 'front') delete next.ratio
      w.cover = next.front || next.back || next.spine ? next : undefined
      await ctx.save(w)
      ctx.toast('Sampul dihapus')
      rerender()
    } else if (act === 'edit') openForm(ctx, w, rerender)
    else if (act === 'export') openExport(ctx, w)
    else if (act === 'del') {
      const btn = t.closest<HTMLButtonElement>('[data-act]')!
      if (btn.dataset.armed !== '1') {
        btn.dataset.armed = '1'
        btn.textContent = `Yakin? ${fmt(words)} kata ikut hilang`
        setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = 'Hapus' } }, 4000)
        return
      }
      await ctx.remove(w.id)
      ctx.toast('Karya dihapus')
      ctx.go('#/')
    }
  })
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files?.[0]
    if (!f) return
    try {
      const { url, ratio } = await resizeImage(f, side === 'spine' ? 900 : 1100)
      const next: Cover = { ...(w.cover ?? {}), [side]: url }
      if (side === 'front') next.ratio = ratio
      w.cover = next
      await ctx.save(w)
      ctx.toast('Sampul tersimpan')
      rerender()
    } catch (err) {
      ctx.toast(err instanceof Error ? err.message : 'Gagal memuat gambar')
    }
  })
  q<HTMLSelectElement>('#bs')?.addEventListener('change', async (e) => {
    w.stage = (e.target as HTMLSelectElement).value as StageId
    await ctx.save(w)
    ctx.toast('Tahap diperbarui')
    rerender()
  })
  q<HTMLInputElement>('#bn')?.addEventListener('change', async (e) => {
    w.nextStep = (e.target as HTMLInputElement).value.trim()
    await ctx.save(w)
    ctx.toast('Tersimpan')
  })
  return { destroy() {} }
}
