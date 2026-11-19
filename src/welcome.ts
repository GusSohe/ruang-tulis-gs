// Layar lampu: pertama kali dibuka untuk memilih mode penyimpanan; sesudahnya animasi singkat yang bisa dilewati.
import { getIntro, getMode, setMode, type Mode } from './mode'

const lamp = (on: boolean) => `<svg class="lp-svg" viewBox="0 0 400 580" aria-hidden="true">
  <defs>
    <linearGradient id="lp-cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc77a" stop-opacity=".55"/><stop offset="1" stop-color="#ffb35a" stop-opacity="0"/></linearGradient>
    <radialGradient id="lp-halo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd9a0" stop-opacity=".75"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></radialGradient>
    <linearGradient id="lp-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe6bd"/><stop offset="1" stop-color="#f2a95a"/></linearGradient>
  </defs>
  <polygon class="lp-cone" points="108,176 292,176 400,570 0,570" fill="url(#lp-cone)"/>
  <circle class="lp-halo" cx="200" cy="170" r="150" fill="url(#lp-halo)"/>
  <ellipse cx="200" cy="556" rx="64" ry="12" fill="#1b1410"/><ellipse cx="200" cy="552" rx="46" ry="7" fill="#2a2018"/>
  <rect x="195" y="190" width="10" height="362" rx="3" fill="#20180f"/>
  <rect x="192" y="340" width="16" height="9" rx="2" fill="#8a6a38"/>
  <path class="lp-shadef" d="M158 64 H242 L292 176 H108 Z" fill="#17120d"/>
  <path class="lp-shadeo" d="M158 64 H242 L292 176 H108 Z" fill="url(#lp-shade)"/>
  <ellipse cx="200" cy="64" rx="42" ry="6" fill="#0d0907" opacity=".6"/>
  <circle class="lp-bulb" cx="200" cy="178" r="13" fill="#fff1d0"/>
  <g class="lp-cord"><line x1="262" y1="176" x2="262" y2="256" stroke="#c9a468" stroke-width="2" class="lp-line"/><circle cx="262" cy="262" r="8" fill="#c9a468" class="lp-knob"/></g>
</svg>`

export function openWelcome(opts: { first: boolean; done: () => void }) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!opts.first && (reduce || !getIntro())) return opts.done()
  document.querySelector('.lp')?.remove()
  const el = document.createElement('div')
  el.className = 'lp'
  el.setAttribute('role', 'dialog')
  el.setAttribute('aria-modal', 'true')
  el.setAttribute('aria-label', 'Selamat datang di Ruang Tulis GS')
  el.innerHTML = `<div class="lp-scene">${lamp(false)}
      <button type="button" class="lp-pull" aria-label="Tarik tali lampu"><span></span></button>
      <p class="lp-hint">Tarik tali lampu</p></div>
    <div class="lp-card" hidden></div>
    ${opts.first ? '' : '<button type="button" class="lp-skip">Lewati</button>'}`
  document.body.append(el)
  const card = el.querySelector<HTMLElement>('.lp-card')!
  const cord = el.querySelector<SVGGElement>('.lp-cord')!
  const pull = el.querySelector<HTMLButtonElement>('.lp-pull')!
  const hint = el.querySelector<HTMLElement>('.lp-hint')!
  let lit = false, finished = false

  const finish = (m?: Mode) => {
    if (finished) return
    finished = true
    if (m) setMode(m)
    el.classList.add('out')
    window.removeEventListener('keydown', onKey)
    setTimeout(() => { el.remove(); opts.done() }, 450)
  }
  const choose = () => {
    card.hidden = false
    const cur = getMode()
    card.innerHTML = `<h1>Ruang Tulis GS</h1>
      <p>Di mana tulisanmu disimpan?</p>
      <button type="button" class="lp-opt" data-m="lokal"><b>Di perangkat ini saja</b><span>Semua berkas tinggal di peramban perangkat ini. Tidak ada koneksi internet yang dipakai.</span></button>
      <button type="button" class="lp-opt" data-m="drive"><b>Hubungkan Google Drive</b><span>Salinan tulisanmu disimpan di Drive-mu sendiri, untuk pindah atau memakai lebih dari satu perangkat. Tetap bisa dipakai offline; sinkron berjalan saat online.</span></button>
      <p class="lp-note">Bisa diganti kapan saja lewat tombol Cadangan.</p>`
    card.querySelectorAll<HTMLButtonElement>('.lp-opt').forEach((b) => {
      if (b.dataset.m === cur) b.classList.add('cur')
      b.addEventListener('click', () => finish(b.dataset.m as Mode))
    })
    card.querySelector<HTMLButtonElement>('.lp-opt')!.focus()
  }
  const welcomeBack = () => {
    card.hidden = false
    card.classList.add('back')
    card.innerHTML = `<h1>Ruang Tulis GS</h1><p>Selamat datang kembali.</p>`
    setTimeout(() => finish(), 1100)
  }
  const toggle = () => {
    lit = !lit
    el.classList.toggle('on', lit)
    hint.hidden = true
    if (lit) setTimeout(() => (opts.first ? choose() : welcomeBack()), 650)
    else if (opts.first) { card.hidden = true; hint.hidden = false }
  }
  const tug = () => {
    cord.classList.add('tug')
    setTimeout(() => cord.classList.remove('tug'), 260)
    toggle()
  }
  /* seret atau klik tali */
  let y0 = 0, drag = false
  pull.addEventListener('pointerdown', (e) => { drag = true; y0 = e.clientY; pull.setPointerCapture(e.pointerId) })
  pull.addEventListener('pointermove', (e) => {
    if (!drag) return
    const dy = Math.max(0, Math.min(46, e.clientY - y0))
    cord.style.transform = `translateY(${dy}px)`
    pull.style.transform = `translateY(${dy}px)`
  })
  const release = (e: PointerEvent) => {
    if (!drag) return
    drag = false
    const dy = e.clientY - y0
    cord.style.transform = pull.style.transform = ''
    if (dy > 26 || Math.abs(dy) < 4) tug()
  }
  pull.addEventListener('pointerup', release)
  pull.addEventListener('pointercancel', () => { drag = false; cord.style.transform = pull.style.transform = '' })
  pull.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tug() } })

  const onKey = (e: KeyboardEvent) => { if (!opts.first && !finished) { e.preventDefault(); finish() } }
  window.addEventListener('keydown', onKey)
  el.querySelector('.lp-skip')?.addEventListener('click', () => finish())
  if (!opts.first) setTimeout(tug, 550) // kunjungan berikutnya: tali tertarik sendiri
}

export const needsWelcome = () => getMode() === null
