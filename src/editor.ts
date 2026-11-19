import { Editor, Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { Placeholder } from '@tiptap/extensions'
import Typography from '@tiptap/extension-typography'
import { Plugin } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Ctx } from './ctx'
import { addCut, addWords, todayMinutes, todayWords } from './log'
import { openSound, soundIcon } from './soundui'
import { getActive, sprintLabel, sprintWords } from './sprint'
import * as snd from './sound'
import { openExport } from './export'
import { SKINS } from './prefs'
import { PAPERS, countWords, escapeHtml, fmt, lastSentence, newPart, plain, workWords, progress, type PaperId, type Part, type Work } from './model'

export interface EditorHandle {
  destroy(): Promise<void>
}

/** Menandai blok teratas tempat kursor berada, agar bisa menyorot satu paragraf. */
const ActiveBlock = Extension.create({
  name: 'activeBlock',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const { $from } = state.selection
            if ($from.depth < 1) return null
            const start = $from.before(1)
            const node = state.doc.nodeAt(start)
            if (!node) return null
            return DecorationSet.create(state.doc, [Decoration.node(start, start + node.nodeSize, { class: 'is-active' })])
          },
        },
      }),
    ]
  },
})

export function renderEditor(root: HTMLElement, ctx: Ctx, work: Work, partId: string | null): EditorHandle {
  const part: Part = work.parts.find((p) => p.id === (partId ?? work.lastPartId)) ?? work.parts[0]
  document.title = `${part.title} · ${work.title}`

  root.innerHTML = `<div class="ed" data-typing="false">
    <div class="lamp" aria-hidden="true"></div>
    <div class="desk-base" aria-hidden="true"></div>
    <div class="lamp-rail" aria-hidden="true"></div>
    <div class="lamp-head" aria-hidden="true"></div>
    <header class="ed-bar">
      <a class="btn" href="#/">Kembali ke meja</a>
      <div class="crumb"><span class="crumb-work">${escapeHtml(work.title)}</span><span id="saved" aria-live="polite">Tersimpan</span></div>
      <div class="ed-tools">
        <button class="btn snd-btn" id="b-sound" aria-haspopup="dialog"><i class="snd-ind">${soundIcon}</i>Suara</button>
        <button class="btn" id="b-export">Ekspor</button>
        <button class="btn" id="b-parts" aria-expanded="false" aria-controls="parts">Bagian</button>
        <button class="btn" id="b-style" aria-expanded="false" aria-controls="style">Gaya tulis</button>
      </div>
    </header>
    <aside class="parts" id="parts" data-open="false" aria-label="Bagian karya"></aside>
    <section class="style-panel" id="style" hidden aria-label="Gaya tulis"></section>
    <main class="page">
      <div class="sheet">
        <input class="part-title" id="pt" aria-label="Judul bagian" maxlength="120" value="${escapeHtml(part.title)}">
        <div class="prose" id="prose"></div>
      </div>
    </main>
    <footer class="ed-foot">
      <div class="counts"><span id="c-part"></span><span id="c-work"></span><span id="c-sprint" class="c-sprint" hidden></span></div>
      <div class="meter" role="img" aria-label="Kemajuan menuju target menulis hari ini"><span class="ink" id="meter"></span><span class="end"></span></div>
    </footer>
  </div>`

  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!
  const ed = $('.ed')
  const savedEl = $('#saved')
  let dirty = false
  let timer = 0
  let pointerDown = false

  const editor = new Editor({
    element: $('#prose'),
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Markdown,
      Typography,
      Placeholder.configure({ placeholder: 'Mulai dari satu kalimat.' }),
      ActiveBlock,
    ],
    content: part.md,
    contentType: 'markdown',
    editorProps: {
      attributes: { 'aria-label': 'Naskah', spellcheck: 'true', lang: 'id' },
      handleKeyDown: (_v, ev) => {
        if (!ctx.prefs.sound || ev.ctrlKey || ev.metaKey || ev.altKey) return false
        if (ev.key === 'Enter') {
          enterNext = true
          snd.enter()
        }
        else if (ev.key === 'Backspace' || ev.key === 'Delete') snd.back()
        else if (ev.key === ' ') snd.space()
        else if (ev.key.length === 1) snd.key()
        return false
      },
    },
    onUpdate: () => {
      dirty = true
      savedEl.textContent = 'Menyimpan…'
      clearTimeout(timer)
      timer = window.setTimeout(flush, 700)
      counts()
      moveLamp()
      checkBell()
    },
    onSelectionUpdate: () => {
      moveLamp()
      if (!pointerDown) centerCaret()
    },
  })

  let lastPw = part.words
  function sprintLine() {
    const el = $('#c-sprint')
    const a = getActive()
    el.hidden = !a
    if (a) el.textContent = `Sprint ${sprintLabel()} · ${fmt(sprintWords(Math.max(0, lastPw - part.words)))} dari ${fmt(a.goal)} kata`
  }
  const onSprint = () => sprintLine()
  window.addEventListener('rtgs:s', onSprint)
  function counts(live = true) {
    const pw = live ? countWords(plain(editor.getMarkdown())) : part.words
    lastPw = pw
    sprintLine()
    const goal = Math.max(50, ctx.prefs.dailyGoal)
    const today = todayWords() + Math.max(0, pw - part.words)
    $('#c-part').textContent = `${fmt(pw)} kata di bagian ini`
    $('#c-work').textContent = `Hari ini ${fmt(today)} dari ${fmt(goal)} kata · ${fmt(todayMinutes())} menit`
    $('#meter').style.setProperty('--p', String(Math.min(1, today / goal)))
  }

  async function flush() {
    clearTimeout(timer)
    if (!dirty) return
    dirty = false
    const md = editor.getMarkdown()
    const before = part.words
    part.md = md
    part.words = countWords(plain(md))
    addWords(part.words - before)
    addCut(before - part.words)
    part.updatedAt = Date.now()
    work.lastPartId = part.id
    const ls = lastSentence(md)
    if (ls) work.lastSentence = ls
    work.touchedAt = Date.now()
    await ctx.save(work)
    savedEl.textContent = 'Tersimpan'
    void progress
  }

  /* penunjuk lampu: tepat di huruf yang akan diketik */
  function moveLamp() {
    if (!ctx.prefs.follow) {
      ed.style.setProperty('--lx', '50%')
      return
    }
    try {
      const x = editor.view.coordsAtPos(editor.state.selection.head).left
      const pct = Math.min(96, Math.max(4, (x / window.innerWidth) * 100))
      ed.style.setProperty('--lx', `${pct.toFixed(2)}%`)
    } catch {
      /* belum siap */
    }
  }

  /* "ting" tepat di batas kanan area ketik: saat kursor menyentuh tepi, atau saat kata terdorong ke baris baru */
  let armed = true
  let lastTop = -1
  let enterNext = false
  function checkBell() {
    if (!ctx.prefs.sound) return
    try {
      const rect = $('#prose').querySelector('.ProseMirror')!.getBoundingClientRect()
      const c = editor.view.coordsAtPos(editor.state.selection.head)
      const cw = ctx.prefs.size * (ctx.prefs.font === 'mesin' ? 0.6 : 0.5)
      const newLine = lastTop >= 0 && c.top > lastTop + 4
      lastTop = c.top
      if (newLine) {
        if (enterNext) enterNext = false
        else if (armed) snd.bell() // kata melewati batas dan turun ke baris baru
        armed = true
        return
      }
      if (c.left >= rect.right - cw * 1.2) {
        if (armed) {
          armed = false
          snd.bell()
        }
      } else if (c.left < rect.right - cw * 3) armed = true
    } catch {
      /* belum siap */
    }
  }

  function centerCaret() {
    if (!ctx.prefs.centerCaret) return
    try {
      const { head } = editor.state.selection
      const c = editor.view.coordsAtPos(head)
      const delta = c.top - window.innerHeight * (ctx.prefs.lampOn ? 0.7 : 0.45)
      if (Math.abs(delta) > 24) window.scrollBy({ top: delta, behavior: 'smooth' })
    } catch {
      /* posisi belum siap */
    }
  }

  /* ketik → bilah menyingkir; gerak tetikus → kembali */
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (!$('#style').hidden) toggleStyle(false)
      else if ($('#parts').dataset.open === 'true') toggleParts(false)
      return
    }
    if (e.ctrlKey || e.metaKey || e.key.length > 1 && !['Backspace', 'Enter', 'Delete'].includes(e.key)) return
    ed.dataset.typing = 'true'
  }
  const onMove = () => (ed.dataset.typing = 'false')
  root.addEventListener('keydown', onKey)
  window.addEventListener('mousemove', onMove)
  const prose = $('#prose')
  prose.addEventListener('pointerdown', () => (pointerDown = true))
  window.addEventListener('pointerup', () => (pointerDown = false))

  /* judul bagian */
  const pt = $<HTMLInputElement>('#pt')
  pt.addEventListener('input', () => {
    part.title = pt.value.trim() || 'Tanpa judul'
    dirty = true
    clearTimeout(timer)
    timer = window.setTimeout(flush, 700)
  })
  pt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      editor.commands.focus('start')
    }
  })

  /* bagian */
  const partsEl = $('#parts')
  function toggleParts(open: boolean) {
    partsEl.dataset.open = String(open)
    $('#b-parts').setAttribute('aria-expanded', String(open))
    if (open) {
      toggleStyle(false)
      drawParts()
    }
  }
  function drawParts() {
    partsEl.innerHTML = `<h2>Bagian</h2><ul>${work.parts
      .map(
        (p) => `<li${p.id === part.id ? ' aria-current="true"' : ''}><button class="go" data-go="${p.id}"><span>${escapeHtml(p.title)}</span><span>${fmt(p.words)} kata</span></button><button class="btn-text danger x" data-del="${p.id}">${work.parts.length > 1 ? 'Hapus' : 'Kosongkan'}</button></li>`,
      )
      .join('')}</ul><button class="btn" id="add-part">Tambah bagian</button>`
  }
  $('#b-parts').addEventListener('click', () => toggleParts(partsEl.dataset.open !== 'true'))
  partsEl.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement
    const go = t.closest<HTMLElement>('[data-go]')
    const del = t.closest<HTMLElement>('[data-del]')
    if (t.closest('#add-part')) {
      await flush()
      const p = newPart(`Bagian ${work.parts.length + 1}`)
      work.parts.push(p)
      work.lastPartId = p.id
      await ctx.save(work)
      ctx.go(`#/w/${work.id}?p=${p.id}`)
    } else if (go) {
      await flush()
      ctx.go(`#/w/${work.id}?p=${go.dataset.go}`)
    } else if (del) {
      if (del.dataset.sure !== '1') {
        del.dataset.sure = '1'
        del.textContent = work.parts.length > 1 ? 'Yakin? Hapus' : 'Yakin? Kosongkan'
        return
      }
      if (work.parts.length < 2) {
        editor.commands.clearContent(true)
        await flush()
        toggleParts(false)
        ctx.toast('Isi bagian dikosongkan')
        return
      }
      await flush()
      const id = del.dataset.del!
      const next = work.parts.find((p) => p.id !== id)!
      work.parts = work.parts.filter((p) => p.id !== id)
      if (work.lastPartId === id) work.lastPartId = next.id
      await ctx.save(work)
      ctx.go(`#/w/${work.id}?p=${id === part.id ? next.id : part.id}`)
    }
  })

  /* gaya tulis */
  const styleEl = $('#style')
  const P = ctx.prefs
  const seg = (name: string, opts: [string, string][], cur: string) =>
    `<div class="seg" role="group" aria-label="${name}">${opts.map(([v, l]) => `<button type="button" data-k="${name}" data-v="${v}" aria-pressed="${cur === v}">${l}</button>`).join('')}</div>`
  styleEl.innerHTML = `<h2>Gaya tulis</h2>
    <h3>Cahaya</h3>
    <label class="toggle">Lampu baca menyala<input type="checkbox" id="t-lamp"${P.lampOn ? ' checked' : ''}></label>
    <div class="ctl"><label for="r-warmth">Kehangatan cahaya <output id="o-warmth">${P.warmth < 35 ? 'Sejuk' : P.warmth > 65 ? 'Hangat' : 'Netral'}</output></label><input id="r-warmth" class="warm" type="range" min="0" max="100" step="1" value="${P.warmth}"><div class="ends"><span>Sejuk</span><span>Hangat</span></div></div>
    <div class="ctl"><label for="r-glow">Kecerahan lampu <output id="o-glow">${P.glow}%</output></label><input id="r-glow" type="range" min="0" max="100" step="1" value="${P.glow}"></div>
    <div class="ctl"><label for="r-dim">Gelap di sekeliling <output id="o-dim">${P.dim}%</output></label><input id="r-dim" type="range" min="0" max="100" step="1" value="${P.dim}"></div>
    <div class="ctl"><label for="r-beam">Lebar sorot <output id="o-beam">${P.beam}°</output></label><input id="r-beam" type="range" min="30" max="120" step="2" value="${P.beam}"></div>
    <label class="toggle">Sorot mengikuti kursor<input type="checkbox" id="t-follow"${P.follow ? ' checked' : ''}></label>
    <h3>Suara</h3>
    <label class="toggle">Suara mesin tik<input type="checkbox" id="t-sound"${P.sound ? ' checked' : ''}></label>
    <h3>Huruf dan tata letak</h3>
    <div class="ctl"><label for="s-skin">Tema</label><select id="s-skin">${SKINS.map((k) => `<option value="${k.id}"${P.skin === k.id ? ' selected' : ''}>${k.label}</option>`).join('')}</select></div>
    <div class="ctl"><span class="lbl">Terang atau gelap</span>${seg('theme', [['siang', 'Terang'], ['malam', 'Gelap']], P.theme)}</div>
    <div class="ctl"><span class="lbl">Huruf</span>${seg('font', [['literata', 'Buku'], ['atkinson', 'Jelas'], ['mesin', 'Mesin tik']], P.font)}</div>
    <div class="ctl"><label for="r-size">Ukuran <output id="o-size">${P.size}px</output></label><input id="r-size" type="range" min="16" max="26" step="1" value="${P.size}"></div>
    <div class="ctl"><label for="s-paper">Ukuran halaman</label><select id="s-paper">${PAPERS.map((x) => `<option value="${x.id}"${(P.paper ?? 'bebas') === x.id ? ' selected' : ''}>${x.label}</option>`).join('')}</select></div>
    <div class="ctl"><label for="r-measure">Lebar kolom <output id="o-measure">${P.measure}</output></label><input id="r-measure" type="range" min="50" max="80" step="2" value="${P.measure}"${(P.paper ?? 'bebas') !== 'bebas' ? ' disabled' : ''}></div>
    <div class="ctl"><label for="r-leading">Jarak baris <output id="o-leading">${P.leading.toFixed(2)}</output></label><input id="r-leading" type="range" min="1.5" max="2" step="0.05" value="${P.leading}"></div>
    <div class="ctl"><span class="lbl">Perataan teks</span>${seg('align', [['kiri', 'Kiri'], ['tengah', 'Tengah'], ['kanan', 'Kanan'], ['rata', 'Rata']], P.align ?? 'kiri')}</div>
    <div class="ctl"><span class="lbl">Paragraf</span>${seg('indent', [['ya', 'Menjorok'], ['tidak', 'Berjarak']], P.indent ? 'ya' : 'tidak')}</div>
    <label class="toggle">Redupkan paragraf lain<input type="checkbox" id="t-focus"${P.focusPara ? ' checked' : ''}></label>
    <label class="toggle">Tahan baris aktif di posisi tetap<input type="checkbox" id="t-center"${P.centerCaret ? ' checked' : ''}></label>`
  function toggleStyle(open: boolean) {
    styleEl.hidden = !open
    $('#b-style').setAttribute('aria-expanded', String(open))
    if (open) toggleParts(false)
  }
  $('#b-style').addEventListener('click', () => toggleStyle(styleEl.hasAttribute('hidden')))
  styleEl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-k]')
    if (!b) return
    const k = b.dataset.k!
    const v = b.dataset.v!
    if (k === 'indent') ctx.setPrefs({ indent: v === 'ya' })
    else if (k === 'align') ctx.setPrefs({ align: v as never })
    else ctx.setPrefs({ [k]: v } as never)
    b.parentElement!.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)))
  })
  const range = (id: string, out: string, key: 'size' | 'measure' | 'leading' | 'warmth' | 'glow' | 'dim' | 'beam', fmtv: (n: number) => string) => {
    const el = $<HTMLInputElement>(id)
    el.addEventListener('input', () => {
      const n = Number(el.value)
      ctx.setPrefs({ [key]: n })
      $(out).textContent = fmtv(n)
    })
  }
  $<HTMLSelectElement>('#s-skin').addEventListener('change', (e) => ctx.setPrefs({ skin: (e.target as HTMLSelectElement).value as never }))
  $<HTMLSelectElement>('#s-paper').addEventListener('change', (e) => {
    const v = (e.target as HTMLSelectElement).value as PaperId
    ctx.setPrefs({ paper: v })
    $<HTMLInputElement>('#r-measure').disabled = v !== 'bebas'
  })
  $('#b-export').addEventListener('click', async () => {
    await flush()
    openExport(ctx, work)
  })
  range('#r-size', '#o-size', 'size', (n) => `${n}px`)
  range('#r-measure', '#o-measure', 'measure', (n) => String(n))
  range('#r-leading', '#o-leading', 'leading', (n) => n.toFixed(2))
  range('#r-warmth', '#o-warmth', 'warmth', (n) => (n < 35 ? 'Sejuk' : n > 65 ? 'Hangat' : 'Netral'))
  range('#r-glow', '#o-glow', 'glow', (n) => `${n}%`)
  range('#r-dim', '#o-dim', 'dim', (n) => `${n}%`)
  range('#r-beam', '#o-beam', 'beam', (n) => `${n}°`)
  $<HTMLInputElement>('#t-sound').addEventListener('change', (e) => {
    const on = (e.target as HTMLInputElement).checked
    ctx.setPrefs({ sound: on })
    if (on) snd.bell()
  })
  $<HTMLInputElement>('#t-lamp').addEventListener('change', (e) => {
    ctx.setPrefs({ lampOn: (e.target as HTMLInputElement).checked })
    centerCaret()
  })
  $<HTMLInputElement>('#t-follow').addEventListener('change', (e) => {
    ctx.setPrefs({ follow: (e.target as HTMLInputElement).checked })
    moveLamp()
  })
  $<HTMLInputElement>('#t-focus').addEventListener('change', (e) => ctx.setPrefs({ focusPara: (e.target as HTMLInputElement).checked }))
  $<HTMLInputElement>('#t-center').addEventListener('change', (e) => ctx.setPrefs({ centerCaret: (e.target as HTMLInputElement).checked }))

  /* simpan saat pergi */
  const onHide = () => {
    if (document.visibilityState === 'hidden') void flush()
  }
  const onUnload = () => void flush()
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('beforeunload', onUnload)

  counts(false)
  requestAnimationFrame(() => {
    editor.commands.focus('end')
    moveLamp()
    centerCaret()
  })

  const onTick = () => counts(true)
  window.addEventListener('rtgs:tick', onTick)
  $('#b-sound').addEventListener('click', () => openSound())

  return {
    async destroy() {
      window.removeEventListener('rtgs:tick', onTick)
      window.removeEventListener('rtgs:s', onSprint)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onUnload)
      window.removeEventListener('mousemove', onMove)
      root.removeEventListener('keydown', onKey)
      await flush()
      editor.destroy()
    },
  }
}
