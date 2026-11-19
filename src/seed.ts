// Data contoh fiktif untuk mencoba tampilan. Semua judul diawali "Contoh:" supaya mudah dihapus.
import { countWords, lastSentence, newPart, plain, uid, type Work, type KindId, type StageId } from './model'

const SENTENCES = [
  'Hujan turun pelan sejak subuh, dan jalan di depan rumah berubah menjadi cermin yang retak.',
  'Aku menulis bukan karena yakin, melainkan karena diam terasa lebih berat.',
  'Setiap jawaban yang kusimpan ternyata hanya menunda pertanyaan berikutnya.',
  'Ayah selalu bilang bahwa kata-kata yang jujur tidak perlu dihias.',
  'Di ujung gang itu ada warung yang buka sampai larut dan menyimpan separuh cerita kota.',
  'Kita sering menyebut kebiasaan sebagai keyakinan, padahal keduanya jarang bertemu.',
  'Lampu jalan berkedip dua kali, lalu padam, seolah ikut menimbang kalimat yang baru saja kuucapkan.',
  'Ada saat ketika menyunting berarti berani membuang kalimat yang paling kausayangi.',
  'Pertanyaan itu tidak meminta jawaban cepat; ia meminta ruang untuk tinggal.',
  'Dari jendela kereta, sawah tampak seperti halaman yang belum selesai ditulis.',
  'Ia menutup buku, menarik napas, dan memutuskan untuk memulai dari kalimat yang paling sederhana.',
  'Tidak semua yang runtuh perlu dibangun kembali; sebagian cukup dipahami.',
]

function makeText(words: number, offset: number): string {
  const paras: string[] = []
  let count = 0
  let i = offset
  while (count < words) {
    const n = 3 + ((i * 7) % 3)
    const para: string[] = []
    for (let k = 0; k < n; k++) para.push(SENTENCES[i++ % SENTENCES.length])
    const text = para.join(' ')
    paras.push(text)
    count += countWords(text)
  }
  return paras.join('\n\n')
}

interface Spec {
  title: string
  kind: KindId
  stage: StageId
  target: number
  parts: [string, number][]
  next: string
  days: number
  asleep?: boolean
}

const SPECS: Spec[] = [
  { title: 'Contoh: Kumpulan esai tentang sunyi', kind: 'kumpulan', stage: 'draf', target: 9000,
    parts: [['Esai 1: Sunyi dan jawaban', 1500], ['Esai 2: Mengapa bertanya', 1250], ['Esai 3', 400]],
    next: 'Selesaikan Esai 3, lalu tulis penutup yang mengikat tiga esai.', days: 0 },
  { title: 'Contoh: Novel pertama', kind: 'novel', stage: 'kerangka', target: 40000,
    parts: [['Bab 1', 2600], ['Bab 2', 1900]],
    next: 'Tulis pertemuan pertama kedua tokoh di Bab 3.', days: 3 },
  { title: 'Contoh: Memoar masa kecil', kind: 'memoar', stage: 'revisi', target: 12000,
    parts: [['Bagian 1', 3200], ['Bagian 2', 3000], ['Bagian 3', 2400]],
    next: 'Periksa urutan waktu di Bagian 2.', days: 9 },
  { title: 'Contoh: Makalah hukum perikatan', kind: 'makalah', stage: 'gagasan', target: 3500,
    parts: [['Naskah', 300]],
    next: 'Tentukan rumusan masalah.', days: 1 },
  { title: 'Contoh: Novel yang tertunda', kind: 'novel', stage: 'draf', target: 50000,
    parts: [['Bab 1', 1800]],
    next: 'Putuskan: lanjutkan atau arsipkan.', days: 120, asleep: true },
]

export function buildSeed(): Work[] {
  const now = Date.now()
  return SPECS.map((s, idx) => {
    const parts = s.parts.map(([title, words], pi) => newPart(title, makeText(words, idx * 3 + pi)))
    const last = parts[parts.length - 1]
    const touched = now - s.days * 86_400_000 - idx * 3_600_000
    return {
      id: uid() + idx,
      title: s.title,
      kind: s.kind,
      stage: s.stage,
      targetWords: s.target,
      nextStep: s.next,
      asleep: !!s.asleep,
      createdAt: touched - 30 * 86_400_000,
      touchedAt: touched,
      lastPartId: last.id,
      lastSentence: lastSentence(last.md),
      parts,
    } satisfies Work
  })
}

export { plain }
