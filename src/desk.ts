import type { Ctx } from './ctx'
import { KINDS, STAGES, ago, authorOf, escapeHtml, fmt, isJournal, kindColor, kindLabel, newPart, newWork, progress, stageLabel, todayTitle, workWords, type StageId, type Work } from './model'
import { buildSeed } from './seed'
import { drawMap, type Rect } from './map'
import { getCut, getLog, getTime, series, seedLog, setExtra, setLog, streak, dayKey, todayMinutes, todayWords, type Range } from './log'
import { openSound, soundIcon } from './soundui'
import { openSprint, sprintLabel, getActive } from './sprint'
import { backupDue, exportBackup, importBackup, openBackup } from './backup'
import { fitTitles } from './fit'
import { SKINS } from './prefs'
import { addIdea, getIdeas, ideaTitle, removeIdea, seedIdeas, setIdeas, updateIdea, type Idea } from './ideas'

type Filter = StageId | 'semua' | 'tidur' | 'jurnal'
let filter: Filter = 'semua'
let introPlayed = false
let range: Range = '7'
let calMonth = { y: new Date().getFullYear(), m: new Date().getMonth() }
let onResize: (() => void) | null = null
let onTickDesk: (() => void) | null = null
let onSprintDesk: (() => void) | null = null

type SortKey = 'baru' | 'lama' | 'az' | 'za'
const SORTS: { id: SortKey; label: string }[] = [
  { id: 'baru', label: 'Terakhir diperbarui' },
  { id: 'lama', label: 'Paling lama tak disentuh' },
  { id: 'az', label: 'Judul A–Z' },
  { id: 'za', label: 'Judul Z–A' },
]

const SHORT: Record<string, string> = { draf: 'Draf' }
const chip = (s: { id: string; label: string }) => SHORT[s.id] ?? s.label

function layout(): { W: number; H: number; region: Rect; wide: boolean } {
  const W = window.innerWidth, H = window.innerHeight
  const wide = W >= 1000 && H >= 640
  const region: Rect = wide
    ? { x: 24, y: 84, w: W - 438, h: H - 108 }
    : { x: 14, y: 124, w: W - 28, h: Math.max(190, Math.round(H * 0.32)) }
  return { W, H, region, wide }
}

export function renderDesk(root: HTMLElement, ctx: Ctx) {
  document.title = 'Ruang Tulis GS'
  if (onResize) window.removeEventListener('resize', onResize)

  const awake = ctx.works.filter((w) => !w.asleep).sort((a, b) => b.touchedAt - a.touchedAt)
  const asleep = ctx.works.filter((w) => w.asleep).sort((a, b) => b.touchedAt - a.touchedAt)
  const karya = ctx.works.filter((w) => !isJournal(w))
  const jurnal = ctx.works.filter(isJournal)
  const resume = awake.find((w) => !isJournal(w) && w.stage !== 'final' && w.stage !== 'terbit') ?? awake.find((w) => !isJournal(w)) ?? awake[0]
  const listed = filter === 'tidur' ? asleep : filter === 'semua' ? awake : filter === 'jurnal' ? awake.filter(isJournal) : awake.filter((w) => w.stage === filter && !isJournal(w))

  /* statistik */
  const goal = Math.max(50, ctx.prefs.dailyGoal)
  const goalMin = Math.max(5, ctx.prefs.dailyMinutes)
  const today = todayWords()
  const todayMin = todayMinutes()
  const terbit = karya.filter((w) => w.stage === 'terbit').length
  const proses = karya.length - terbit
  const ide = karya.filter((w) => w.stage === 'gagasan').length
  const jEntries = jurnal.reduce((n, w) => n + w.parts.length, 0)
  const jWords = jurnal.reduce((n, w) => n + workWords(w), 0)

  const byStage = STAGES.map((s) => ({ ...s, words: awake.filter((w) => w.stage === s.id && !isJournal(w)).reduce((n, w) => n + workWords(w), 0) }))
  const stageTotal = byStage.reduce((n, s) => n + s.words, 0)
  const R = 42, C = 2 * Math.PI * R
  let off = 0
  const arcs = byStage
    .filter((s) => s.words > 0)
    .map((s) => {
      const len = (s.words / stageTotal) * C
      const a = `<circle class="arc arc-${s.id}" cx="55" cy="55" r="${R}" stroke-dasharray="${Math.max(0, len - 2).toFixed(1)} ${C.toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}"/>`
      off += len
      return a
    })
    .join('')
  const legend = [...byStage].filter((s) => s.words > 0).sort((a, b) => b.words - a.words).slice(0, 3)
    .map((s) => `<li><i class="sw sw-${s.id}"></i><span>${s.label}</span><b>${Math.round((s.words / stageTotal) * 100)}%</b></li>`).join('')

  const slots = series(range)
  const per = range === '84' ? 7 : 1
  const maxW = Math.max(goal * per, ...slots.map((d) => d.words))
  const sum = (f: (x: (typeof slots)[number]) => number) => slots.reduce((n, d) => n + f(d), 0)
  const tWords = sum((d) => d.words), tCut = sum((d) => d.cut), tMin = Math.round(sum((d) => d.secs) / 60)
  const bars = slots.map((d, i) => {
    const h = d.words ? Math.max(4, (d.words / maxW) * 100) : 2
    const lab = range === '28' ? (i % 7 === 0 || d.now ? d.label : '') : d.label
    return `<div class="bar${d.now ? ' now' : ''}${d.words >= goal * per ? ' hit' : ''}" title="${d.title}: ${fmt(d.words)} kata · ${Math.round(d.secs / 60)} menit"><div class="col"><i class="gl" style="bottom:${((goal * per) / maxW) * 100}%"></i><span style="height:${h}%"></span></div><em>${lab}</em></div>`
  }).join('')
  const meter = (v: number, g: number) => `<span class="mt"><i style="width:${Math.min(100, (v / g) * 100)}%"></i></span>`
  const RANGES: [Range, string][] = [['7', '7 hari'], ['28', '28 hari'], ['84', '12 minggu']]
  const overview = `<section class="card wov" aria-label="Ikhtisar menulis">
        <div class="card-h"><span class="lbl">Ikhtisar menulis</span><div class="tabs" role="group" aria-label="Rentang">${RANGES.map(([r, l]) => `<button type="button" data-range="${r}" aria-pressed="${range === r}">${l}</button>`).join('')}</div></div>
        <div class="goals">
          <div class="g"><div class="g-t"><span>Menulis hari ini</span><b>${fmt(today)}<small> / <input id="dg" type="number" min="50" step="50" value="${goal}" aria-label="Target kata per hari"> kata</small></b></div>${meter(today, goal)}</div>
          <div class="g"><div class="g-t"><span>Di meja hari ini</span><b><span id="tm-v">${fmt(todayMin)}</span><small> / <input id="dm" type="number" min="5" step="5" value="${goalMin}" aria-label="Target menit per hari"> menit</small></b></div><span class="mt"><i id="tm-b" style="width:${Math.min(100, (todayMin / goalMin) * 100)}%"></i></span></div>
        </div>
        <div class="tot"><div><b>${fmt(tWords)}</b><span>Kata ditulis</span></div><div><b>${fmt(tCut)}</b><span>Kata dipangkas</span></div><div><b>${fmt(tMin)}</b><span>Menit di meja</span></div></div>
        <div class="bars b${range}" role="img" aria-label="Kata per ${range === '84' ? 'minggu' : 'hari'}. Hari ini ${fmt(today)} kata, target ${fmt(goal)}.">${bars}</div>
        <p class="note-s">Kata per ${range === '84' ? 'minggu' : 'hari'}. Garis putus-putus: target${range === '84' ? ' mingguan' : ' harian'}.</p>
      </section>`

  /* kalender menulis */
  const calHtml = (cls: string) => {
    const lg = getLog()
    const { y, m } = calMonth
    const first = (new Date(y, m, 1).getDay() + 6) % 7
    const nDays = new Date(y, m + 1, 0).getDate()
    const tk = dayKey()
    const heads = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((d) => `<span class="ch">${d}</span>`).join('')
    let cells = '<i></i>'.repeat(first)
    let wrote = 0
    for (let d = 1; d <= nDays; d++) {
      const key = dayKey(new Date(y, m, d, 12))
      const w = lg[key] ?? 0
      if (w > 0) wrote++
      const label = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long' }).format(new Date(y, m, d))
      cells += `<span class="cd${key === tk ? ' today' : ''}${w > 0 ? ' wrote' : ''}${w >= goal ? ' hit' : ''}${key > tk ? ' fut' : ''}" title="${label}: ${w ? fmt(w) + ' kata' : 'belum menulis'}" aria-label="${label}, ${w ? fmt(w) + ' kata' : 'belum menulis'}"><b>${d}</b>${w > 0 ? '<u class="mk"></u>' : ''}</span>`
    }
    const title = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(y, m, 1))
    const sk = streak()
    return `<section class="card cal ${cls}" aria-label="Kalender menulis">
        <div class="card-h"><span class="lbl">Kalender menulis</span></div>
        <div class="cal-nav"><button type="button" data-act="cal-prev" aria-label="Bulan sebelumnya">‹</button><button type="button" class="cal-t" data-act="cal-now" title="Kembali ke bulan ini">${title}</button><button type="button" data-act="cal-next" aria-label="Bulan berikutnya">›</button></div>
        <div class="cal-g" role="group" aria-label="${title}">${heads}${cells}</div>
        <div class="cal-f"><span><u class="mk"></u> menulis</span><span><u class="mk hit"></u> target tercapai</span></div>
        <p class="cal-s"><span><b>${wrote}</b> hari menulis bulan ini</span>${sk ? `<span>Runtun <b>${sk}</b> hari berturut-turut</span>` : ''}</p>
      </section>`
  }

  const row = (w: Work) => {
    const words = workWords(w)
    return `<li class="krow${w.asleep ? ' sleep' : ''}" data-id="${w.id}">
      <div class="k-top"><a class="k-title" href="#/b/${w.id}">${escapeHtml(w.title)}</a><span class="k-stage" data-stage="${w.stage}">${isJournal(w) ? 'Jurnal' : stageLabel(w.stage)}</span></div>
      <div class="k-meta"><span>${fmt(words)} kata</span><span>${ago(w.touchedAt)}</span>
        <span class="acts"><button class="btn-text" data-act="detail">Detail</button><button class="btn-text" data-act="sleep">${w.asleep ? 'Bangunkan' : 'Tidurkan'}</button><button class="btn-text danger" data-act="del">Hapus</button></span></div>
    </li>`
  }

  const resumeHtml = resume
    ? (() => {
        const p = resume.parts.find((x) => x.id === resume.lastPartId) ?? resume.parts[0]
        return `<section class="card resume" aria-labelledby="rt">
          <div class="card-h"><span class="lbl">Lanjutkan</span><span class="muted">${kindLabel(resume.kind)} · <span data-stage="${resume.stage}" class="k-stage">${stageLabel(resume.stage)}</span> · ${ago(resume.touchedAt)}</span></div>
          <h2 class="r-title" id="rt">${escapeHtml(resume.title)}</h2>
          ${resume.lastSentence ? `<blockquote class="last"><p>${escapeHtml(resume.lastSentence)}</p><footer>Kalimat terakhirmu di ${escapeHtml(p.title)}</footer></blockquote>` : `<p class="muted">Belum ada kalimat. Mulai dari satu.</p>`}
          <div class="next"><label for="nx">Langkah berikutnya</label><input id="nx" maxlength="140" placeholder="Satu hal kecil yang akan kamu kerjakan" value="${escapeHtml(resume.nextStep)}"></div>
          <a class="btn btn-primary wide" href="#/w/${resume.id}?p=${p.id}">Lanjutkan menulis</a>
        </section>`
      })()
    : ''

  const filters = [{ id: 'semua', label: 'Semua' }, ...STAGES, { id: 'jurnal', label: `Jurnal${jurnal.length ? ` ${jurnal.length}` : ''}` }, { id: 'tidur', label: `Tidur${asleep.length ? ` ${asleep.length}` : ''}` }]
    .map((s) => `<button type="button" data-f="${s.id}" aria-pressed="${filter === s.id}">${chip(s)}</button>`).join('')


  const byTouch = (a: Work, b: Work) => b.touchedAt - a.touchedAt
  const dims = (w: Work) => {
    const h = [...w.id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7)
    if (w.cover?.front) {
      const bh = 188
      const bw = Math.max(100, Math.min(140, Math.round(bh * (w.cover.ratio ?? 0.68))))
      return `--bk:${kindColor(w.kind)};--bw:${bw}px;--bh:${bh}px`
    }
    const tl = w.title.length
    return `--bk:${kindColor(w.kind)};--bw:${112 + (h % 10)}px;--bh:${176 + ((h >> 4) % 16)}px;--tf:${tl > 46 ? 12 : tl > 30 ? 13.5 : 15.5}px`
  }
  const coverInner = (w: Work, status: string, pg: number | null, now: boolean) => w.cover?.front
    ? `${now ? '<u class="bk-now">Sekarang</u>' : ''}<img class="bk-img" src="${escapeHtml(w.cover.front)}" alt="" draggable="false">${pg === null ? '' : `<span class="bk-pg" style="width:${pg}%"></span>`}`
    : `${now ? '<u class="bk-now">Sekarang</u>' : ''}
        <span class="bk-mid"><b>${escapeHtml(w.title)}</b></span>
        <span class="bk-au">${escapeHtml(authorOf(w))}</span><span class="bk-st">${status}</span>${pg === null ? '' : `<span class="bk-pg" style="width:${pg}%"></span>`}`
  const cfg = (w: Work) => `<button type="button" class="bk-cfg" data-act="detail" data-id="${w.id}" aria-label="Atur buku ${escapeHtml(w.title)}" title="Ubah judul dan status">Atur</button>`
  const bookHtml = (w: Work) => {
    const st = w.stage === 'terbit' ? `Terbit · ${fmt(workWords(w))} kata` : `${w.asleep ? 'Tidur' : stageLabel(w.stage)} · ${fmt(workWords(w))} kata`
    const now = !!(resume && w.id === resume.id)
    return `<div class="bkw${w.asleep ? ' sleep' : ''}" data-id="${w.id}" style="${dims(w)}">
      <a class="bk${w.cover?.front ? ' has-img' : ''}" href="#/b/${w.id}" aria-label="${escapeHtml(w.title)}, ${kindLabel(w.kind)}, ${st}">${coverInner(w, st, null, now)}</a>${cfg(w)}</div>`
  }
  const journalHtml = (w: Work) => {
    const todayPart = w.parts.find((p) => p.title === todayTitle())
    const sub = todayPart && todayPart.words ? `Hari ini ${fmt(todayPart.words)} kata` : 'Hari ini belum ditulis'
    const jh = 198
    const jw = w.cover?.front ? Math.max(110, Math.min(168, Math.round(jh * (w.cover.ratio ?? 0.68)))) : 160
    return `<div class="bkw jbk" data-id="${w.id}" style="--bk:${kindColor(w.kind)};--bw:${jw}px;--bh:${jh}px;--tf:19px">
      <button type="button" class="bk${w.cover?.front ? ' has-img' : ''}" data-act="jurnal" data-id="${w.id}" aria-label="Tulis jurnal hari ini di ${escapeHtml(w.title)}">${coverInner(w, sub, null, false)}</button>${cfg(w)}</div>`
  }
  const ideas = getIdeas()
  const dummy = Array.from({ length: 19 }, (_, n) => `<span class="wn wn-f tone${(n * 7 + 2) % 4}" aria-hidden="true" style="--r:${(((n * 13) % 11) - 5) * 0.9}deg;--l:${40 + ((n * 7) % 5) * 10}%"></span>`).join('')
  const sortKey = (k: 'terbit' | 'proses'): SortKey => {
    try { const v = localStorage.getItem(`rtgs.sort.${k}`); return SORTS.some((x) => x.id === v) ? (v as SortKey) : 'baru' } catch { return 'baru' }
  }
  const sorter = (k: SortKey) => (a: Work, b: Work) =>
    k === 'baru' ? b.touchedAt - a.touchedAt : k === 'lama' ? a.touchedAt - b.touchedAt : k === 'az' ? a.title.localeCompare(b.title, 'id') : b.title.localeCompare(a.title, 'id')
  const sortSel = (k: 'terbit' | 'proses') => `<select class="sort" data-sort="${k}" aria-label="Urutkan rak">${SORTS.map((x) => `<option value="${x.id}"${sortKey(k) === x.id ? ' selected' : ''}>${x.label}</option>`).join('')}</select>`
  const pubList = karya.filter((w) => w.stage === 'terbit').sort(sorter(sortKey('terbit')))
  const wipList = karya.filter((w) => w.stage !== 'terbit').sort(sorter(sortKey('proses')))
  const jBook = [...jurnal].filter((w) => !w.asleep).sort(byTouch)[0] ?? [...jurnal].sort(byTouch)[0]
  const shelves = `<div class="shelves">
    <section class="shelf" aria-label="Karya yang sudah terbit">
      <div class="shelf-h"><span class="lbl">Sudah terbit</span><span class="count">${pubList.length}</span>${sortSel('terbit')}</div>
      <div class="rows">${pubList.length ? pubList.map(bookHtml).join('') : '<p class="bk-empty">Belum ada karya terbit. Atur sebuah buku, pilih tahap Terbit, dan ia pindah ke rak ini.</p>'}</div>
    </section>
    <div class="shelf-col">
      <section class="shelf bay bay-j" aria-label="Jurnal harian">
        <div class="shelf-h"><span class="lbl">Jurnal harian</span><span class="count">${jurnal.length}</span></div>
        <div class="rows">${jBook ? journalHtml(jBook) : '<button type="button" class="bk-new" data-act="jurnal">+ Mulai jurnal harian</button>'}</div>
      </section>
      <section class="shelf bay bay-i" aria-label="Catatan ide">
        <div class="shelf-h"><span class="lbl">Catatan ide</span><span class="count">${ideas.length}</span></div>
        <div class="wall"><div class="wall-g"><button type="button" class="wn wn-new" data-act="idea-new" aria-label="Tambah ide baru" title="Tambah ide baru"><span>+</span></button>${dummy}</div>
          <button type="button" class="wall-list" data-act="idea-list" aria-label="Lihat daftar ${ideas.length} catatan ide">Lihat daftar ide</button></div>
        <div class="plank"></div>
      </section>
    </div>
    <section class="shelf" aria-label="Karya yang sedang diproses">
      <div class="shelf-h"><span class="lbl">Sedang diproses</span><span class="count">${wipList.length}</span><button type="button" class="shelf-add" data-act="new">+ Karya baru</button>${sortSel('proses')}</div>
      <div class="rows">${wipList.length ? wipList.map(bookHtml).join('') : '<p class="bk-empty">Belum ada karya yang sedang diproses.</p>'}</div>
    </section>
  </div>`

  const emptyCard = !ctx.works.length
    ? `<section class="card empty-card"><h2>Mejamu masih kosong.</h2><p>Setiap karya menjadi satu buku di rak ini: yang sedang kamu kerjakan di rak proses, yang sudah terbit di rak terbit. Catatan harianmu juga tinggal di sini.</p><div class="row"><button class="btn btn-primary" data-act="new">Karya baru</button><button class="btn" data-act="seed">Isi dengan contoh</button></div></section>`
    : ''

  root.innerHTML = `<div class="stage">
    <svg class="map-bg" aria-hidden="true"></svg>
    <header class="topbar">
      <span class="wordmark">Ruang Tulis GS</span>
      <button class="search" data-act="find" aria-label="Cari di semua karya"><span>Cari di semua karya</span><kbd>Ctrl K</kbd></button>
      <div class="bar-actions">
        <a class="btn" href="#/ikhtisar">Ikhtisar</a>
        <button class="btn sprint-btn" data-act="sprint" aria-haspopup="dialog"><span id="sp-l">${getActive() ? sprintLabel() : 'Sprint'}</span></button>
        <button class="btn bk-btn${backupDue(ctx) ? ' due' : ''}" data-act="backup-menu" aria-haspopup="dialog" title="${backupDue(ctx) ? 'Sudah lama belum dicadangkan' : 'Cadangan'}">Cadangan</button>
        <button class="btn snd-btn" data-act="sound" aria-haspopup="dialog"><i class="snd-ind">${soundIcon}</i>Suara</button>
        <button class="btn" data-act="skin" aria-haspopup="dialog">Tema</button>
        <button class="btn btn-primary" data-act="new">Karya baru</button>
      </div>
    </header>
    ${shelves}
    ${emptyCard}
    <div class="rail">
      ${calHtml('')}
      <section class="card" aria-label="Ikhtisar">
        <div class="card-h"><span class="lbl">Ikhtisar</span><button class="btn-text" data-act="jurnal">Tulis jurnal hari ini</button></div>
        <div class="tiles">
          <div class="tile"><span>Karya terbit</span><b>${terbit}</b><i class="tag">dari ${karya.length} karya</i></div>
          <div class="tile"><span>Sedang dikerjakan</span><b>${proses}</b><i class="tag">${ide} gagasan · ${proses - ide} draf</i></div>
          <div class="tile"><span>Catatan jurnal</span><b>${jEntries}</b><i class="tag">${fmt(jWords)} kata</i></div>
          <div class="tile"><span>Runtun menulis</span><b>${streak()}</b><i class="tag${today >= goal ? ' ok' : ''}">${today >= goal ? 'Target hari ini tercapai' : today > 0 ? `Sisa ${fmt(goal - today)} kata hari ini` : 'hari berturut-turut'}</i></div>
        </div>
      </section>

      ${overview}

      <section class="card comp" aria-label="Komposisi menurut tahap">
        <div class="card-h"><span class="lbl">Komposisi</span><span class="muted">menurut tahap</span></div>
        <div class="comp-body">
          <svg viewBox="0 0 110 110" width="104" height="104" role="img" aria-label="Total ${fmt(stageTotal)} kata"><circle class="arc-bg" cx="55" cy="55" r="${R}"/>${arcs}<text x="55" y="53" text-anchor="middle" class="c-n">${fmt(stageTotal)}</text><text x="55" y="68" text-anchor="middle" class="c-l">kata</text></svg>
          <ul class="legend">${legend || '<li class="muted">Belum ada kata</li>'}</ul>
        </div>
      </section>
      ${resumeHtml}
      ${ctx.works.length ? `<section class="card list-card" aria-label="Daftar karya">
        <div class="card-h"><span class="lbl">Karya</span><div class="filters" role="group" aria-label="Saring menurut tahap">${filters}</div></div>
        ${listed.length ? `<ol class="klist">${listed.map(row).join('')}</ol>` : `<p class="muted pad">Tidak ada karya di sini.</p>`}
        <p class="note">Tersimpan di peramban ini, tanpa server. Unduh cadangan secara berkala.</p>
        <div class="row small"><button class="btn-text" data-act="backup">Unduh cadangan</button><button class="btn-text" data-act="restore">Pulihkan</button><button class="btn-text" data-act="seed">Tambah contoh</button></div>
        <input type="file" accept="application/json,.json" hidden id="rf">
      </section>` : ''}
    </div>
  </div>`

  fitTitles(root, '.bk-mid b')

  /* latar meja */
  const svg = root.querySelector<SVGSVGElement>('.map-bg')!
  const paint = () => {
    const { W, H, region } = layout()
    const m = drawMap(W, H, region, [], false)
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
    svg.setAttribute('width', String(W))
    svg.setAttribute('height', String(H))
    svg.innerHTML = m.svg
  }
  paint()
  introPlayed = true
  let t = 0
  onResize = () => {
    clearTimeout(t)
    t = window.setTimeout(paint, 150)
  }
  window.addEventListener('resize', onResize)

  const stage = root.querySelector<HTMLElement>('.stage')!
  /* sorot petak <-> daftar */
  const hl = (id: string | null) => {
    root.querySelectorAll('.hl').forEach((e) => e.classList.remove('hl'))
    if (!id) return
    root.querySelectorAll(`.bkw[data-id="${id}"], .krow[data-id="${id}"]`).forEach((e) => e.classList.add('hl'))
  }
  stage.addEventListener('mouseover', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-id]')
    hl(el?.dataset.id ?? null)
  })
  stage.addEventListener('focusin', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-id]')
    hl(el?.dataset.id ?? null)
  })
  stage.addEventListener('mouseleave', () => hl(null))

  const rerender = () => renderDesk(root, ctx)
  const q = <T extends Element>(s: string) => root.querySelector<T>(s)

  q<HTMLInputElement>('#nx')?.addEventListener('change', async (e) => {
    if (!resume) return
    resume.nextStep = (e.target as HTMLInputElement).value.trim()
    await ctx.save(resume)
    ctx.toast('Tersimpan')
  })
  q<HTMLInputElement>('#dg')?.addEventListener('change', (e) => {
    const n = Math.round(Number((e.target as HTMLInputElement).value))
    ctx.setPrefs({ dailyGoal: n >= 50 ? n : 300 })
    rerender()
  })
  q<HTMLInputElement>('#dm')?.addEventListener('change', (e) => {
    const n = Math.round(Number((e.target as HTMLInputElement).value))
    ctx.setPrefs({ dailyMinutes: n >= 5 ? n : 30 })
    rerender()
  })
  root.querySelectorAll<HTMLButtonElement>('[data-range]').forEach((b) =>
    b.addEventListener('click', () => {
      range = b.dataset.range as Range
      rerender()
    }),
  )
  if (onTickDesk) window.removeEventListener('rtgs:tick', onTickDesk)
  onTickDesk = () => {
    const v = root.querySelector('#tm-v'), bar = root.querySelector<HTMLElement>('#tm-b')
    if (!v || !bar) return
    const mnt = todayMinutes()
    v.textContent = fmt(mnt)
    bar.style.width = `${Math.min(100, (mnt / goalMin) * 100)}%`
  }
  window.addEventListener('rtgs:tick', onTickDesk)
  if (onSprintDesk) window.removeEventListener('rtgs:s', onSprintDesk)
  onSprintDesk = () => {
    const el = root.querySelector('#sp-l')
    if (el) el.textContent = getActive() ? sprintLabel() : 'Sprint'
  }
  window.addEventListener('rtgs:s', onSprintDesk)
  root.querySelectorAll<HTMLButtonElement>('.filters button').forEach((b) =>
    b.addEventListener('click', () => {
      filter = b.dataset.f as Filter
      rerender()
    }),
  )

  stage.addEventListener('change', (e) => {
    const sel = (e.target as HTMLElement).closest<HTMLSelectElement>('select.sort')
    if (!sel) return
    try { localStorage.setItem(`rtgs.sort.${sel.dataset.sort}`, sel.value) } catch { /* abaikan */ }
    rerender()
  })

  stage.addEventListener('click', async (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')
    if (!t) return
    const act = t.dataset.act
    const li = t.closest<HTMLElement>('.krow')
    const w = ctx.works.find((x) => x.id === (li?.dataset.id ?? t.dataset.id))
    if (act === 'find') ctx.openFind()
    else if (act === 'skin') openSkinPop(ctx, t)
    else if (act === 'sound') openSound()
    else if (act === 'sprint') openSprint()
    else if (act === 'backup-menu') openBackup(ctx, rerender)
    else if (act === 'cal-prev' || act === 'cal-next') {
      const d = new Date(calMonth.y, calMonth.m + (act === 'cal-next' ? 1 : -1), 1)
      calMonth = { y: d.getFullYear(), m: d.getMonth() }
      rerender()
    } else if (act === 'cal-now') {
      calMonth = { y: new Date().getFullYear(), m: new Date().getMonth() }
      rerender()
    }
    else if (act === 'new') openForm(ctx)
    else if (act === 'detail' && w) {
      if (li) ctx.go(`#/b/${w.id}`)
      else openForm(ctx, w, rerender)
    }
    else if (act === 'jurnal') await openJournal(ctx, w)
    else if (act === 'idea-new') openIdea(ctx, undefined, rerender)
    else if (act === 'idea-list') openIdeaList(ctx, rerender)
    else if (act === 'seed') {
      for (const s of buildSeed()) await ctx.save(s)
      seedLog()
      seedIdeas()
      rerender()
    } else if (act === 'backup') {
      exportBackup(ctx)
      ctx.toast('Cadangan diunduh')
    } else if (act === 'restore') q<HTMLInputElement>('#rf')!.click()
    else if (act === 'sleep' && w) {
      w.asleep = !w.asleep
      await ctx.save(w)
      ctx.toast(w.asleep ? 'Ditidurkan' : 'Dibangunkan')
      rerender()
    } else if (act === 'del' && w && li) {
      const meta = li.querySelector('.k-meta')!
      meta.innerHTML = `<span class="confirm">Hapus “${escapeHtml(w.title)}” beserta ${fmt(workWords(w))} katanya? Tidak bisa dibatalkan.<button class="btn-text danger" data-act="del-yes">Hapus</button><button class="btn-text" data-act="del-no">Batal</button></span>`
      meta.querySelector<HTMLElement>('[data-act="del-no"]')!.focus()
    } else if (act === 'del-no') rerender()
    else if (act === 'del-yes' && w) {
      await ctx.remove(w.id)
      ctx.toast('Karya dihapus')
      rerender()
    }
  })

  q<HTMLInputElement>('#rf')?.addEventListener('change', async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0]
    if (f && (await importBackup(ctx, f))) rerender()
  })
  void dayKey
}

async function openJournal(ctx: Ctx, pick?: Work) {
  let j = pick && isJournal(pick) ? pick : ctx.works.find((w) => isJournal(w) && !w.asleep)
  if (!j) {
    j = newWork({ title: 'Jurnal harian', kind: 'jurnal', stage: 'draf', targetWords: 1000 })
    await ctx.save(j)
    ctx.go(`#/w/${j.id}?p=${j.parts[0].id}`)
    return
  }
  const t = todayTitle()
  let p = j.parts.find((x) => x.title === t)
  if (!p) {
    p = newPart(t)
    j.parts.push(p)
  }
  j.lastPartId = p.id
  await ctx.save(j)
  ctx.go(`#/w/${j.id}?p=${p.id}`)
}

export function openForm(ctx: Ctx, edit?: Work, after?: () => void, prefill?: { title: string; onCreated: () => void }) {
  const dlg = document.createElement('dialog')
  dlg.innerHTML = `<form method="dialog">
    <h2>${edit ? 'Detail buku' : 'Karya baru'}</h2>
    <div class="field"><label for="nt">Judul</label><input id="nt" required maxlength="120" autocomplete="off" value="${escapeHtml(edit?.title ?? prefill?.title ?? '')}"></div>
    <div class="field" id="f-sub"><label for="nb">Subjudul</label><input id="nb" maxlength="140" autocomplete="off" value="${escapeHtml(edit?.subtitle ?? '')}"></div>
    <div class="field"><label for="na">Penulis</label><input id="na" maxlength="80" autocomplete="off" placeholder="Gus Sohe" value="${escapeHtml(edit?.author ?? '')}"></div>
    <div class="field-row">
      <div class="field"><label for="nk">Jenis</label><select id="nk">${KINDS.map((k) => `<option value="${k.id}"${edit?.kind === k.id ? ' selected' : ''}>${k.label}</option>`).join('')}</select></div>
      <div class="field" id="f-stage"><label for="ns">Tahap</label><select id="ns">${STAGES.map((s) => `<option value="${s.id}"${(edit ? edit.stage : 'gagasan') === s.id ? ' selected' : ''}>${s.label}</option>`).join('')}</select></div>
    </div>
    <div class="field" id="f-goal"><label for="ng">Target jumlah kata</label><input id="ng" type="number" min="100" step="100"></div>
    <div class="dialog-actions">${edit ? '<button type="button" class="btn danger" id="fdel" style="margin-right:auto">Hapus karya</button>' : ''}<button class="btn" value="batal" formnovalidate>Batal</button><button class="btn btn-primary" value="ok">${edit ? 'Simpan' : 'Buat karya'}</button></div>
  </form>`
  document.body.append(dlg)
  const q = <T extends Element>(s: string) => dlg.querySelector<T>(s)!
  let armed = false
  q<HTMLButtonElement>('#fdel')?.addEventListener('click', async (ev) => {
    const b = ev.currentTarget as HTMLButtonElement
    if (!armed) {
      armed = true
      b.textContent = `Yakin? ${fmt(workWords(edit!))} kata ikut hilang`
      return
    }
    await ctx.remove(edit!.id)
    dlg.close('hapus')
  })
  const kind = q<HTMLSelectElement>('#nk')
  const goal = q<HTMLInputElement>('#ng')
  const sync = () => {
    const j = kind.value === 'jurnal'
    q<HTMLElement>('#f-stage').hidden = j
    q<HTMLElement>('#f-goal').hidden = j
    q<HTMLElement>('#f-sub').hidden = j
  }
  kind.addEventListener('change', () => {
    goal.value = String(KINDS.find((k) => k.id === kind.value)!.target)
    sync()
  })
  goal.value = String(edit ? edit.targetWords : KINDS.find((k) => k.id === kind.value)!.target)
  sync()
  dlg.addEventListener('close', async () => {
    if (dlg.returnValue === 'ok') {
      const title = q<HTMLInputElement>('#nt').value
      const stage = q<HTMLSelectElement>('#ns').value as StageId
      const subtitle = q<HTMLInputElement>('#nb').value
      const author = q<HTMLInputElement>('#na').value
      if (edit) {
        edit.title = title.trim() || edit.title
        edit.subtitle = subtitle.trim() || undefined
        edit.author = author.trim() || undefined
        edit.kind = kind.value as never
        if (edit.kind !== 'jurnal') {
          edit.stage = stage
          edit.targetWords = Number(goal.value) > 0 ? Number(goal.value) : edit.targetWords
        }
        await ctx.save(edit)
        dlg.remove()
        ctx.toast('Tersimpan')
        after?.()
        return
      }
      const j = kind.value === 'jurnal'
      const w = newWork({ title: title || (j ? 'Jurnal harian' : ''), kind: kind.value as never, stage: j ? 'draf' : stage, targetWords: Number(goal.value), subtitle: j ? '' : subtitle, author })
      await ctx.save(w)
      prefill?.onCreated()
      dlg.remove()
      ctx.go(`#/w/${w.id}?p=${w.parts[0].id}`)
      return
    }
    const gone = dlg.returnValue === 'hapus'
    dlg.remove()
    if (gone) {
      ctx.toast('Karya dihapus')
      if (location.hash.startsWith('#/b/')) ctx.go('#/')
      else after?.()
    }
  })
  dlg.showModal()
  q<HTMLInputElement>('#nt').focus()
}

const dtf = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
const tmf = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })
const mf = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })
const localInput = (ts: number) => {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function openIdeaList(ctx: Ctx, after: () => void) {
  let list = getIdeas()
  const dlg = document.createElement('dialog')
  dlg.className = 'glass-dlg'
  type IS = 'baru' | 'lama' | 'tahun' | 'az' | 'za'
  const ISORT: [IS, string][] = [['baru', 'Terbaru'], ['lama', 'Terlama'], ['tahun', 'Per tahun'], ['az', 'Judul A–Z'], ['za', 'Judul Z–A']]
  let sk: IS = 'baru'
  try { const v = localStorage.getItem('rtgs.sort.ide'); if (ISORT.some((x) => x[0] === v)) sk = v as IS } catch { /* abaikan */ }
  const sorted = () => {
    const l = [...list]
    const t = (i: Idea) => ideaTitle(i).toLocaleLowerCase('id')
    if (sk === 'lama') l.sort((a, b) => a.at - b.at)
    else if (sk === 'az') l.sort((a, b) => t(a).localeCompare(t(b), 'id'))
    else if (sk === 'za') l.sort((a, b) => t(b).localeCompare(t(a), 'id'))
    else l.sort((a, b) => b.at - a.at)
    return l
  }
  const body = () => {
    let last = ''
    return sorted()
      .map((i) => {
        const d = new Date(i.at)
        const g = sk === 'az' || sk === 'za' ? '' : sk === 'tahun' ? String(d.getFullYear()) : mf.format(d)
        const head = g && g !== last ? `<li class="ig">${g}</li>` : ''
        last = g
        const t = ideaTitle(i)
        return `${head}<li class="ii"><button type="button" class="ib" data-iid="${i.id}"><b>${escapeHtml(t)}</b><time>${dtf.format(d)} · ${tmf.format(d).replace(':', '.')}</time>${i.text && i.text !== t ? `<span>${escapeHtml(i.text)}</span>` : ''}</button><button type="button" class="ix" data-del="${i.id}" aria-label="Hapus ide ${escapeHtml(t)}" title="Hapus">×</button></li>`
      })
      .join('')
  }
  const paint = () => {
    dlg.innerHTML = `<form method="dialog">
    <h2>Catatan ide <span>${list.length}</span></h2>
    <label class="isort">Urutkan <select id="isort" aria-label="Urutkan catatan ide">${ISORT.map(([v, l]) => `<option value="${v}"${sk === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
    <ol class="idea-list">${body() || '<li class="ig">Belum ada ide.</li>'}</ol>
    <div class="dialog-actions"><button class="btn" value="baru" formnovalidate>+ Ide baru</button><button class="btn btn-primary" value="tutup" formnovalidate>Tutup</button></div>
  </form>`
  }
  paint()
  document.body.append(dlg)
  dlg.addEventListener('change', (e) => {
    const sel = (e.target as HTMLElement).closest<HTMLSelectElement>('#isort')
    if (!sel) return
    sk = sel.value as IS
    try { localStorage.setItem('rtgs.sort.ide', sk) } catch { /* abaikan */ }
    paint()
    dlg.querySelector<HTMLSelectElement>('#isort')?.focus()
  })
  dlg.addEventListener('click', (e) => {
    const t = e.target as HTMLElement
    const x = t.closest<HTMLButtonElement>('button[data-del]')
    if (x) {
      if (x.dataset.armed !== '1') {
        x.dataset.armed = '1'
        x.textContent = 'Hapus?'
        x.classList.add('armed')
        setTimeout(() => { if (x.isConnected) { x.dataset.armed = ''; x.textContent = '×'; x.classList.remove('armed') } }, 3000)
        return
      }
      removeIdea(x.dataset.del!)
      list = getIdeas()
      paint()
      after()
      return
    }
    const b = t.closest<HTMLButtonElement>('button[data-iid]')
    if (!b) return
    const idea = list.find((i) => i.id === b.dataset.iid)
    dlg.close('pilih')
    if (idea) openIdea(ctx, idea, after)
  })
  dlg.addEventListener('close', () => {
    const v = dlg.returnValue
    dlg.remove()
    if (v === 'baru') openIdea(ctx, undefined, after)
  })
  dlg.showModal()
}

function openIdea(ctx: Ctx, idea: Idea | undefined, after: () => void) {
  const dlg = document.createElement('dialog')
  dlg.innerHTML = `<form method="dialog">
    <h2>${idea ? 'Ide' : 'Ada ide baru'}</h2>
    <div class="field"><label for="ij">Judul ide</label><input id="ij" required maxlength="80" autocomplete="off" value="${escapeHtml(idea ? ideaTitle(idea) : '')}"></div>
    <div class="field"><label for="it">Isi ide (boleh dikosongkan)</label><textarea id="it" rows="4" maxlength="600">${escapeHtml(idea && idea.text !== ideaTitle(idea) ? idea.text : '')}</textarea></div>
    <div class="field"><label for="id">Tanggal masuk</label><input id="id" type="datetime-local" value="${localInput(idea?.at ?? Date.now())}"><small class="muted">Ide lama? Ubah ke saat ia muncul di kepalamu.</small></div>
    <div class="dialog-actions">
      ${idea ? '<button type="button" class="btn danger" id="idel" style="margin-right:auto">Hapus</button><button class="btn" value="karya" formnovalidate>Jadikan karya</button>' : ''}
      <button class="btn" value="batal" formnovalidate>Batal</button><button class="btn btn-primary" value="ok">Simpan</button>
    </div>
  </form>`
  document.body.append(dlg)
  const ti = dlg.querySelector<HTMLInputElement>('#ij')!
  const ta = dlg.querySelector<HTMLTextAreaElement>('#it')!
  const td = dlg.querySelector<HTMLInputElement>('#id')!
  let armed = false
  dlg.querySelector<HTMLButtonElement>('#idel')?.addEventListener('click', (e) => {
    const b = e.currentTarget as HTMLButtonElement
    if (!armed) { armed = true; b.textContent = 'Yakin? Hapus ide'; return }
    dlg.close('hapus')
  })
  dlg.addEventListener('close', () => {
    const v = dlg.returnValue
    const title = ti.value.trim()
    const text = ta.value.trim()
    const at = td.value ? new Date(td.value).getTime() : NaN
    dlg.remove()
    if (v === 'ok' && title) {
      const when = Number.isFinite(at) ? at : idea?.at ?? Date.now()
      if (idea) updateIdea(idea.id, title, text, when)
      else addIdea(title, text, when)
      ctx.toast('Ide tersimpan')
      after()
    } else if (v === 'hapus' && idea) {
      removeIdea(idea.id)
      ctx.toast('Ide dihapus')
      after()
    } else if (v === 'karya' && idea) {
      openForm(ctx, undefined, undefined, { title: title.slice(0, 120), onCreated: () => removeIdea(idea.id) })
    }
  })
  dlg.showModal()
  ti.focus()
}

let pop: HTMLElement | null = null
export function openSkinPop(ctx: Ctx, anchor: HTMLElement) {
  if (pop) { closeSkinPop(); return }
  const el = document.createElement('div')
  el.className = 'skin-pop'
  el.setAttribute('role', 'dialog')
  el.setAttribute('aria-label', 'Pilih tema')
  const paint = () => {
    const m = ctx.prefs.theme
    el.innerHTML = `<div class="skin-mode" role="group" aria-label="Terang atau gelap"><button type="button" data-mode="siang" aria-pressed="${m === 'siang'}">Terang</button><button type="button" data-mode="malam" aria-pressed="${m === 'malam'}">Gelap</button></div>
    <div class="skin-grid">${SKINS.map((k) => `<button type="button" class="skin-card" data-skin="${k.id}" aria-pressed="${ctx.prefs.skin === k.id}" style="--s1:${k.sw[m][0]};--s2:${k.sw[m][1]};--s3:${k.sw[m][2]}"><i></i><b>${k.label}</b><small>${k.desc}</small></button>`).join('')}</div>`
  }
  paint()
  const r = anchor.getBoundingClientRect()
  el.style.top = `${r.bottom + 8}px`
  el.style.right = `${Math.max(12, window.innerWidth - r.right)}px`
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button')
    if (!b) return
    if (b.dataset.mode) ctx.setPrefs({ theme: b.dataset.mode as 'siang' | 'malam' })
    else if (b.dataset.skin) ctx.setPrefs({ skin: b.dataset.skin as never })
    paint()
  })
  const away = (e: Event) => { if (!el.contains(e.target as Node) && !anchor.contains(e.target as Node)) closeSkinPop() }
  const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSkinPop() }
  setTimeout(() => document.addEventListener('pointerdown', away), 0)
  document.addEventListener('keydown', esc)
  ;(el as HTMLElement & { _off?: () => void })._off = () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc) }
  document.body.append(el)
  pop = el
}
export function closeSkinPop() {
  if (!pop) return
  ;(pop as HTMLElement & { _off?: () => void })._off?.()
  pop.remove()
  pop = null
}
