// Sprint menulis: ditetapkan waktu dan target kata, selesai otomatis, dicatat untuk halaman Ikhtisar.
import { player, BUILTIN } from './audio'
import { todayWords } from './log'
import { fmt } from './model'

const KEY = 'rtgs.sprint.v1'
const HKEY = 'rtgs.sprints.v1'
export interface Active { startAt: number; minutes: number; goal: number; base: number }
export interface Done { at: number; minutes: number; goal: number; words: number }

const read = <T>(k: string, d: T): T => {
  try { return (JSON.parse(localStorage.getItem(k) ?? 'null') as T) ?? d } catch { return d }
}
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* tidak kritis */ } }

export const getActive = () => read<Active | null>(KEY, null)
export const getSprints = () => read<Done[]>(HKEY, [])
export const setSprints = (l?: Done[]) => { if (Array.isArray(l)) write(HKEY, l) }
export const remainingMs = () => {
  const a = getActive()
  return a ? Math.max(0, a.startAt + a.minutes * 60000 - Date.now()) : 0
}
export const sprintWords = (extra = 0) => {
  const a = getActive()
  return a ? Math.max(0, todayWords() - a.base + extra) : 0
}
export function sprintLabel(): string {
  if (!getActive()) return ''
  const s = Math.ceil(remainingMs() / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const chime = () => {
  try {
    const C = window.AudioContext
    const a = new C()
    ;[0, 0.28, 0.56].forEach((d, i) => {
      const o = a.createOscillator(), g = a.createGain()
      o.type = 'sine'
      o.frequency.value = [660, 880, 1320][i]
      g.gain.setValueAtTime(0.0001, a.currentTime + d)
      g.gain.exponentialRampToValueAtTime(0.2, a.currentTime + d + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + d + 1.2)
      o.connect(g)
      g.connect(a.destination)
      o.start(a.currentTime + d)
      o.stop(a.currentTime + d + 1.3)
    })
    setTimeout(() => void a.close(), 2500)
  } catch { /* tanpa suara */ }
}

export async function startSprint(minutes: number, goal: number, sound: boolean) {
  write(KEY, { startAt: Date.now(), minutes, goal, base: todayWords() } satisfies Active)
  if (sound) await player.play(player.state().track?.id ?? BUILTIN[0].id)
  window.dispatchEvent(new Event('rtgs:s'))
}

/** Akhiri sprint: dicatat bila sudah berjalan minimal semenit. Mengembalikan hasilnya. */
export function endSprint(natural: boolean): Done | null {
  const a = getActive()
  if (!a) return null
  localStorage.removeItem(KEY)
  const elapsed = Math.min(a.minutes, Math.round((Date.now() - a.startAt) / 60000))
  const done: Done = { at: a.startAt, minutes: natural ? a.minutes : elapsed, goal: a.goal, words: Math.max(0, todayWords() - a.base) }
  if (done.minutes >= 1) write(HKEY, [...getSprints(), done].slice(-200))
  window.dispatchEvent(new Event('rtgs:s'))
  return done
}

let watching = false
export function watchSprint() {
  if (watching) return
  watching = true
  window.setInterval(() => {
    if (!getActive()) return
    window.dispatchEvent(new Event('rtgs:s'))
    if (remainingMs() <= 0) {
      chime()
      // beri waktu pada penyimpanan editor yang tertunda sebelum menghitung kata
      window.setTimeout(() => {
        const d = endSprint(true)
        if (d) showResult(d)
      }, 900)
    }
  }, 1000)
}

function dlg(html: string) {
  document.querySelector('dialog.sprint-dlg')?.remove()
  const d = document.createElement('dialog')
  d.className = 'glass-dlg sprint-dlg'
  d.innerHTML = html
  document.body.append(d)
  d.addEventListener('close', () => d.remove())
  d.showModal()
  return d
}

function showResult(d: Done) {
  const hit = d.words >= d.goal
  const x = dlg(`<form method="dialog"><h2>${hit ? 'Sprint tercapai' : 'Sprint selesai'}</h2>
    <p class="sp-big"><b>${fmt(d.words)}</b> kata dalam ${d.minutes} menit</p>
    <p class="sp-sub">${hit ? `Target ${fmt(d.goal)} kata terlampaui.` : `Target ${fmt(d.goal)} kata, kurang ${fmt(d.goal - d.words)}. Sprint berikutnya bisa lebih pendek atau targetnya lebih ringan.`}</p>
    <div class="dialog-actions"><button class="btn btn-primary" value="ok">Tutup</button></div></form>`)
  x.querySelector('button')?.focus()
}

export function openSprint() {
  const a = getActive()
  if (a) {
    const x = dlg(`<form method="dialog"><h2>Sprint berjalan</h2>
      <p class="sp-big"><b id="sp-t">${sprintLabel()}</b> tersisa</p>
      <p class="sp-sub"><span id="sp-w">${fmt(sprintWords())}</span> dari ${fmt(a.goal)} kata</p>
      <div class="dialog-actions"><button class="btn" value="end" id="sp-end" type="button">Akhiri sekarang</button><button class="btn btn-primary" value="ok">Lanjut menulis</button></div></form>`)
    const tick = () => {
      const t = x.querySelector('#sp-t'), w = x.querySelector('#sp-w')
      if (!t || !getActive()) return
      t.textContent = sprintLabel()
      if (w) w.textContent = fmt(sprintWords())
    }
    window.addEventListener('rtgs:s', tick)
    x.addEventListener('close', () => window.removeEventListener('rtgs:s', tick))
    x.querySelector('#sp-end')!.addEventListener('click', () => {
      x.close()
      const d = endSprint(false)
      if (d) showResult(d)
    })
    return
  }
  const st = player.state().track ?? BUILTIN[0]
  const x = dlg(`<form method="dialog"><h2>Sprint menulis</h2>
    <p class="sp-sub">Tetapkan waktu dan target kata, lalu menulis tanpa menoleh.</p>
    <div class="field"><label>Durasi</label><div class="chips" id="sp-d">${[15, 25, 45, 60].map((m) => `<button type="button" data-m="${m}" aria-pressed="${m === 25}">${m} menit</button>`).join('')}</div></div>
    <div class="field"><label for="sp-g">Target kata</label><input id="sp-g" type="number" min="20" step="10" value="250"></div>
    <label class="sp-ck"><input type="checkbox" id="sp-s" checked> Putar suasana: ${st.title}</label>
    <div class="dialog-actions"><button class="btn" value="x" type="button" id="sp-c">Batal</button><button class="btn btn-primary" value="go" id="sp-go" type="button">Mulai sprint</button></div></form>`)
  let m = 25
  x.querySelectorAll<HTMLButtonElement>('[data-m]').forEach((b) => b.addEventListener('click', () => {
    m = Number(b.dataset.m)
    x.querySelectorAll('[data-m]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)))
  }))
  x.querySelector('#sp-c')!.addEventListener('click', () => x.close())
  x.querySelector('#sp-go')!.addEventListener('click', () => {
    const g = Math.max(20, Math.round(Number((x.querySelector('#sp-g') as HTMLInputElement).value)) || 250)
    const snd = (x.querySelector('#sp-s') as HTMLInputElement).checked
    x.close()
    void startSprint(m, g, snd)
  })
}
