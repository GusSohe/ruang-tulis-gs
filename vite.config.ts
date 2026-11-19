import { defineConfig, type Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// Menyisipkan cap versi (hash isi index.html) ke sw.js, supaya setiap build baru
// otomatis dianggap pembaruan oleh browser.
function swStamp(): Plugin {
  let out = 'dist'
  return {
    name: 'rtgs-sw-stamp',
    apply: 'build',
    configResolved(c) { out = c.build.outDir },
    closeBundle() {
      const html = join(out, 'index.html'), sw = join(out, 'sw.js')
      if (!existsSync(html) || !existsSync(sw)) return
      const h = createHash('sha1').update(readFileSync(html)).digest('hex').slice(0, 10)
      writeFileSync(sw, readFileSync(sw, 'utf8').replace('__BUILD__', h))
    },
  }
}

// Satu berkas HTML hasil build: bisa dibuka langsung dari folder, tanpa server.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile(), swStamp()],
  build: { target: 'es2022', assetsInlineLimit: 100_000_000 },
})
