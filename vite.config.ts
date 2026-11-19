import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Satu berkas HTML hasil build: bisa dibuka langsung dari folder, tanpa server.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { target: 'es2022', assetsInlineLimit: 100_000_000 },
})
