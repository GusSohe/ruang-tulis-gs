// Halaman Ikhtisar menulis: gambaran lengkap kebiasaan menulis, bukan hanya angka hari ini.
import type { Ctx } from './ctx'
import { escapeHtml, fmt, isJournal, workWords } from './model'
import { getCut, getHours, getLog, getTime, heatmap, longestStreak, series, streak, todayMinutes, todayWords, weekdays, type Range } from './log'
import { getSprints } from './sprint'

let range: Range = '28'
let metric: 'words' | 'secs' | 'cut' = 'words'
const dfull = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const mshort = new Intl.DateTimeFormat('id-ID', { month: 'short' })
const hrs = (secs: number) => (secs >= 3600 ? `${(secs / 3600).toFixed(1).replace('.', ',')} jam` : `${Math.round(secs / 60)} menit`)

export function renderOverview(root: HTMLElement, ctx: Ctx): { destroy(): void } {
  document.title = 'Ikhtisar menulis · Ruang Tulis GS'
  const goal = Math.max(50, ctx.prefs.dailyGoal)
  const goalMin = Math.max(5, ctx.prefs.dailyMinutes)
  const lg = getLog(), cut = getCut(), tm = getTime(), hr = getHours()
  const keys = Object.keys(lg).filter((k) => lg[k] > 0).sort()
  const sum = (o: Record<string, number>) => Object.values(o).reduce((n, v) => n + v, 0)
  const totalW = sum(lg), totalC = sum(cut), totalS = sum(tm)
  const days = keys.length
  const bestKey = keys.reduce((b, k) => (lg[k] > (lg[b] ?? 0) ? k : b), keys[0] ?? '')
  const hit = keys.filter((k) => lg[k] >= goal).length
  const speed = totalS >= 600 ? Math.round(totalW / (totalS / 3600)) : 0
  const sp = getSprints()
  const spWords = sp.reduce((n, s) => n + s.words, 0)
  const spHit = sp.filter((s) => s.words >= s.goal).length

  const tile = (l: string, v: string, s = '') => `<div class="ov-t"><span>${l}</span><b>${v}</b>${s ? `<i>${s}</i>` : ''}</div>`

  /* peta panas setahun */
  const cols = heatmap()
  const lvl = (w: number) => (w <= 0 ? 0 : w < goal * 0.25 ? 1 : w < goal * 0.6 ? 2 : w < goal ? 3 : 4)
  let lastM = -1
  const heat = cols.map((c) => {
    const m = c[0].date.getMonth()
    const lab = m !== lastM ? mshort.format(c[0].date) : ''
    lastM = m
    return `<div class="hc"><em>${lab}</em>${c.map((d) => `<i class="h${d.fut ? 'f' : lvl(d.words)}" title="${dfull.format(d.date)}: ${d.words ? fmt(d.words) + ' kata' : 'belum menulis'}"></i>`).join('')}</div>`
  }).join('')

  /* bagan utama */
  const slots = series(range)
  const val = (s: (typeof slots)[number]) => (metric === 'words' ? s.words : metric === 'cut' ? s.cut : Math.round(s.secs / 60))
  const unit = metric === 'secs' ? 'menit' : 'kata'
  const per = range === '84' ? 7 : 1
  const ref = metric === 'words' ? goal * per : metric === 'secs' ? goalMin * per : 0
  const mx = Math.max(ref, ...slots.map(val), 1)
  const bars = slots.map((s, i) => {
    const v = val(s)
    const lab = range === '28' ? (i % 7 === 0 || s.now ? s.label : '') : s.label
    return `<div class="bar${s.now ? ' now' : ''}${ref && v >= ref ? ' hit' : ''}" title="${s.title}: ${fmt(v)} ${unit}"><div class="col">${ref ? `<i class="gl" style="bottom:${(ref / mx) * 100}%"></i>` : ''}<span style="height:${v ? Math.max(3, (v / mx) * 100) : 1.5}%"></span></div><em>${lab}</em></div>`
  }).join('')
  const sl = slots
  const sumW = sl.reduce((n, s) => n + s.words, 0), sumC = sl.reduce((n, s) => n + s.cut, 0), sumS = sl.reduce((n, s) => n + s.secs, 0)

  /* hari dalam pekan dan jam menulis */
  const wd = weekdays()
  const wdMax = Math.max(1, ...wd.map((x) => x.words))
  const wdBest = wd.reduce((b, x, i) => (x.words > wd[b].words ? i : b), 0)
  const NM = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
  const FULL = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
  const hMax = Math.max(1, ...Array.from({ length: 24 }, (_, h) => hr[h] ?? 0))
  const hBest = Array.from({ length: 24 }, (_, h) => h).reduce((b, h) => ((hr[h] ?? 0) > (hr[b] ?? 0) ? h : b), 0)
  const hasHours = sum(hr) > 0
  const part = (h: number) => (h < 4 ? 'dini hari' : h < 11 ? 'pagi' : h < 15 ? 'siang' : h < 18 ? 'sore' : 'malam')

  /* karya terbanyak */
  const top = ctx.works.filter((w) => !isJournal(w)).map((w) => ({ w, n: workWords(w) })).sort((a, b) => b.n - a.n).slice(0, 5)
  const topMax = Math.max(1, ...top.map((t) => t.n))

  const goalLine = keys.length
    ? `Kamu mencapai target harian di <b>${hit}</b> dari ${days} hari menulis (${Math.round((hit / days) * 100)}%).`
    : 'Belum ada hari menulis tercatat.'

  root.innerHTML = `<div class="ovp">
    <header class="ov-h"><a class="btn" href="#/">Kembali ke meja</a><h1>Ikhtisar menulis</h1>
      <div class="ov-goals"><label>Target harian <input id="og" type="number" min="50" step="50" value="${goal}"> kata</label><label><input id="om" type="number" min="5" step="5" value="${goalMin}"> menit di meja</label></div></header>

    <section class="card ov-today"><div><span class="lbl">Hari ini</span><p>${fmt(todayWords())} dari ${fmt(goal)} kata · ${fmt(todayMinutes())} dari ${fmt(goalMin)} menit</p></div>
      <div class="ov-m"><span class="mt"><i style="width:${Math.min(100, (todayWords() / goal) * 100)}%"></i></span><span class="mt"><i style="width:${Math.min(100, (todayMinutes() / goalMin) * 100)}%"></i></span></div></section>

    <div class="ov-tiles">
      ${tile('Total kata ditulis', fmt(totalW), `${fmt(days)} hari menulis`)}
      ${tile('Total di meja', hrs(totalS), speed ? `${fmt(speed)} kata per jam` : 'kecepatan muncul setelah 10 menit')}
      ${tile('Runtun sekarang', `${streak()} hari`, `terpanjang ${longestStreak()} hari`)}
      ${tile('Rata-rata', `${fmt(days ? Math.round(totalW / days) : 0)} kata`, 'per hari menulis')}
      ${tile('Hari terbaik', bestKey ? fmt(lg[bestKey]) + ' kata' : '–', bestKey ? dfull.format(new Date(bestKey + 'T12:00:00')) : '')}
      ${tile('Kata dipangkas', fmt(totalC), totalW ? `${Math.round((totalC / Math.max(1, totalW + totalC)) * 100)}% dari yang kamu tulis dan buang` : '')}
    </div>
    <p class="ov-note">${goalLine}</p>

    <section class="card"><div class="card-h"><span class="lbl">Setahun terakhir</span><span class="muted">terang berarti mendekati atau melewati target harian</span></div>
      <div class="heat" role="img" aria-label="Peta panas menulis selama setahun">${heat}</div>
      <div class="heat-k"><span>Sedikit</span><i class="h0"></i><i class="h1"></i><i class="h2"></i><i class="h3"></i><i class="h4"></i><span>Mencapai target</span></div></section>

    <section class="card"><div class="card-h"><span class="lbl">Perkembangan</span>
      <div class="ov-ctl"><div class="tabs" role="group" aria-label="Rentang">${([['7', '7 hari'], ['28', '28 hari'], ['84', '12 minggu']] as [Range, string][]).map(([r, l]) => `<button data-range="${r}" aria-pressed="${range === r}">${l}</button>`).join('')}</div>
      <div class="tabs" role="group" aria-label="Ukuran">${([['words', 'Kata'], ['secs', 'Waktu'], ['cut', 'Dipangkas']] as ['words' | 'secs' | 'cut', string][]).map(([m, l]) => `<button data-metric="${m}" aria-pressed="${metric === m}">${l}</button>`).join('')}</div></div></div>
      <div class="tot"><div><b>${fmt(sumW)}</b><span>Kata ditulis</span></div><div><b>${fmt(sumC)}</b><span>Kata dipangkas</span></div><div><b>${hrs(sumS)}</b><span>Di meja</span></div></div>
      <div class="bars ov-bars b${range}">${bars}</div></section>

    <div class="ov-2">
      <section class="card"><div class="card-h"><span class="lbl">Hari dalam pekan</span><span class="muted">${wd[wdBest].words ? `paling produktif: ${FULL[wdBest]}` : ''}</span></div>
        <div class="hb">${wd.map((x, i) => `<div class="hbc${i === wdBest && x.words ? ' top' : ''}" title="${FULL[i]}: ${fmt(x.words)} kata dalam ${x.days} hari"><span style="height:${x.words ? Math.max(4, (x.words / wdMax) * 100) : 1}%"></span><em>${NM[i]}</em></div>`).join('')}</div></section>
      <section class="card"><div class="card-h"><span class="lbl">Jam menulis</span><span class="muted">${hasHours ? `paling sering: ${String(hBest).padStart(2, '0')}.00, ${part(hBest)}` : ''}</span></div>
        ${hasHours ? `<div class="hb h24">${Array.from({ length: 24 }, (_, h) => `<div class="hbc${h === hBest ? ' top' : ''}" title="${String(h).padStart(2, '0')}.00: ${fmt(hr[h] ?? 0)} kata"><span style="height:${hr[h] ? Math.max(4, (hr[h] / hMax) * 100) : 1}%"></span><em>${h % 6 === 0 ? h : ''}</em></div>`).join('')}</div><p class="note-s">Dicatat sejak versi ini; tulisan lama tidak punya data jam.</p>` : '<p class="muted pad">Muncul setelah kamu mulai menulis.</p>'}</section>
    </div>

    <div class="ov-2">
      <section class="card"><div class="card-h"><span class="lbl">Karya paling banyak kata</span></div>
        ${top.length ? `<ol class="topw">${top.map((t) => `<li><a href="#/b/${t.w.id}">${escapeHtml(t.w.title)}</a><span class="mt"><i style="width:${(t.n / topMax) * 100}%"></i></span><b>${fmt(t.n)}</b></li>`).join('')}</ol>` : '<p class="muted pad">Belum ada karya.</p>'}</section>
      <section class="card"><div class="card-h"><span class="lbl">Sprint</span></div>
        ${sp.length ? `<div class="tot"><div><b>${sp.length}</b><span>Sprint selesai</span></div><div><b>${spHit}</b><span>Target tercapai</span></div><div><b>${fmt(spWords)}</b><span>Kata dari sprint</span></div></div>
        <ul class="spl">${[...sp].reverse().slice(0, 5).map((s) => `<li><span>${dfull.format(new Date(s.at))}</span><b>${fmt(s.words)} / ${fmt(s.goal)} kata</b><em>${s.minutes} mnt</em></li>`).join('')}</ul>` : '<p class="muted pad">Belum ada sprint. Mulai dari tombol Sprint di meja.</p>'}</section>
    </div>
  </div>`

  const again = () => renderOverview(root, ctx)
  root.querySelectorAll<HTMLButtonElement>('[data-range]').forEach((b) => b.addEventListener('click', () => { range = b.dataset.range as Range; again() }))
  root.querySelectorAll<HTMLButtonElement>('[data-metric]').forEach((b) => b.addEventListener('click', () => { metric = b.dataset.metric as typeof metric; again() }))
  root.querySelector<HTMLInputElement>('#og')!.addEventListener('change', (e) => {
    const n = Math.round(Number((e.target as HTMLInputElement).value))
    ctx.setPrefs({ dailyGoal: n >= 50 ? n : 300 })
    again()
  })
  root.querySelector<HTMLInputElement>('#om')!.addEventListener('change', (e) => {
    const n = Math.round(Number((e.target as HTMLInputElement).value))
    ctx.setPrefs({ dailyMinutes: n >= 5 ? n : 30 })
    again()
  })
  return { destroy() { /* tanpa pendengar global */ } }
}
