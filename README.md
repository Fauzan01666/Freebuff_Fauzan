# 🗓️ Planner Harian

Aplikasi web perencana harian untuk mahasiswa Sistem Informasi.
Dibangun **murni dengan HTML, CSS, dan JavaScript** — tanpa framework, tanpa
*build tool*, dan tanpa koneksi internet. Seluruh teks antarmuka serta komentar
kode memakai **bahasa Indonesia**.

---

## 1. Cara Menjalankan

### A. Lewat peramban (cara utama)

1. Pastikan ketujuh berkas berada dalam **satu folder yang sama**:
   ```
   planner-harian/
   ├── index.html      ← halaman utama (dobel-klik untuk membuka)
   ├── styles.css
   ├── logika.js
   ├── contoh.js
   ├── app.js
   ├── tes.html        ← halaman hasil tes
   ├── tes.js
   └── README.md
   ```
2. **Dobel-klik `index.html`**. Aplikasi langsung terbuka dengan protokol
   `file://` — tidak perlu server, tidak perlu internet.
3. Buka `tes.html` untuk melihat hasil pengecekan otomatis di peramban.

> Pratinjau singkat: buka `index.html` → tekan tombol **🧩 Muat contoh** di tab
> **Pengaturan** untuk langsung melihat aplikasi terisi data satu minggu penuh.

### B. Lewat terminal (khusus pengecekan logika)

```bash
node tes.js
```

Perintah tersebut menjalankan seluruh pengecekan otomatis atas `logika.js`
tanpa membuka peramban dan mengeluarkan kode keluar `0` bila semua lulus.

---

## 2. Penjelasan Fitur

### Tab 📅 Hari Ini
- **Timeline 05:00–23:00** dengan blok waktu: judul, kategori, jam mulai,
  jam selesai, dan catatan blok. Blok yang saling tumpang tindih otomatis
  ditempatkan berdampingan (bukan menumpuk).
- **Kategori berwarna**: Belajar, Kuliah, Olahraga, Makan, Istirahat, Ibadah,
  Lainnya — bisa ditambah/dihapus lewat tab Pengaturan.
- **Form tambah/ubah/hapus blok** dengan validasi: *jam selesai harus setelah
  jam mulai*, judul wajib diisi, dan blok harus berada dalam rentang 05:00–23:00.
- **Deteksi bentrok**: blok yang tumpang tindih diberi tanda ⚠️ dan warna khas,
  daftar pasangan bentrok ditampilkan di kartu Ringkasan. Menyimpan blok yang
  bentrok diperbolehkan, tetapi harus **menekan tombol Simpan dua kali**
  (konfirmasi eksplisit).
- **Navigasi tanggal** (Sebelumnya / Hari ini / Berikutnya) dan tombol
  **🧬 Salin jadwal** untuk menyalin seluruh blok hari ini ke tanggal lain
  (dengan pilihan menimpa bila tanggal tujuan sudah berisi blok).
- **Tandai selesai** per blok (lewat checkbox di timeline atau lewat form) +
  **persentase blok selesai** hari itu pada bar progres.
- **Catatan harian** per tanggal, tersimpan otomatis saat diketik.

### Tab ✅ Kebiasaan
- Tambah/ubah/hapus kebiasaan: **nama, ikon emoji, target harian**.
- **Grid 7 hari terakhir** — satu tombol centang per hari, bisa dioperasikan
  dengan keyboard (memiliki `aria-pressed` dan label jelas).
- **Streak saat ini** dan **streak terpanjang** dihitung oleh `logika.js`
  (hari kosong memutus rangkaian; bila hari ini belum dicentang, streak dihitung
  mundur dari kemarin agar tidak langsung hilang).

### Tab 🍅 Pomodoro
- Fokus **25 menit**, istirahat pendek **5 menit**, istirahat panjang **15 menit**
  setelah **4 sesi** — keempatnya bisa diubah di Pengaturan (termasuk jumlah
  sesi per siklus).
- Tombol **Mulai, Jeda, Lanjut, Reset, Lewati** + **lingkaran progres SVG**
  yang beranimasi.
- **Kaitkan sesi** dengan blok hari ini atau kategori yang sedang dikerjakan;
  sesi fokus yang selesai **dicatat ke riwayat** dan masuk hitungan Statistik.
- **Bunyi penanda** memakai **Web Audio API** (osilator, tanpa berkas audio dan
  tanpa notifikasi peramban yang sering diblokir di `file://`); bisa dimatikan
  di Pengaturan, ada tombol uji coba bunyi.
- **Akurat di latar belakang**: sisa waktu dihitung dari **selisih timestamp**
  (`tenggat − Date.now()`), bukan dari penurunan angka interval — jadi walau tab
  disimpan di latar belakang, waktu yang tampil tetap benar. Sisa waktu juga
  ditampilkan pada **judul tab browser** (`25:00 · Fokus — Planner Harian`);
  saat sesi berakhir judul berubah menjadi `✓ Sesi selesai`.

### Tab 📊 Statistik
- Total jam per kategori, total jam belajar, jumlah sesi Pomodoro,
  persentase kebiasaan terpenuhi, dan hari paling produktif.
- **Grafik batang per hari memakai SVG murni** (tanpa library) — batang oranye
  menandai hari paling produktif, ada label nilai jam di atas batang.
- **Target belajar mingguan** (jam) beserta bar progres capaian.
- **Navigasi minggu** sebelumnya/berikutnya (minggu dihitung dari **Senin**).

### Tab ⚙️ Pengaturan
- Tema tampilan (terang/gelap), durasi Pomodoro, bunyi, target mingguan,
  dan kelola kategori (nama + warna; kategori yang masih dipakai blok tidak
  bisa dihapus agar data tidak rusak).
- **⬇️ Ekspor JSON**, **⬆️ Impor JSON** (file rusak divalidasi dengan pesan
  galat yang jelas, bukan *crash*), **🗑️ Hapus semua data** (konfirmasi dua
  tahap: OK lalu mengetik kata `HAPUS`), dan **🧩 Muat contoh** (satu minggu
  penuh).
- Kotak **pratinjau JSON** menampilkan isi data terkini secara langsung.

### Tema & Responsivitas
- Tombol ganti tema di kop; pilihan **diingat** di `localStorage`.
- **Responsif**: desktop (grid dua kolom), tablet, dan HP (satu kolom,
  navigasi tab ringkas).
- Mendukung `prefers-reduced-motion` untuk pengguna yang mematikan animasi.

---

## 3. Format JSON

Berkas ekspor memakai **skema versi 1** (`versiSkema: 1`). Semua tanggal
memakai format ISO `YYYY-MM-DD`, semua jam memakai `HH:MM`.

```json
{
  "versiSkema": 1,
  "pengaturan": {
    "tema": "terang",
    "bunyi": true,
    "pomodoro": { "fokus": 25, "istirahatPendek": 5, "istirahatPanjang": 15, "panjangSiklus": 4 },
    "targetBelajarMinggu": 12
  },
  "kategori": [
    { "nama": "Belajar", "warna": "#4f7cff" }
  ],
  "blok": [
    {
      "id": "b1",
      "tanggal": "2026-10-05",
      "judul": "Belajar basis data",
      "kategori": "Belajar",
      "mulai": "08:00",
      "selesai": "10:00",
      "catatan": "bab 3 normalisasi",
      "selesai_": false
    }
  ],
  "catatan": {
    "2026-10-05": "Catatan harian bebas untuk tanggal ini"
  },
  "kebiasaan": [
    {
      "id": "k1",
      "nama": "Minum air 8 gelas",
      "ikon": "💧",
      "target": 8,
      "riwayat": { "2026-10-04": true, "2026-10-05": true }
    }
  ],
  "riwayatPomodoro": [
    { "waktu": "2026-10-05T08:00:00.000Z", "tanggal": "2026-10-05", "jenis": "fokus", "durasiMenit": 25, "kaitan": "kat:Belajar" }
  ]
}
```

**Aturan validasi impor:**

| Kondisi | Hasil |
|---|---|
| Objek valid, `versiSkema: 1`, semua blok berformat benar | Diterima; kunci opsional yang hilang diisi default |
| File bukan JSON / bukan objek | Ditolak — pesan *“File bukan JSON yang valid”* + detail |
| `versiSkema` salah atau hilang | Ditolak — pesan menyebut versi yang didukung |
| `blok` bukan array, tanggal bukan `YYYY-MM-DD`, jam bukan `HH:MM`, atau jam selesai ≤ jam mulai | Ditolak — pesan menyebut nomor blok bermasalah |
| `kebiasaan`/`riwayatPomodoro` bukan array, `catatan` bukan objek | Ditolak |

Penyimpanan memakai kunci `planner.data.v1`. Bila `localStorage` tidak
tersedia atau isinya JSON rusak, aplikasi **tidak crash**: data rusak diabaikan
dengan pemberitahuan dan aplikasi memulai dari data kosong (cadangan sementara
di memori bila localStorage benar-benar tidak ada).

---

## 4. Hasil Tes

### A. Pengecekan otomatis logika — `node tes.js`

```
Total: 75 | Lulus: 75 | Gagal: 0
HASIL: SEMUA LULUS ✓
```

Rincian kelompok pemeriksaan (syarat minimum 30, terpasang 75):

| Kelompok | Jumlah | Contoh isi |
|---|---|---|
| Utilitas tanggal & jam | 9 | format ISO, `HH:MM`, batas bulan/tahun, minggu diawali Senin |
| Deteksi bentrok & blok | 17 | tumpang tindih parsial, **bersentuhan di batas jam (tidak dianggap bentrok)**, blok identik, blok tertanam, durasi, validasi form |
| Streak kebiasaan | 12 | hari berurutan, celah, hari ini belum dicentang, streak terpanjang, urutan acak |
| Statistik mingguan & pembulatan | 12 | batas minggu (Senin–Minggu), total jam per kategori, hari produktif, pembulatan 2 desimal |
| Siklus Pomodoro | 8 | **sesi ke-4 → istirahat panjang**, sesi ke-8 → panjang, siklus bisa diubah, default bila nilai tidak valid |
| Validasi impor JSON | 13 | valid, rusak, versi salah, struktur salah, round-trip |
| Dataset contoh | 4 | satu minggu penuh, tanpa bentrok, jam valid, streak beragam |

Cara menjalankan:

```bash
node tes.js        # lewat terminal
# atau dobel-klik tes.html / buka di peramban untuk hasil yang sama
```

### B. Uji perilaku di peramban (headless Chrome)

Aplikasi diuji membuka `index.html` lewat `file://` dengan skenario:
muat contoh → menambah blok bentrok lewat form → menjalankan timer singkat →
ekspor lalu impor → ganti tema. Hasilnya:

- **40/40 skenario lulus**, **0 galat JavaScript** di konsol.
- Yang dipastikan: timeline merender blok, peringatan bentrok muncul pada tekan
  pertama dan menyimpan pada tekan kedua, validasi jam ditolak, sesi fokus
  tercatat dan berganti ke istirahat, judul tab menampilkan sisa waktu,
  grafik SVG punya 7 batang, impor ulang hasil ekspor sendiri berhasil,
  file JSON rusak dan versi salah ditolak dengan pesan jelas, tema berganti
  beserta sinkronisasi radio, catatan harian tersimpan, konten pengguna dirender
  aman (bukan `innerHTML` mentah), dan data tertulis di `localStorage`.

---

## 5. Penjelasan Sistem *(ringkas — untuk laporan tugas kuliah)*

**Planner Harian** adalah aplikasi *single-page* yang seluruhnya berjalan di sisi
klien (murni di peramban) sehingga dapat dibuka langsung melalui protokol
`file://` tanpa server. Kode dipisah ke dalam empat lapis tanggung jawab:

1. **`logika.js` — lapis logika (tanpa DOM).**
   Seluruh perhitungan berada di sini: manipulasi tanggal ISO, konversi
   jam↔menit, pencarian blok bentrok (algoritma perbandingan pasangan dengan
   syarat `mulaiA < selesaiB && mulaiB < selesaiA`, sehingga dua blok yang hanya
   bersentuhan di batas jam tidak dianggap bentrok), perhitungan *streak*
   (berjalan mundur dari hari terakhir yang tercentang), statistik mingguan
   (agregasi menit per kategori dan per hari), siklus Pomodoro
   (`jenisSesi = f(nSesiFokus)` dengan `n mod panjangSiklus`), dan validasi
   impor JSON. Modul ini diekspor lewat `module.exports` untuk Node.js **dan**
   `window.Logika` untuk peramban — sehingga **berkas tes yang sama** dapat
   dipakai di dua lingkungan.

2. **`app.js` — lapis antarmuka.**
   Membaca *state* dari `logika.js`, merender DOM (semua teks pengguna dimasukkan
   lewat `textContent`, **tanpa `innerHTML`**, untuk mencegah XSS), dan
   menangani peristiwa. Timer Pomodoro disimpan sebagai **`tenggat` (timestamp)**
   bukan penghitung mundur per interval: `sisa = tenggat − Date.now()`, sehingga
   interval yang diperlambat peramban di latar belakang tetap menghasilkan
   sisa waktu yang akurat.

3. **Penyimpanan.**
   Data disimpan otomatis ke `localStorage` dengan kunci `planner.data.v1`
   dan `versiSkema` di dalam berkas. Setiap kali dimuat, data melewati
   `validasiImpor()`; JSON rusak atau skema tidak cocok membuat aplikasi kembali
   ke data kosong dengan pemberitahuan, bukan *crash*. Bila `localStorage`
   tidak tersedia (beberapa peramban memblokirnya untuk `file://`), aplikasi
   beralih ke cadangan di memori dan tetap berfungsi selama halaman terbuka.

4. **`tes.js` / `tes.html` — pengujian.**
   75 pengecekan otomatis tanpa *framework tes*: satu kasus dianggap lulus bila
   tidak ada galat. Dijalankan lewat `node tes.js` maupun lewat `tes.html` di
   peramban.

**Pemilihan teknologi:** tanpa framework agar sesuai ketentuan tugas dan agar
aplikasi dapat dijalankan sepenuhnya offline; grafik batang memakai SVG murni
karena SVG tersedia di DOM tanpa pustaka; bunyi penanda memakai **Web Audio API**
(gelombang sinus terjadwal) karena berkas audio tidak dapat diandalkan dan
**Notification API sering diblokir peramban pada protokol `file://`**.

**Batasan yang disadari:** data hanya tersimpan pada satu peramban/computer
(tidak ada sinkronisasi), riwayat Pomodoro tidak menghitung sesi yang dilewati,
dan statistik menghitung blok jadwal seluruh hari dalam minggu termasuk yang
masih berupa rencana di masa depan.

---

## 6. Aksesibilitas & Keamanan

- Setiap input memiliki `<label>` yang terhubung; tombol memiliki nama aksesibel
  (`aria-label`), tab memakai pola `role="tab"` + navigasi panah keyboard.
- Kontras warna teks utama terhadap latar memadai di kedua tema.
- Semua data pengguna dirender lewat `textContent`/`createElement` — tidak ada
  penyisipan HTML mentah (terbukti pada uji peramban).
- Warna kategori divalidasi dengan pola heksadesimal sebelum dipakai di `style`.

---

## 7. Struktur Pengujian Singkat

```
node tes.js          → 75/75 lulus (keluar 0)
buka tes.html        → 75/75 lulus (identik, lewat peramban)
uji headless index.html → 40/40 skenario lulus, 0 galat JS
```
