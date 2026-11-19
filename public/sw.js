/* Ruang Tulis GS — service worker. Versi build disisipkan saat build. */
const VERSION = '__BUILD__'
const CACHE = 'rtgs-' + VERSION
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('rtgs-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

// Halaman: jaringan dulu (supaya pembaruan cepat sampai), 4 detik, lalu cadangan dari cache.
async function page(req) {
  const c = await caches.open(CACHE)
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 4000)
  try {
    const r = await fetch(req.url, { signal: ctl.signal, cache: 'no-cache' })
    clearTimeout(t)
    if (r.ok) c.put('./index.html', r.clone())
    return r
  } catch {
    clearTimeout(t)
    return (await c.match('./index.html')) || (await c.match('./')) || Response.error()
  }
}

// Berkas statis: cache dulu, isi ulang dari jaringan bila belum ada.
async function asset(req) {
  const c = await caches.open(CACHE)
  const hit = await c.match(req)
  if (hit) return hit
  const r = await fetch(req)
  if (r.ok) c.put(req, r.clone())
  return r
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Google API dan lainnya lewat langsung
  if (req.mode === 'navigate') e.respondWith(page(req))
  else e.respondWith(asset(req).catch(() => Response.error()))
})
