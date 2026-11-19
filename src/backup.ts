// Cadangan: unduh dan pulihkan seluruh isi (karya, catatan harian, ide, sprint) dalam satu berkas.
import type { Ctx } from './ctx'
import { downloadBackup, parseBackup } from './store'
import { getCut, getHours, getLog, getTime, setExtra, setHours, setLog } from './log'
import { getIdeas, setIdeas } from './ideas'
import { getSprints, setSprints } from './sprint'
import { ago } from './model'
import { getTombs, setTombs } from './tomb'
import { getIntro, getMode, setIntro } from './mode'
import { openWelcome } from './welcome'
import { openDrive } from './driveui'
import { isLinked } from './drive'
import { canPromptInstall, isIOS, isStandalone, offlineState, promptInstall } from './pwa'

export const lastBackup = () => {
  const v = Number(localStorage.getItem('rtgs.backup.at'))
  return v > 0 ? v : 0
}
/** Perlu diingatkan: ada karya, dan belum pernah dicadangkan atau sudah lebih dari 7 hari. */
export const backupDue = (ctx: Ctx) => ctx.works.length > 0 && Date.now() - lastBackup() > 7 * 864e5

export function exportBackup(ctx: Ctx) {
  downloadBackup(ctx.works, getLog(), getIdeas(), { time: getTime(), cut: getCut(), hours: getHours(), sprints: getSprints(), tombs: getTombs() })
  ctx.toast('Cadangan diunduh')
}

export async function importBackup(ctx: Ctx, f: File): Promise<boolean> {
  try {
    const text = await f.text()
    const ws = parseBackup(text)
    if (ctx.works.length && !confirm(`Ini akan mengganti ${ctx.works.length} karya yang ada dengan ${ws.length} karya dari cadangan. Lanjutkan?`)) return false
    await ctx.replaceAll(ws)
    const raw = JSON.parse(text)
    if (raw.log && typeof raw.log === 'object') setLog(raw.log)
    setExtra(raw.time && typeof raw.time === 'object' ? raw.time : undefined, raw.cut && typeof raw.cut === 'object' ? raw.cut : undefined)
    setHours(raw.hours && typeof raw.hours === 'object' ? raw.hours : undefined)
    setSprints(raw.sprints)
    setTombs(raw.tombs)
    if (Array.isArray(raw.ideas)) setIdeas(raw.ideas)
    ctx.toast(`${ws.length} karya dipulihkan`)
    return true
  } catch (err) {
    ctx.toast(err instanceof Error ? err.message : 'Cadangan tidak bisa dibaca')
    return false
  }
}

function pwaRow(): string {
  if (isStandalone()) return '<p class="bk-pwa">Terpasang sebagai aplikasi. Bisa dibuka tanpa internet.</p>'
  if (canPromptInstall()) return '<p class="bk-pwa">Pasang sebagai aplikasi supaya bisa dibuka tanpa internet. <button type="button" class="btn-text" id="bk-p">Pasang aplikasi</button></p>'
  if (isIOS()) return '<p class="bk-pwa">Di iPhone/iPad: ketuk Bagikan, lalu “Tambahkan ke Layar Utama” agar bisa dibuka tanpa internet.</p>'
  if (offlineState() === 'siap') return '<p class="bk-pwa">Sudah tersimpan untuk dibuka tanpa internet. Untuk ikon di layar utama, pakai menu peramban: “Instal aplikasi” atau “Tambahkan ke layar utama”.</p>'
  return ''
}

export function openBackup(ctx: Ctx, after: () => void) {
  document.querySelector('dialog.backup-dlg')?.remove()
  const lb = lastBackup()
  const d = document.createElement('dialog')
  d.className = 'glass-dlg backup-dlg'
  d.innerHTML = `<form method="dialog"><h2>Cadangan</h2>
    <p class="sp-sub">Semua tersimpan di peramban ini, tanpa server. Jika data peramban terhapus, karya ikut hilang. Berkas cadangan menyelamatkannya.</p>
    <p class="bk-last${backupDue(ctx) ? ' due' : ''}">${lb ? `Terakhir dicadangkan ${ago(lb)}.` : 'Belum pernah dicadangkan.'}</p>
    <p class="bk-mode">Mode: <b>${getMode() === 'drive' ? (isLinked() ? 'Google Drive, terhubung' : 'Google Drive, belum terhubung') : 'Di perangkat ini saja'}</b> <button type="button" class="btn-text" id="bk-m">Ganti</button>${getMode() === 'drive' ? ' <button type="button" class="btn-text" id="bk-g">Pengaturan Drive</button>' : ''}</p>
    ${pwaRow()}
    <label class="sp-ck"><input type="checkbox" id="bk-i" ${getIntro() ? 'checked' : ''}> Animasi lampu saat membuka aplikasi</label>
    <div class="dialog-actions"><button type="button" class="btn" id="bk-r">Pulihkan dari berkas</button><button type="button" class="btn btn-primary" id="bk-d">Unduh cadangan</button></div>
    <input type="file" accept="application/json,.json" hidden id="bk-f"><p class="bk-cr">Ruang Tulis GS · © 2026 Gus Sohe. Hak cipta dilindungi.</p></form>`
  document.body.append(d)
  d.addEventListener('close', () => d.remove())
  d.querySelector('#bk-d')!.addEventListener('click', () => {
    exportBackup(ctx)
    d.close()
    after()
  })
  d.querySelector<HTMLInputElement>('#bk-i')!.addEventListener('change', (e) => setIntro((e.target as HTMLInputElement).checked))
  d.querySelector('#bk-p')?.addEventListener('click', async () => { if (await promptInstall()) { d.close(); ctx.toast('Aplikasi terpasang') } })
  d.querySelector('#bk-g')?.addEventListener('click', () => { d.close(); openDrive(ctx, after) })
  d.querySelector('#bk-m')!.addEventListener('click', () => {
    d.close()
    openWelcome({ first: true, done: () => { after(); if (getMode() === 'drive') openDrive(ctx, after) } })
  })
  const f = d.querySelector<HTMLInputElement>('#bk-f')!
  d.querySelector('#bk-r')!.addEventListener('click', () => f.click())
  f.addEventListener('change', async () => {
    if (f.files?.[0] && (await importBackup(ctx, f.files[0]))) {
      d.close()
      after()
    }
  })
  d.showModal()
}
