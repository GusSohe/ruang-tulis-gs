// Jendela "Suasana": roda kategori, daftar suara, audio milikmu, dan bar pemutar.
import { CATS, player, type CatId, type Track } from './audio'
import { escapeHtml } from './model'

const I = (d: string, extra = '') => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`
const ICONS: Record<string, string> = {
  rain: '<path d="M7 15a4 4 0 0 1 .6-7.9A5.5 5.5 0 0 1 18 8.5a3.3 3.3 0 0 1-.5 6.5H7z"/><path d="M9 18l-1 2M13 18l-1 2M17 18l-1 2"/>',
  wave: '<path d="M2 9c2.5-3 4.5-3 7 0s4.5 3 7 0 3.5-2 6 0M2 15c2.5-3 4.5-3 7 0s4.5 3 7 0 3.5-2 6 0"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  fire: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.2 2-4.2.2 1.4.8 2.2 1.6 2.6C10 8.5 10.8 5.5 12 3z"/>',
  book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  cup: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9z"/><path d="M16 10h2a2.5 2.5 0 0 1 0 5h-2M8 3v3M12 3v3"/>',
  train: '<rect x="6" y="3" width="12" height="14" rx="3"/><path d="M6 11h12M9 21l2-4M15 21l-2-4"/><circle cx="9.5" cy="14" r=".6"/><circle cx="14.5" cy="14" r=".6"/>',
  bars: '<path d="M5 10v4M9 6v12M13 9v6M17 4v16M21 11v2"/>',
  mist: '<path d="M4 8h16M6 12h12M3 16h14M8 20h10"/>',
  phones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  note: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
}
const ico = (n: string) => I(ICONS[n] ?? ICONS.note)
const SVG = {
  play: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>',
  prev: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="2.2" height="14"/><path d="M19 5.5v13L9 12z"/></svg>',
  next: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><rect x="16.8" y="5" width="2.2" height="14"/><path d="M5 5.5v13L15 12z"/></svg>',
  loop: I('<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>'),
  stop: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>',
  vol: I('<path d="M4 9.5v5h4l5 4v-13l-5 4z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/>'),
  close: I('<path d="M6 6l12 12M18 6L6 18"/>'),
  folder: I('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  back: I('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  eq: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><rect x="3" y="9" width="3" height="6" rx="1.2"/><rect x="8" y="5" width="3" height="14" rx="1.2"/><rect x="13" y="8" width="3" height="8" rx="1.2"/><rect x="18" y="4" width="3" height="16" rx="1.2"/></svg>',
}
export const soundIcon = SVG.eq

/* roda: tiga juring 120° */
const CX = 130, CY = 130, R1 = 124, R0 = 72
const pt = (r: number, deg: number) => `${(CX + r * Math.cos((deg * Math.PI) / 180)).toFixed(2)} ${(CY + r * Math.sin((deg * Math.PI) / 180)).toFixed(2)}`
const sector = (a1: number, a2: number) => `M${pt(R1, a1)} A${R1} ${R1} 0 0 1 ${pt(R1, a2)} L${pt(R0, a2)} A${R0} ${R0} 0 0 0 ${pt(R0, a1)} Z`
const CENTER: Record<CatId, number> = { alam: -90, dunia: 30, fokus: 150 }

let ov: HTMLElement | null = null
let unsub: (() => void) | null = null

export function openSound() {
  if (ov) return
  let view: CatId | 'milik' = player.state().track && player.state().track!.cat !== 'milik' ? (player.state().track!.cat as CatId) : 'alam'
  ov = document.createElement('div')
  ov.className = 'snd-ov'
  const wheel = CATS.map((c) => {
    const a = CENTER[c.id]
    const lp = pt(94, a).split(' ').map(Number)
    return `<g class="sec" data-cat="${c.id}" tabindex="0" role="button" aria-label="${c.label}, ${player.group(c.id).length} suara"><path d="${sector(a - 58, a + 58)}"/><g class="sec-l" transform="translate(${lp[0]} ${lp[1]})"><g transform="translate(-9 -22)">${ico(c.id === 'alam' ? 'moon' : c.id === 'dunia' ? 'book' : 'bars')}</g><text y="10" text-anchor="middle" class="sl1">${c.label}</text><text y="23" text-anchor="middle" class="sl2">${player.group(c.id).length} suara</text></g></g>`
  }).join('')
  ov.innerHTML = `<div class="snd" role="dialog" aria-modal="true" aria-labelledby="snd-h">
    <header class="snd-top"><span class="snd-brand">${SVG.eq.replace('width="22" height="22"', 'width="16" height="16"')}Ruang Tulis GS · Suasana</span><button class="snd-x" data-a="close" aria-label="Tutup">${SVG.close}</button></header>
    <div class="snd-head"><div><h2 id="snd-h">Temukan suasanamu.</h2><p>Sedikit bunyi. Sedikit ruang. Duniamu sendiri.</p></div><button class="snd-mine" data-a="mine">${SVG.folder}<span>Audio-mu</span></button></div>
    <div class="snd-body">
      <div class="snd-wheel"><svg viewBox="0 0 260 260" role="group" aria-label="Kategori suara"><circle class="ring" cx="130" cy="130" r="${R0 - 6}"/>${wheel}</svg>
        <div class="wheel-c"><small>Suara terpilih</small><b id="w-title"></b><button class="wplay" data-a="toggle" aria-label="Putar atau jeda"></button></div></div>
      <div class="snd-list" id="snd-list"></div>
    </div>
    <div class="snd-bar">
      <div class="np"><i class="dot"></i><div><b id="np-t"></b><small id="np-s"></small></div></div>
      <div class="ctl">
        <button data-a="prev" aria-label="Sebelumnya">${SVG.prev}</button>
        <button data-a="toggle" class="pp" aria-label="Putar atau jeda" id="pp"></button>
        <button data-a="next" aria-label="Berikutnya">${SVG.next}</button>
        <button data-a="loop" id="lp" aria-label="Ulangi trek" title="Ulangi trek ini">${SVG.loop}</button>
        <button data-a="stop" aria-label="Hentikan" title="Hentikan">${SVG.stop}</button>
        <span class="vol">${SVG.vol}<input id="vol" type="range" min="0" max="100" aria-label="Volume"><output id="vo"></output></span>
      </div>
    </div>
    <footer class="snd-foot"><span>Suaramu tetap menyala saat jendela ditutup.</span><span><kbd>Esc</kbd> untuk menutup</span></footer>
    <input type="file" id="snd-file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac,.opus" multiple hidden>
  </div>`
  document.body.append(ov)
  const $ = <T extends HTMLElement>(s: string) => ov!.querySelector<T>(s)!
  const panel = $('.snd')
  const vol = $<HTMLInputElement>('#vol')

  const trackBtn = (t: Track, st: ReturnType<typeof player.state>) => {
    const on = st.track?.id === t.id
    const act = on && st.playing
    return `<li><div class="trk${on ? ' on' : ''}"><button class="trk-b" data-t="${t.id}" aria-pressed="${on}">
      <span class="ti">${ico(t.icon)}</span><span class="tt"><b>${escapeHtml(t.title)}</b><small>${escapeHtml(t.sub)}</small></span>
      <span class="ts">${act ? SVG.pause : on ? '<em>✓</em>' : SVG.play.replace('width="20" height="20"', 'width="14" height="14"')}</span></button>${t.builtin ? '' : `<button class="trk-x" data-rm="${t.id}" aria-label="Hapus ${escapeHtml(t.title)} dari audio-mu" title="Hapus dari audio-mu">${SVG.close.replace('width="18" height="18"', 'width="14" height="14"')}</button>`}</div></li>`
  }

  const paint = () => {
    const st = player.state()
    panel.dataset.cat = view
    $('#w-title').textContent = st.track?.title ?? 'Belum dipilih'
    $('.wplay').innerHTML = st.playing ? SVG.pause : SVG.play
    $('#pp').innerHTML = st.playing ? SVG.pause : SVG.play
    $('#np-t').textContent = st.track?.title ?? 'Tidak ada suara'
    $('#np-s').textContent = st.track ? `${st.playing ? 'Memutar' : 'Dijeda'} · ${st.track.cat === 'milik' ? 'Audio-mu' : CATS.find((c) => c.id === st.track!.cat)!.label}` : 'Pilih satu suara di daftar'
    $('.snd-bar .dot').classList.toggle('live', st.playing)
    $('#lp').setAttribute('aria-pressed', String(st.loop))
    if (document.activeElement !== vol) vol.value = String(Math.round(st.vol * 100))
    $('#vo').textContent = `${Math.round(st.vol * 100)}%`
    vol.style.setProperty('--v', `${Math.round(st.vol * 100)}%`)
    ov!.querySelectorAll<SVGGElement>('.sec').forEach((g) => g.classList.toggle('on', g.dataset.cat === view))
    $('.snd-mine').classList.toggle('on', view === 'milik')
    const list = $('#snd-list')
    const tracks = player.group(view)
    if (view === 'milik') {
      list.innerHTML = `<h3>Audio-mu</h3><p class="blurb">Berkas dari komputermu. Disimpan di peramban ini dan bisa diputar tanpa internet.</p>
        ${tracks.length ? `<ul>${tracks.map((t) => trackBtn(t, st)).join('')}</ul>` : '<p class="empty">Belum ada audio. Tambahkan MP3, WAV, OGG, atau M4A.</p>'}
        <div class="add"><button class="snd-add" data-a="add">${SVG.plus}<span>Tambah audio</span></button><span class="hint">Pilih satu atau beberapa berkas</span></div>`
    } else {
      const c = CATS.find((x) => x.id === view)!
      list.innerHTML = `<h3>${c.label}</h3><p class="blurb">${c.blurb}</p><ul>${tracks.map((t) => trackBtn(t, st)).join('')}</ul>
        <div class="add"><span class="hint">${I('<path d="M4 12c2-4 4-4 6 0s4 4 6 0 3-3 4-2"/>')}Dibangkitkan langsung. Selalu tersedia tanpa internet.</span></div>
        <div class="add"><button class="snd-add" data-a="add">${SVG.plus}<span>Tambah audio</span></button><span class="hint">atau <button class="lnk" data-a="mine">pilih dari audio-mu</button></span></div>`
    }
  }

  const close = () => {
    unsub?.()
    unsub = null
    document.removeEventListener('keydown', onKey, true)
    ov?.remove()
    ov = null
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
    }
  }
  document.addEventListener('keydown', onKey, true)
  unsub = player.subscribe(paint)

  ov.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement
    if (t === ov) return close()
    const rm = t.closest<HTMLElement>('[data-rm]')
    if (rm) return void (await player.remove(rm.dataset.rm!))
    const tb = t.closest<HTMLElement>('[data-t]')
    if (tb) {
      const st = player.state()
      if (st.track?.id === tb.dataset.t) return void (await player.toggle())
      return void (await player.play(tb.dataset.t))
    }
    const sec = t.closest<SVGGElement>('.sec')
    if (sec) {
      view = sec.dataset.cat as CatId
      return paint()
    }
    const a = t.closest<HTMLElement>('[data-a]')?.dataset.a
    if (a === 'close') close()
    else if (a === 'toggle') await player.toggle()
    else if (a === 'prev') await player.prev()
    else if (a === 'next') await player.next()
    else if (a === 'loop') player.toggleLoop()
    else if (a === 'stop') player.stop()
    else if (a === 'mine') {
      view = 'milik'
      paint()
    } else if (a === 'add') $<HTMLInputElement>('#snd-file').click()
  })
  ov.addEventListener('keydown', (e) => {
    const sec = (e.target as HTMLElement).closest<SVGGElement>('.sec')
    if (sec && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      view = sec.dataset.cat as CatId
      paint()
    }
  })
  vol.addEventListener('input', () => player.setVol(Number(vol.value) / 100))
  $<HTMLInputElement>('#snd-file').addEventListener('change', async (e) => {
    const inp = e.target as HTMLInputElement
    if (inp.files?.length) {
      const n = await player.add(inp.files)
      if (n) view = 'milik'
      paint()
    }
    inp.value = ''
  })
  void player.init().then(paint)
  paint()
  $('.snd-x').focus()
}

/** Titik kecil di tombol "Suara": menyala saat ada yang diputar. */
export function bindSoundIndicator() {
  const set = () => {
    document.documentElement.dataset.snd = player.state().playing ? 'on' : 'off'
  }
  player.subscribe(set)
  set()
  void player.init()
}
