# Ruang Tulis GS

Perpustakaan draf tulisan yang belum selesai, dengan Meja (dashboard) dan ruang menulis fokus. Sepenuhnya offline.

## Menjalankan di Windows
```
npm install
npm run dev      # buka alamat yang tertera
npm run build    # hasil: dist/index.html (satu berkas, bisa dibuka tanpa server)
```

## Catatan
- Prototipe v0.1 menyimpan data di IndexedDB peramban. Unduh cadangan (.json) secara berkala.
- Pintasan: Ctrl+K cari di semua karya, Esc tutup panel.
- Tahap berikutnya: adapter penyimpanan berkas (.md per bagian), riwayat versi, ekspor .docx, cangkang desktop.

## Menghubungkan Google Drive (opsional, gratis)

Aplikasi tetap bisa dipakai penuh tanpa ini. Drive hanya menyimpan salinan di folder **Ruang Tulis GS** milikmu. Aplikasi hanya meminta izin `drive.file`, yaitu hanya berkas yang ia buat sendiri.

Sambungan Google tidak berjalan kalau `index.html` dibuka langsung dari folder (`file://`). Buka lewat alamat https, misalnya GitHub Pages (lihat di bawah).

### Membuat Client ID
1. Buka console.cloud.google.com, buat proyek baru (nama bebas, misalnya "Ruang Tulis GS").
2. Menu **APIs & Services > Library**, cari **Google Drive API**, klik **Enable**.
3. Menu **OAuth consent screen** (atau Google Auth Platform): pilih **External**, isi nama aplikasi dan email. Pada **Scopes** tambahkan `.../auth/drive.file`. Selama status Testing, tambahkan emailmu sendiri di **Test users**.
4. Menu **Credentials > Create credentials > OAuth client ID > Web application**. Pada **Authorized JavaScript origins** isi `https://NAMAKAMU.github.io` (tanpa jalur di belakangnya). Untuk uji lokal, tambahkan `http://localhost:5173`.
5. Salin **Client ID** (berakhiran `.apps.googleusercontent.com`) lalu tempel di aplikasi: tombol Cadangan, lalu Pengaturan Drive. Atau isi `VITE_GOOGLE_CLIENT_ID` saat build.

Tidak ada biaya, dan penagihan tidak perlu diaktifkan.

### Cara kerja sinkron
- Saat dibuka dan online, aplikasi memeriksa Drive. Kalau ada pembaruan dari perangkat lain, kamu ditanya apakah mau mengambilnya dulu.
- Penggabungan per butir (karya, bagian, ide). Kalau bagian yang sama diedit di dua perangkat, yang lebih baru jadi utama dan yang lama disimpan sebagai bagian "(salinan konflik)". Tidak ada yang dibuang.
- `terbaru.json` selalu diperbarui, dan satu `cadangan-TANGGAL.json` dibuat per hari (14 terakhir disimpan).
- Berkas audio pribadi dari jendela Suasana tidak ikut dicadangkan.
- Penghapusan satu bagian dalam karya belum disinkronkan antarperangkat (bagian itu bisa muncul lagi); penghapusan karya dan ide sudah.

### Menerbitkan ke GitHub Pages
Di repo: **Settings > Pages > Source: GitHub Actions**. Setiap push ke `main` akan membangun dan menerbitkan lewat `.github/workflows/pages.yml`.
