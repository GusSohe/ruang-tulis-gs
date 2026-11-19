// Mode penyimpanan: 'lokal' (semua di perangkat ini) atau 'drive' (cadangan dan sinkron ke Google Drive pengguna).
export type Mode = 'lokal' | 'drive'
const MKEY = 'rtgs.mode.v1'
const IKEY = 'rtgs.intro.v1'

export const getMode = (): Mode | null => {
  try {
    const v = localStorage.getItem(MKEY)
    return v === 'lokal' || v === 'drive' ? v : null
  } catch {
    return null
  }
}
export const setMode = (m: Mode) => { try { localStorage.setItem(MKEY, m) } catch { /* tidak kritis */ } }
/** Animasi lampu singkat setiap membuka aplikasi. Bawaan menyala; bisa dimatikan. */
export const getIntro = () => { try { return localStorage.getItem(IKEY) !== 'off' } catch { return true } }
export const setIntro = (on: boolean) => { try { localStorage.setItem(IKEY, on ? 'on' : 'off') } catch { /* tidak kritis */ } }
