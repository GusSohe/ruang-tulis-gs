// Meja perpustakaan abstrak: tiap karya = satu lembar kertas bergaris di atas meja kayu. Digambar dari kode.
export interface Plot {
  id: string
  weight: number
  stage: string
  progress: number
  asleep: boolean
}
export interface Rect { x: number; y: number; w: number; h: number }
type Pt = [number, number]

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function partition<T extends { weight: number }>(r: Rect, items: T[]): { rect: Rect; item: T }[] {
  if (items.length === 1) return [{ rect: r, item: items[0] }]
  const total = items.reduce((n, i) => n + i.weight, 0)
  let acc = 0
  let k = 1
  let best = Infinity
  for (let i = 1; i < items.length; i++) {
    acc += items[i - 1].weight
    const d = Math.abs(acc - total / 2)
    if (d < best) { best = d; k = i }
  }
  const a = items.slice(0, k)
  const b = items.slice(k)
  const wa = a.reduce((n, i) => n + i.weight, 0) / total
  if (r.w >= r.h) {
    const aw = r.w * wa
    return [...partition({ x: r.x, y: r.y, w: aw, h: r.h }, a), ...partition({ x: r.x + aw, y: r.y, w: r.w - aw, h: r.h }, b)]
  }
  const ah = r.h * wa
  return [...partition({ x: r.x, y: r.y, w: r.w, h: ah }, a), ...partition({ x: r.x, y: r.y + ah, w: r.w, h: r.h - ah }, b)]
}

type R = () => number
const f1 = (n: number) => n.toFixed(1)

function wood(W: number, H: number): string {
  const rand = rng(77)
  let g = `<rect class="wood" width="${W}" height="${H}"/>`
  const plank = Math.max(120, Math.round(H / 6))
  for (let y = plank; y < H; y += plank) g += `<line class="seam" x1="0" x2="${W}" y1="${y}" y2="${y}"/>`
  for (let i = 0; i < 46; i++) {
    const y = rand() * H, d = (rand() - 0.5) * 26
    g += `<path class="grain${i % 3 === 0 ? ' dk' : ''}" d="M-10 ${f1(y)} C ${f1(W * 0.3)} ${f1(y + d)}, ${f1(W * 0.62)} ${f1(y - d)}, ${W + 10} ${f1(y + d / 2)}" stroke-width="${f1(0.6 + rand() * 1.6)}"/>`
  }
  return g
}

function book(x: number, y: number, rand: R): string {
  const colors = ['#6b2d2d', '#2d4a5a', '#5a4a2a', '#3b5a45', '#5a3b5a', '#7a5a2d', '#2b3a5e']
  const w = 70 + rand() * 60, h = 42 + rand() * 30, ang = (rand() - 0.5) * 50
  const c = colors[Math.floor(rand() * colors.length)]
  let out = `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(ang)})"><rect class="shd" x="3" y="5" width="${f1(w)}" height="${f1(h)}" rx="3"/><rect x="0" y="0" width="${f1(w)}" height="${f1(h)}" rx="3" fill="${c}"/><rect x="${f1(w - 5)}" y="2" width="4" height="${f1(h - 4)}" fill="#e8dfc8"/><rect x="0" y="0" width="${f1(w * 0.14)}" height="${f1(h)}" rx="3" fill="rgba(0,0,0,.28)"/><rect x="${f1(w * 0.3)}" y="${f1(h * 0.28)}" width="${f1(w * 0.42)}" height="${f1(h * 0.2)}" fill="rgba(255,235,190,.45)"/><rect x="${f1(w * 0.3)}" y="${f1(h * 0.58)}" width="${f1(w * 0.28)}" height="2" fill="rgba(255,235,190,.35)"/></g>`
  if (rand() < 0.35) out += book(x + 6, y - 9, rand)
  return out
}
function pencil(x: number, y: number, rand: R): string {
  const L = 110 + rand() * 40, ang = rand() * 180
  return `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(ang)})"><rect class="shd" x="2" y="3" width="${f1(L)}" height="7" rx="2"/><rect x="0" y="0" width="${f1(L)}" height="7" rx="2" fill="#d9a441"/><rect x="0" y="0" width="12" height="7" rx="2" fill="#b9b9b0"/><polygon points="${f1(L)},0 ${f1(L + 14)},3.5 ${f1(L)},7" fill="#e6c79a"/><polygon points="${f1(L + 9)},1.8 ${f1(L + 14)},3.5 ${f1(L + 9)},5.2" fill="#3b3b3b"/></g>`
}
function cup(x: number, y: number): string {
  return `<g transform="translate(${f1(x)} ${f1(y)})"><circle class="shd" cx="3" cy="5" r="32"/><circle r="32" fill="#d9d4c6"/><circle r="22" fill="#f1ecdf"/><circle r="16" fill="#3a2416"/><circle r="16" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="2"/><rect x="21" y="-5" width="16" height="10" rx="5" fill="#f1ecdf"/></g>`
}
function note(x: number, y: number, rand: R): string {
  const cs = ['#f2d97a', '#f0b9a0', '#b8d6c0', '#bcd0ea'], s = 48 + rand() * 24, ang = (rand() - 0.5) * 40
  return `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(ang)})"><rect class="shd" x="2" y="4" width="${f1(s)}" height="${f1(s)}"/><rect width="${f1(s)}" height="${f1(s)}" fill="${cs[Math.floor(rand() * cs.length)]}"/><rect x="8" y="${f1(s * 0.3)}" width="${f1(s * 0.6)}" height="2" fill="rgba(30,30,60,.5)"/><rect x="8" y="${f1(s * 0.5)}" width="${f1(s * 0.42)}" height="2" fill="rgba(30,30,60,.5)"/></g>`
}

function objects(r: Rect, seed: string, max = 6): string {
  if (r.w < 60 || r.h < 40) return ''
  const rand = rng(hash(seed))
  const n = Math.max(1, Math.min(max, Math.round((r.w * r.h) / 38000)))
  let out = ''
  for (let i = 0; i < n; i++) {
    const x = r.x + 40 + rand() * Math.max(1, r.w - 120), y = r.y + 30 + rand() * Math.max(1, r.h - 80)
    const t = rand()
    out += t < 0.42 ? book(x, y, rand) : t < 0.62 ? pencil(x, y, rand) : t < 0.8 ? cup(x, y) : note(x, y, rand)
  }
  return out
}

export interface MapOut {
  svg: string
  centers: { id: string; x: number; y: number; w: number }[]
}

function sheet(uid: number, cell: Rect, p: Plot, order: number, intro: boolean): string {
  const rand = rng(hash(p.id))
  const layers = 1 + Math.min(5, Math.floor(p.progress * 6))
  const step = 2.4
  const m = 16
  const sx = cell.x + m, sy = cell.y + m + 8
  const sw = Math.max(70, cell.w - 2 * m - layers * step), sh = Math.max(60, cell.h - 2 * m - 8 - layers * step)
  const ang = (rand() - 0.5) * 4.4
  const cx = cell.x + cell.w / 2, cy = cell.y + cell.h / 2

  let g = `<g class="plot" data-plot="${p.id}" data-stage="${p.stage}"${p.asleep ? ' data-asleep="1"' : ''} transform="rotate(${f1(ang)} ${f1(cx)} ${f1(cy)})">`
  g += `<rect class="shd soft" x="${f1(sx + 4)}" y="${f1(sy + 8)}" width="${f1(sw + layers * step)}" height="${f1(sh + layers * step)}" rx="3" filter="url(#sh)"/>`
  for (let i = layers - 1; i >= 1; i--) g += `<rect class="paper under" x="${f1(sx + i * step)}" y="${f1(sy + i * step)}" width="${f1(sw)}" height="${f1(sh)}" rx="2"/>`
  g += `<rect class="paper top" x="${f1(sx)}" y="${f1(sy)}" width="${f1(sw)}" height="${f1(sh)}" rx="2"/>`

  const lh = Math.max(13, Math.min(19, Math.round(sh / 22)))
  const n = Math.max(2, Math.floor((sh - 26) / lh))
  const y0 = sy + 24
  const mx = sx + Math.min(36, sw * 0.12)
  g += `<line class="margin" x1="${f1(mx)}" x2="${f1(mx)}" y1="${f1(sy + 2)}" y2="${f1(sy + sh - 2)}"/>`
  let rules = '', ink = ''
  const inked = p.progress > 0 ? Math.max(0.4, p.progress * n) : 0
  const x1 = mx + 8, xmax = sx + sw - 12
  for (let i = 0; i < n; i++) {
    const y = y0 + i * lh
    rules += `M${f1(sx + 6)} ${f1(y)}H${f1(sx + sw - 6)}`
    const fill = Math.min(1, inked - i)
    if (fill <= 0) continue
    const short = rand() < 0.14
    const target = x1 + (xmax - x1) * (short ? 0.3 : 0.78 + rand() * 0.22) * (fill < 1 ? Math.max(0.25, fill) : 1)
    let x = x1
    let d = `M${f1(x)} ${f1(y - 3)}`
    while (x < target) {
      const dash = Math.min(target - x, 4 + rand() * 24)
      d += `h${f1(dash)}`
      x += dash
      const gap = 5
      if (x + gap >= target) break
      d += `m${gap} 0`
      x += gap
    }
    ink += `<path d="${d}"/>`
  }
  g += `<path class="rules" d="${rules}"/>`
  if (ink) {
    const clip = intro
      ? `<clipPath id="rv${uid}"><rect class="reveal" x="${f1(sx)}" y="${f1(sy)}" width="${f1(sw)}" height="${f1(sh)}" style="--dl:${order * 120 + 200}ms"/></clipPath>`
      : ''
    g += `${clip}<g class="ink"${intro ? ` clip-path="url(#rv${uid})"` : ''}>${ink}</g>`
  }
  g += `<rect class="tab" x="${f1(sx + 18)}" y="${f1(sy - 9)}" width="52" height="13" rx="3"/>`
  if (p.asleep) g += `<rect class="veil" x="${f1(sx)}" y="${f1(sy - 9)}" width="${f1(sw + layers * step)}" height="${f1(sh + layers * step + 9)}" rx="3"/>`
  g += `</g>`
  return g
}

export function drawMap(W: number, H: number, region: Rect, plots: Plot[], intro: boolean): MapOut {
  const centers: MapOut['centers'] = []
  let body = `<defs><filter id="sh" x="-10%" y="-10%" width="125%" height="130%"><feGaussianBlur stdDeviation="5"/></filter><radialGradient id="lamp" cx="30%" cy="22%" r="75%"><stop offset="0" style="stop-color:var(--lamp)" stop-opacity="0.34"/><stop offset="1" style="stop-color:var(--lamp)" stop-opacity="0"/></radialGradient><radialGradient id="vig" cx="50%" cy="50%" r="75%"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.38"/></radialGradient></defs>`
  body += wood(W, H)

  const outside: Rect[] = [
    { x: 0, y: 0, w: W, h: region.y },
    { x: 0, y: region.y + region.h, w: W, h: H - region.y - region.h },
    { x: 0, y: region.y, w: region.x, h: region.h },
    { x: region.x + region.w, y: region.y, w: W - region.x - region.w, h: region.h },
  ]
  outside.forEach((o, i) => (body += objects(o, `o${i}`, i === 0 || i === 2 ? 3 : 1)))

  if (!plots.length) body += objects(region, 'kosong')
  else {
    const sorted = [...plots].sort((a, b) => b.weight - a.weight)
    partition(region, sorted).forEach(({ rect, item }, order) => {
      body += sheet(order, rect, item, order, intro)
      centers.push({ id: item.id, w: rect.w, x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 })
    })
  }
  body += `<rect width="${W}" height="${H}" fill="url(#lamp)" pointer-events="none"/><rect width="${W}" height="${H}" fill="url(#vig)" pointer-events="none"/>`
  return { svg: body, centers }
}
