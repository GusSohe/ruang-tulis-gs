// Kecilkan judul pada dummy buku sampai tiap kata utuh dan seluruh judul muat.
export function fitTitles(root: ParentNode, sel: string, min = 8.5) {
  const run = () =>
    root.querySelectorAll<HTMLElement>(sel).forEach((b) => {
      b.style.fontSize = ''
      let fs = parseFloat(getComputedStyle(b).fontSize)
      const box = b.parentElement!
      let guard = 60
      while (guard-- > 0 && fs > min && (b.scrollWidth > b.clientWidth + 0.5 || b.offsetHeight > box.clientHeight - 16)) {
        fs -= 0.5
        b.style.fontSize = `${fs}px`
      }
    })
  run()
  void document.fonts?.ready.then(run)
}
