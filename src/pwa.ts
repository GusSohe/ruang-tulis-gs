// PWA: service worker (jalan offline setelah dibuka sekali lewat https) dan tombol pasang.
interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: InstallEvent | null = null
let swState: 'belum' | 'siap' | 'gagal' | 'tak-didukung' = 'belum'

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const canPromptInstall = () => !!deferred && !isStandalone()
export const offlineState = () => swState

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const ev = deferred
  deferred = null
  await ev.prompt()
  return (await ev.userChoice).outcome === 'accepted'
}

export function initPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallEvent
  })
  window.addEventListener('appinstalled', () => { deferred = null })
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol) || import.meta.env.DEV) {
    swState = 'tak-didukung'
    return
  }
  const reg = () =>
    navigator.serviceWorker.register('./sw.js').then(
      async () => { swState = 'siap'; await navigator.serviceWorker.ready },
      () => { swState = 'gagal' },
    )
  if (document.readyState === 'complete') void reg()
  else window.addEventListener('load', () => void reg(), { once: true })
}
