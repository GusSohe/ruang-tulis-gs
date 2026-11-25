// Mulai dari nol: hapus semua karya, ide, catatan harian, sprint, dan (bila dipilih) salinan di Google Drive.
// Pengaturan tampilan, suara, dan mode penyimpanan dibiarkan.
import type { Ctx } from './ctx'
import { DriveError, getToken, isLinked, trashDriveFolder, unlink } from './drive'

const KEEP = ['rtgs.prefs.v1', 'rtgs.mode.v1', 'rtgs.intro.v1', 'rtgs.audio.v1', 'rtgs.device', 'rtgs.gcid']
const WORD = 'HAPUS'

/** Hapus semua kunci data aplikasi di localStorage, kecuali pengaturan. */
export function wipeLocal() {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('rtgs.') && !KEEP.includes(k) && !k.startsWith('rtgs.sort.')) keys.push(k)
    }
    keys.forEach((k) => localStorage.removeItem(k))
  } catch { /* tidak kritis */ }
}

export function openReset(ctx: Ctx) {
  document.querySelector('dialog.reset-dlg')?.remove()
  const linked = isLinked()
  const d = document.createElement('dialog')
  d.className = 'glass-dlg reset-dlg'
  d.innerHTML = `<form method="dialog"><h2>Hapus semua data</h2>
    <p class="sp-sub">Semua karya (${ctx.works.length}), ide, catatan harian, dan riwayat menulis di perangkat ini akan dihapus. Ini tidak bisa dibatalkan. Kalau ada yang ingin disimpan, tutup dialog ini dan unduh cadangan dulu.</p>
    ${linked ? '<label class="sp-ck"><input type="checkbox" id="rs-d" checked> Pindahkan juga folder “Ruang Tulis GS” di Google Drive ke Tempat Sampah</label><p class="dv-note">Kalau tidak dicentang, salinan di Drive akan kembali masuk saat kamu menyambungkan Drive lagi.</p>' : ''}
    <div class="field"><label for="rs-w">Ketik ${WORD} untuk melanjutkan</label><input id="rs-w" type="text" autocomplete="off" spellcheck="false"></div>
    <p class="bk-last" id="rs-s"></p>
    <div class="dialog-actions"><button type="button" class="btn" id="rs-x">Batal</button><button type="button" class="btn danger" id="rs-g" disabled>Hapus semua</button></div></form>`
  document.body.append(d)
  d.addEventListener('close', () => d.remove())
  const w = d.querySelector<HTMLInputElement>('#rs-w')!
  const go = d.querySelector<HTMLButtonElement>('#rs-g')!
  const st = d.querySelector<HTMLElement>('#rs-s')!
  w.addEventListener('input', () => { go.disabled = w.value.trim().toUpperCase() !== WORD })
  d.querySelector('#rs-x')!.addEventListener('click', () => d.close())
  go.addEventListener('click', async () => {
    if (w.value.trim().toUpperCase() !== WORD) return
    go.disabled = true
    st.classList.remove('due')
    try {
      // Drive dulu: bila gagal, tidak ada yang terhapus di perangkat, jadi bisa dicoba lagi.
      if (linked && d.querySelector<HTMLInputElement>('#rs-d')?.checked) {
        st.textContent = 'Memindahkan folder Drive ke Tempat Sampah…'
        await getToken(true)
        await trashDriveFolder()
      }
      st.textContent = 'Menghapus data di perangkat ini…'
      await ctx.replaceAll([])
      unlink()
      wipeLocal()
      location.reload()
    } catch (e) {
      st.textContent = e instanceof DriveError ? e.message + ' Tidak ada data yang dihapus.' : 'Gagal menghapus. Coba lagi.'
      st.classList.add('due')
      go.disabled = false
    }
  })
  d.showModal()
  w.focus()
}
