// Dialog Google Drive dan sinkron otomatis saat aplikasi dibuka dan online.
import type { Ctx } from './ctx'
import { ago } from './model'
import { getMode } from './mode'
import { DriveError, canUseGoogle, fetchRemote, getClientId, getToken, hasLocalChanges, isLinked, lastPush, markLinked, pullAndPush, push, setClientId, unlink } from './drive'

const msg = (e: unknown) => (e instanceof DriveError ? e.message : 'Terjadi kesalahan saat menghubungi Drive.')

/** Satu langkah sinkron: kalau ada pembaruan dari perangkat lain, gabungkan; kalau tidak, unggah. */
export async function syncNow(ctx: Ctx): Promise<string> {
  const r = await fetchRemote()
  if (r?.fresh) {
    const c = await pullAndPush(ctx, r.snap)
    return c ? `Digabung dengan Drive. ${c} salinan konflik disimpan sebagai bagian baru.` : 'Digabung dengan Drive.'
  }
  await push(ctx)
  return 'Tersimpan ke Drive.'
}

export function openDrive(ctx: Ctx, after: () => void) {
  document.querySelector('dialog.drive-dlg')?.remove()
  const d = document.createElement('dialog')
  d.className = 'glass-dlg drive-dlg'
  const linked = isLinked()
  const why = canUseGoogle()
  d.innerHTML = `<form method="dialog"><h2>Google Drive</h2>
    <p class="sp-sub">Tulisanmu tetap di perangkat ini. Drive hanya menyimpan salinan di folder <b>Ruang Tulis GS</b> milikmu, dan aplikasi hanya bisa melihat berkas yang ia buat sendiri.</p>
    <div class="field"><label for="dv-id">Client ID Google</label><input id="dv-id" type="text" autocomplete="off" spellcheck="false" placeholder="xxxx.apps.googleusercontent.com" value="${getClientId()}"><small>Dibuat gratis di Google Cloud Console. Panduannya ada di README.</small></div>
    <p class="bk-last" id="dv-s">${linked ? (lastPush() ? `Terhubung. Terakhir ke Drive ${ago(lastPush())}.` : 'Terhubung.') : why && getClientId() ? why : 'Belum terhubung.'}</p>
    <div class="dialog-actions">${linked
      ? '<button type="button" class="btn" id="dv-u">Putuskan</button><button type="button" class="btn" id="dv-p">Ambil dari Drive</button><button type="button" class="btn btn-primary" id="dv-n">Cadangkan sekarang</button>'
      : '<button type="button" class="btn" id="dv-x">Tutup</button><button type="button" class="btn btn-primary" id="dv-c">Sambungkan Google</button>'}</div></form>`
  document.body.append(d)
  d.addEventListener('close', () => d.remove())
  const st = d.querySelector<HTMLElement>('#dv-s')!
  const busy = (t: string) => { st.textContent = t; st.classList.remove('due') }
  const fail = (e: unknown) => { st.textContent = msg(e); st.classList.add('due') }
  const on = (id: string, fn: () => Promise<void> | void) => d.querySelector(id)?.addEventListener('click', () => void fn())

  on('#dv-x', () => d.close())
  on('#dv-c', async () => {
    try {
      setClientId(d.querySelector<HTMLInputElement>('#dv-id')!.value)
      busy('Menunggu izin Google…')
      await getToken(true)
      markLinked()
      busy('Memeriksa Drive…')
      const r = await fetchRemote()
      if (r && !confirm(`Di Drive sudah ada salinan (${r.snap.works.length} karya, ${r.snap.ideas.length} ide, disimpan ${ago(r.snap.savedAt)}). Gabungkan dengan data di perangkat ini?`)) { unlink(); d.close(); return }
      const out = r ? await pullAndPush(ctx, r.snap) : (await push(ctx), 0)
      ctx.toast(out ? `Terhubung. ${out} salinan konflik disimpan.` : 'Terhubung ke Google Drive')
      d.close(); after(); startDriveAuto(ctx, after)
    } catch (e) { fail(e) }
  })
  on('#dv-n', async () => { try { busy('Menyimpan…'); ctx.toast(await syncNow(ctx)); d.close(); after() } catch (e) { fail(e) } })
  on('#dv-p', async () => {
    try {
      busy('Mengambil…')
      const r = await fetchRemote()
      if (!r) { busy('Belum ada salinan di Drive.'); return }
      const c = await pullAndPush(ctx, r.snap)
      ctx.toast(c ? `Diperbarui. ${c} salinan konflik disimpan.` : 'Diperbarui dari Drive')
      d.close(); after()
    } catch (e) { fail(e) }
  })
  on('#dv-u', () => {
    if (!confirm('Putuskan sambungan? Data di perangkat ini dan salinan di Drive tidak dihapus.')) return
    unlink(); d.close(); ctx.toast('Sambungan Drive diputus'); after()
  })
  d.showModal()
}

function ask(ctx: Ctx, n: number, at: number, go: () => void): void {
  document.querySelector('dialog.drive-ask')?.remove()
  const d = document.createElement('dialog')
  d.className = 'glass-dlg drive-ask'
  d.innerHTML = `<form method="dialog"><h2>Ada pembaruan dari perangkat lain</h2><p class="sp-sub">Salinan di Drive (${n} karya) disimpan ${ago(at)}. Ambil sekarang supaya tulisanmu tidak saling menimpa?</p>
    <div class="dialog-actions"><button type="button" class="btn" id="da-n">Nanti</button><button type="button" class="btn btn-primary" id="da-y">Ambil sekarang</button></div></form>`
  document.body.append(d)
  d.addEventListener('close', () => d.remove())
  d.querySelector('#da-n')!.addEventListener('click', () => d.close())
  d.querySelector('#da-y')!.addEventListener('click', () => { d.close(); go() })
  d.showModal()
}

let timer = 0
/** Saat aplikasi dibuka dan online: tawarkan "update dulu"; sesudah itu simpan perubahan secara berkala. */
export function startDriveAuto(ctx: Ctx, refresh: () => void) {
  if (getMode() !== 'drive' || !isLinked()) return
  let held = false // pengguna memilih "Nanti": jangan menimpa salinan Drive di sesi ini
  const tick = async (first: boolean) => {
    if (held || canUseGoogle()) return
    try {
      await getToken(false)
      const r = await fetchRemote()
      if (r?.fresh) {
        if (!first) return
        ask(ctx, r.snap.works.length, r.snap.savedAt, async () => {
          try {
            const c = await pullAndPush(ctx, r.snap)
            ctx.toast(c ? `Diperbarui dari Drive. ${c} salinan konflik disimpan.` : 'Diperbarui dari Drive')
            refresh()
          } catch (e) { ctx.toast(msg(e)) }
        })
        held = true
        return
      }
      if (hasLocalChanges(ctx) || first) await push(ctx)
    } catch (e) {
      if (first) ctx.toast('Drive belum tersambung. Buka Cadangan untuk menyambung ulang.')
      void e
    }
  }
  void tick(true)
  clearInterval(timer)
  timer = window.setInterval(() => void tick(false), 10 * 60_000)
  window.addEventListener('online', () => void tick(false))
}
