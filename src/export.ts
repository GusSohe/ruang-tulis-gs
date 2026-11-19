// Ekspor naskah: Markdown, teks polos, Word (.docx), dan PDF (lewat cetak peramban).
import { AlignmentType, Document, HeadingLevel, Packer, PageBreak, Paragraph, TextRun } from 'docx'
import type { Ctx } from './ctx'
import { PAPERS, authorOf, escapeHtml, plain, type PaperId, type Work } from './model'

interface Run { t: string; b?: boolean; i?: boolean }
type Block =
  | { k: 'h2'; runs: Run[] }
  | { k: 'h3'; runs: Run[] }
  | { k: 'p'; runs: Run[] }
  | { k: 'quote'; runs: Run[] }
  | { k: 'hr' }
  | { k: 'ul'; items: Run[][] }
  | { k: 'ol'; items: Run[][] }

function inline(src: string): Run[] {
  const s = src.replace(/\\([\\`*_{}[\]()#+\-.!>~])/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/`/g, '')
  const out: Run[] = []
  const re = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ t: s.slice(last, m.index) })
    if (m[1]) out.push(...inline(m[2]).map((r) => ({ ...r, b: true })))
    else out.push(...inline(m[4]).map((r) => ({ ...r, i: true })))
    last = m.index + m[0].length
  }
  if (last < s.length) out.push({ t: s.slice(last) })
  return out
}

export function parseMd(md: string): Block[] {
  const blocks: Block[] = []
  for (const chunk of md.replace(/\r/g, '').split(/\n{2,}/)) {
    const c = chunk.trim()
    if (!c) continue
    if (/^(?:---+|\*\*\*+|___+)$/.test(c)) blocks.push({ k: 'hr' })
    else if (/^#{1,2}\s/.test(c)) blocks.push({ k: 'h2', runs: inline(c.replace(/^#+\s+/, '')) })
    else if (/^#{3,6}\s/.test(c)) blocks.push({ k: 'h3', runs: inline(c.replace(/^#+\s+/, '')) })
    else if (/^>/.test(c)) blocks.push({ k: 'quote', runs: inline(c.replace(/^>\s?/gm, '').replace(/\n/g, ' ')) })
    else if (/^[-*+]\s/.test(c)) blocks.push({ k: 'ul', items: c.split(/\n/).map((l) => inline(l.replace(/^[-*+]\s+/, ''))) })
    else if (/^\d+[.)]\s/.test(c)) blocks.push({ k: 'ol', items: c.split(/\n/).map((l) => inline(l.replace(/^\d+[.)]\s+/, ''))) })
    else blocks.push({ k: 'p', runs: inline(c.replace(/\n/g, ' ')) })
  }
  return blocks
}

const slug = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'naskah'
const showPartTitles = (w: Work) => w.parts.length > 1

export function toMarkdown(w: Work, titlePage: boolean): string {
  let out = titlePage ? `# ${w.title}\n\n${w.subtitle ? `*${w.subtitle}*\n\n` : ''}**${authorOf(w)}**\n\n---\n\n` : ''
  out += w.parts.map((p) => `${showPartTitles(w) ? `## ${p.title}\n\n` : ''}${p.md.trim()}`).join('\n\n---\n\n')
  return out + '\n'
}

export function toPlain(w: Work, titlePage: boolean): string {
  let out = titlePage ? `${w.title}\n${w.subtitle ? w.subtitle + '\n' : ''}${authorOf(w)}\n\n\n` : ''
  out += w.parts.map((p) => `${showPartTitles(w) ? p.title.toUpperCase() + '\n\n' : ''}${plain(p.md)}`).join('\n\n\n')
  return out + '\n'
}

function runsHtml(rs: Run[]) {
  return rs.map((r) => { let h = escapeHtml(r.t); if (r.b) h = `<strong>${h}</strong>`; if (r.i) h = `<em>${h}</em>`; return h }).join('')
}

function toHtml(w: Work, titlePage: boolean): string {
  const body = w.parts.map((p) => {
    const bl = parseMd(p.md).map((b) => {
      if (b.k === 'hr') return '<p class="hr">*&emsp;*&emsp;*</p>'
      if (b.k === 'ul' || b.k === 'ol') return `<${b.k}>${b.items.map((i) => `<li>${runsHtml(i)}</li>`).join('')}</${b.k}>`
      return `<${b.k === 'quote' ? 'blockquote' : b.k === 'h2' ? 'h3' : b.k === 'h3' ? 'h4' : 'p'}>${runsHtml(b.runs)}</${b.k === 'quote' ? 'blockquote' : b.k === 'h2' ? 'h3' : b.k === 'h3' ? 'h4' : 'p'}>`
    }).join('')
    return `<section class="ch">${showPartTitles(w) ? `<h2>${escapeHtml(p.title)}</h2>` : ''}${bl}</section>`
  }).join('')
  const tp = titlePage ? `<section class="tp"><h1>${escapeHtml(w.title)}</h1>${w.subtitle ? `<p class="st">${escapeHtml(w.subtitle)}</p>` : ''}<p class="au">${escapeHtml(authorOf(w))}</p></section>` : ''
  return tp + body
}

function save(name: string, blob: Blob) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 3000)
}

const twips = (mm: number) => Math.round(mm * 56.6929)

async function toDocx(w: Work, paper: PaperId, titlePage: boolean, indent: boolean): Promise<Blob> {
  const pp = PAPERS.find((p) => p.id === paper && p.w) ?? PAPERS.find((p) => p.id === 'a4')!
  const FONT = 'Times New Roman'
  const rr = (rs: Run[], extra: { size?: number; italics?: boolean } = {}) => rs.map((r) => new TextRun({ text: r.t, bold: r.b, italics: r.i || extra.italics, font: FONT, size: extra.size }))
  const kids: Paragraph[] = []
  if (titlePage) {
    kids.push(new Paragraph({ spacing: { before: 3600 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: w.title, bold: true, size: 56, font: FONT })] }))
    if (w.subtitle) kids.push(new Paragraph({ spacing: { before: 240 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: w.subtitle, italics: true, size: 30, font: FONT })] }))
    kids.push(new Paragraph({ spacing: { before: 1200 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: authorOf(w), size: 28, font: FONT })] }))
    kids.push(new Paragraph({ children: [new PageBreak()] }))
  }
  w.parts.forEach((part, pi) => {
    if (showPartTitles(w)) kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: pi > 0, spacing: { after: 360 }, children: [new TextRun({ text: part.title, bold: true, size: 32, font: FONT })] }))
    let first = true
    for (const b of parseMd(part.md)) {
      if (b.k === 'hr') { kids.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 240, after: 240 }, children: [new TextRun({ text: '*     *     *', font: FONT })] })); first = true }
      else if (b.k === 'h2' || b.k === 'h3') { kids.push(new Paragraph({ heading: b.k === 'h2' ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3, spacing: { before: 360, after: 160 }, children: rr(b.runs.map((r) => ({ ...r, b: true })), { size: b.k === 'h2' ? 28 : 26 }) })); first = true }
      else if (b.k === 'quote') { kids.push(new Paragraph({ indent: { left: 720, right: 720 }, spacing: { before: 120, after: 120, line: 300 }, children: rr(b.runs, { italics: true }) })); first = true }
      else if (b.k === 'ul') b.items.forEach((it) => kids.push(new Paragraph({ bullet: { level: 0 }, spacing: { line: 300 }, children: rr(it) })))
      else if (b.k === 'ol') b.items.forEach((it, n) => kids.push(new Paragraph({ indent: { left: 540, hanging: 360 }, spacing: { line: 300 }, children: [new TextRun({ text: `${n + 1}.  `, font: FONT }), ...rr(it)] })))
      else { kids.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: indent && !first ? { firstLine: 567 } : undefined, spacing: { line: 360, after: indent ? 0 : 160 }, children: rr(b.runs) })); first = false }
    }
  })
  const doc = new Document({
    creator: authorOf(w),
    title: w.title,
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: [{ properties: { page: { size: { width: twips(pp.w), height: twips(pp.h) }, margin: { top: 1418, bottom: 1418, left: 1418, right: 1418 } } }, children: kids }],
  })
  return Packer.toBlob(doc)
}

function printPdf(w: Work, paper: PaperId, titlePage: boolean) {
  const pp = PAPERS.find((p) => p.id === paper && p.w) ?? PAPERS.find((p) => p.id === 'a4')!
  document.getElementById('print-root')?.remove()
  document.getElementById('print-page')?.remove()
  const style = document.createElement('style')
  style.id = 'print-page'
  style.textContent = `@page { size: ${pp.w}mm ${pp.h}mm; margin: 20mm 18mm; }`
  const root = document.createElement('div')
  root.id = 'print-root'
  root.innerHTML = toHtml(w, titlePage)
  document.head.append(style)
  document.body.append(root)
  const prevTitle = document.title
  document.title = slug(w.title)
  const done = () => {
    root.remove()
    style.remove()
    document.title = prevTitle
    window.removeEventListener('afterprint', done)
  }
  window.addEventListener('afterprint', done)
  setTimeout(() => window.print(), 60)
}

export function openExport(ctx: Ctx, w: Work) {
  const dlg = document.createElement('dialog')
  const cur = ctx.prefs.paper !== 'bebas' ? ctx.prefs.paper : 'a4'
  dlg.innerHTML = `<form method="dialog">
    <h2>Ekspor “${escapeHtml(w.title)}”</h2>
    <div class="field"><label for="xf">Format</label><select id="xf">
      <option value="docx">Word (.docx), siap disunting dan dikirim ke penerbit</option>
      <option value="pdf">PDF, lewat dialog cetak peramban</option>
      <option value="md">Markdown (.md), cadangan terbuka</option>
      <option value="txt">Teks polos (.txt)</option>
    </select></div>
    <div class="field" id="xp"><label for="xz">Ukuran halaman</label><select id="xz">${PAPERS.filter((p) => p.w).map((p) => `<option value="${p.id}"${p.id === cur ? ' selected' : ''}>${p.label}</option>`).join('')}</select></div>
    <label class="toggle"><span>Sertakan halaman judul</span><input type="checkbox" id="xt" checked></label>
    <p class="muted" id="xh" style="font-size:13px;margin:6px 0 0"></p>
    <div class="dialog-actions"><button class="btn" value="batal" formnovalidate>Batal</button><button class="btn btn-primary" value="ok">Ekspor</button></div>
  </form>`
  document.body.append(dlg)
  const q = <T extends Element>(s: string) => dlg.querySelector<T>(s)!
  const fmtSel = q<HTMLSelectElement>('#xf')
  const sync = () => {
    const f = fmtSel.value
    q<HTMLElement>('#xp').hidden = f === 'md' || f === 'txt'
    q<HTMLElement>('#xh').textContent = f === 'pdf' ? 'Di dialog cetak, pilih “Simpan sebagai PDF” dan atur margin ke Default.' : f === 'docx' ? 'Cetak miring dan tebal ikut terbawa. Gambar belum didukung.' : ''
  }
  fmtSel.addEventListener('change', sync)
  sync()
  dlg.addEventListener('close', async () => {
    const ok = dlg.returnValue === 'ok'
    const f = fmtSel.value
    const paper = q<HTMLSelectElement>('#xz').value as PaperId
    const tp = q<HTMLInputElement>('#xt').checked
    dlg.remove()
    if (!ok) return
    try {
      if (f === 'md') save(`${slug(w.title)}.md`, new Blob([toMarkdown(w, tp)], { type: 'text/markdown;charset=utf-8' }))
      else if (f === 'txt') save(`${slug(w.title)}.txt`, new Blob([toPlain(w, tp)], { type: 'text/plain;charset=utf-8' }))
      else if (f === 'docx') save(`${slug(w.title)}.docx`, await toDocx(w, paper, tp, ctx.prefs.indent))
      else printPdf(w, paper, tp)
      ctx.toast(f === 'pdf' ? 'Membuka dialog cetak' : 'Diekspor')
    } catch (e) {
      ctx.toast(e instanceof Error ? `Ekspor gagal: ${e.message}` : 'Ekspor gagal')
    }
  })
  dlg.showModal()
}
