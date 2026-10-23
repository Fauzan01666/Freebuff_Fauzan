/**
 * logika.js — SELURUH logika perhitungan Planner Harian.
 * Modul ini tidak menyentuh DOM sama sekali sehingga bisa dipanggil
 * lewat Node.js (untuk tes) maupun langsung di browser.
 */

/* =========================================================
 * 1. UTILITAS DASAR: tanggal dan jam
 * ========================================================= */

/** Angka dua digit (mis. 7 -> "07"). */
function duaDigit(n) {
  return String(n).padStart(2, "0");
}

/** Ubah Date -> string ISO "YYYY-MM-DD" (memakai tanggal lokal). */
function keISO(date) {
  return date.getFullYear() + "-" + duaDigit(date.getMonth() + 1) + "-" + duaDigit(date.getDate());
}

/** Parse string ISO "YYYY-MM-DD" jadi objek Date (waktu 00:00 lokal). */
function dariISO(iso) {
  const bagian = String(iso).split("-");
  return new Date(Number(bagian[0]), Number(bagian[1]) - 1, Number(bagian[2]));
}

/** Hari ini dalam format ISO. */
function hariIni() {
  return keISO(new Date());
}

/** Apakah string formatnya ISO valid "YYYY-MM-DD"? */
function apakahISO(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = dariISO(s);
  return !isNaN(d.getTime()) && keISO(d) === s;
}

/** Apakah string formatnya jam valid "HH:MM" (00:00-23:59)? */
function apakahJam(s) {
  if (typeof s !== "string" || !/^\d{2}:\d{2}$/.test(s)) return false;
  const j = Number(s.slice(0, 2));
  const m = Number(s.slice(3, 5));
  return j >= 0 && j <= 23 && m >= 0 && m <= 59;
}

/** Jam "HH:JM" -> menit sejak tengah malam. Asumsi format valid. */
function jamKeMenit(jam) {
  return Number(jam.slice(0, 2)) * 60 + Number(jam.slice(3, 5));
}

/** Menit -> "HH:MM". */
function menitKeJam(menit) {
  const j = Math.floor(menit / 60);
  const m = menit % 60;
  return duaDigit(j) + ":" + duaDigit(m);
}

/** Tambah hari ke tanggal ISO. */
function tambahHari(iso, jumlah) {
  const d = dariISO(iso);
  d.setDate(d.getDate() + jumlah);
  return keISO(d);
}

/** Nama hari Senin..Minggu. */
const NAMA_HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

/** Nama hari dari ISO (0=Senin ... 6=Minggu). */
function indeksHari(iso) {
  const d = dariISO(iso);
  // getDay(): 0=Minggu..6=Sabtu diubah menjadi 0=Senin..6=Minggu
  return (d.getDay() + 6) % 7;
}

/** Nama hari dari ISO, mis. "Senin". */
function namaHari(iso) {
  return NAMA_HARI[indeksHari(iso)];
}

/** Tanggal ISO pendek untuk label, mis. "09 Okt". */
const NAMA_BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function tanggalPendek(iso) {
  const d = dariISO(iso);
  return duaDigit(d.getDate()) + " " + NAMA_BULAN[d.getMonth()];
}

/**
 * Minggu (Senin-Minggu) yang memuat tanggal iso.
 * Mengembalikan 7 string ISO, diawali Senin.
 */
function mingguDari(iso) {
  const hariSenin = tambahHari(iso, -indeksHari(iso));
  const hasil = [];
  for (let i = 0; i < 7; i++) hasil.push(tambahHari(hariSenin, i));
  return hasil;
}

/** Jam dari menit ke desimal, mis. 90 menit -> 1.5. */
function menitKeJamDesimal(menit) {
  return Math.round((menit / 60) * 100) / 100;
}

/** Pembulatan jam ke `desimal` tempat desimal (default 2). */
function pembulatanJam(menit, desimal) {
  const d = typeof desimal === "number" ? desimal : 2;
  const faktor = Math.pow(10, d);
  return Math.round((menit / 60) * faktor) / faktor;
}

/* =========================================================
 * 2. BLOK JADWAL HARIAN
 * ========================================================= */

/**
 * Cari blok bentrok (tumpang tindih) pada satu hari.
 * Dua blok dianggap bentrok bila rentang waktu mereka saling
 * menimpa; blok yang hanya bersentuhan di batas jam (selesai ==
 * mulai) TIDAK dianggap bentrok.
 * @param {Array} blokDaftar daftar blok pada satu hari
 * @returns {Array} daftar { a, b, idA, idB } — pasangan blok bentrok
 */
function cariBentrok(blokDaftar) {
  const hasil = [];
  const daftar = (blokDaftar || []).slice();
  for (let i = 0; i < daftar.length; i++) {
    for (let j = i + 1; j < daftar.length; j++) {
      const a = daftar[i];
      const b = daftar[j];
      const mulaiA = jamKeMenit(a.mulai);
      const selesaiA = jamKeMenit(a.selesai);
      const mulaiB = jamKeMenit(b.mulai);
      const selesaiB = jamKeMenit(b.selesai);
      // Tumpang tindih murni: awal salah satu < akhir yang lain
      if (mulaiA < selesaiB && mulaiB < selesaiA) {
        hasil.push({ a: a, b: b, idA: a.id, idB: b.id });
      }
    }
  }
  return hasil;
}

/** Kembalikan himpunan id blok yang terlibat bentrok. */
function idBentrok(blokDaftar) {
  const pasangan = cariBentrok(blokDaftar);
  const set = {};
  pasangan.forEach(function (p) {
    set[p.idA] = true;
    set[p.idB] = true;
  });
  return set;
}

/**
 * Validasi satu blok jadwal.
 * @returns {Array} daftar pesan galat; array kosong berarti valid.
 */
function validasiBlok(blok, daftarLain) {
  const galat = [];
  if (!blok || typeof blok !== "object") {
    return ["Blok tidak valid."];
  }
  if (typeof blok.judul !== "string" || blok.judul.trim() === "") {
    galat.push("Judul blok wajib diisi.");
  }
  if (!apakahJam(blok.mulai)) galat.push("Jam mulai harus format HH:MM.");
  if (!apakahJam(blok.selesai)) galat.push("Jam selesai harus format HH:MM.");
  if (apakahJam(blok.mulai) && apakahJam(blok.selesai)) {
    if (jamKeMenit(blok.selesai) <= jamKeMenit(blok.mulai)) {
      galat.push("Jam selesai harus setelah jam mulai.");
    }
  }
  if (typeof blok.kategori !== "string" || blok.kategori.trim() === "") {
    galat.push("Kategori wajib dipilih.");
  }
  // Peringatan (bukan galat) bila menabrak blok lain
  if (galat.length === 0 && Array.isArray(daftarLain)) {
    const uji = { mulai: blok.mulai, selesai: blok.selesai };
    const tersentuh = daftarLain.some(function (b) {
      return jamKeMenit(uji.mulai) < jamKeMenit(b.selesai) &&
        jamKeMenit(b.mulai) < jamKeMenit(uji.selesai);
    });
    if (tersentuh) galat.push("PERINGATAN: jadwal ini tumpang tindih dengan blok lain.");
  }
  return galat;
}

/** Durasi blok dalam menit. */
function durasiBlok(blok) {
  return jamKeMenit(blok.selesai) - jamKeMenit(blok.mulai);
}

/** Persentase blok yang selesai pada suatu hari (0-100, dibulatkan). */
function persentaseSelesai(daftarBlok) {
  if (!Array.isArray(daftarBlok) || daftarBlok.length === 0) return 0;
  const selesai = daftarBlok.filter(function (b) { return b.selesai_ === true; }).length;
  return Math.round((selesai / daftarBlok.length) * 100);
}

/* =========================================================
 * 3. KEBIASAAN & STREAK
 * ========================================================= */

/**
 * Streak yang berjalan saat ini.
 * Definisi: hari berurutan yang tercentang yang berakhir paling
 * baru di antara hari-hari tercentang. Bila HARI INI belum
 * dicentang, streak terhitung dari kemarin (agar tidak langsung
 * nol), asalkan kemarin tercentang.
 * @param {Array} tanggalTercentang daftar ISO yang dicentang
 * @param {string} hariIniISO tanggal hari ini (ISO)
 * @returns {Object} { streak, sampai }
 */
function hitungStreak(tanggalTercentang, hariIniISO) {
  const unik = Array.from(new Set(tanggalTercentang || [])).filter(apakahISO).sort();
  if (unik.length === 0) return { streak: 0, sampai: null };

  const set = {};
  unik.forEach(function (t) { set[t] = true; });

  // Titik awal penghitungan mundur:
  // - bila hari ini tercentang -> mulai dari hari ini
  // - bila tidak -> mulai dari kemarin (bila kemarin tercentang)
  let kursor;
  if (set[hariIniISO]) {
    kursor = hariIniISO;
  } else {
    const kemarin = tambahHari(hariIniISO, -1);
    if (!set[kemarin]) return { streak: 0, sampai: null };
    kursor = kemarin;
  }

  let streak = 0;
  while (set[kursor]) {
    streak++;
    kursor = tambahHari(kursor, -1);
  }
  return { streak: streak, sampai: kursor === hariIniISO ? hariIniISO : tambahHari(kursor, 1) };
}

/** Alias ringkas: hanya angka streak saat ini. */
function streakSaatIni(tanggalTercentang, hariIniISO) {
  return hitungStreak(tanggalTercentang, hariIniISO).streak;
}

/**
 * Streak terpanjang dari daftar tanggal tercentang.
 * Hari kosong memutus rangkaian; hari pertama dihitung streak 1.
 */
function streakTerpanjang(tanggalTercentang) {
  const unik = Array.from(new Set(tanggalTercentang || [])).filter(apakahISO).sort();
  if (unik.length === 0) return 0;
  let terbaik = 1;
  let berjalan = 1;
  for (let i = 1; i < unik.length; i++) {
    if (tambahHari(unik[i - 1], 1) === unik[i]) {
      berjalan++;
      if (berjalan > terbaik) terbaik = berjalan;
    } else {
      berjalan = 1;
    }
  }
  return terbaik;
}

/**
 * Persentase kebiasaan terpenuhi dalam satu minggu.
 * @param {Array} kebiasaan daftar kebiasaan (punya .riwayat { iso: bool })
 * @param {Array} daftarISO 7 tanggal minggu tersebut
 * @returns {Object} { persen, terpenuhi, total }
 */
function persentaseKebiasaanMinggu(kebiasaan, daftarISO) {
  let terpenuhi = 0;
  let total = 0;
  (kebiasaan || []).forEach(function (k) {
    const riwayat = k.riwayat || {};
    daftarISO.forEach(function (tgl) {
      // Hitung hari sampai hari ini saja (masa depan tidak dihitung)
      if (tgl > hariIni()) return;
      total++;
      if (riwayat[tgl] === true) terpenuhi++;
    });
  });
  if (total === 0) return { persen: 0, terpenuhi: 0, total: 0 };
  return { persen: Math.round((terpenuhi / total) * 100), terpenuhi: terpenuhi, total: total };
}

/* =========================================================
 * 4. STATISTIK MINGGUAN
 * ========================================================= */

/**
 * Statistik untuk satu minggu (Senin-Minggu).
 * @param {Object} data { blok: [...], pomodoro: [...], kebiasaan: [...] }
 * @param {Array}  daftarISO 7 tanggal ISO minggu tersebut
 * @param {Object} opsi { targetBelajarMinggu: jam }
 * @returns {Object} ringkasan statistik
 */
function statistikMinggu(data, daftarISO, opsi) {
  opsi = opsi || {};
  const set = {};
  daftarISO.forEach(function (t) { set[t] = true; });

  const perKategori = {};
  const perHari = {};
  daftarISO.forEach(function (t) {
    perHari[t] = { menit: 0, belajar: 0, sesi: 0, blok: 0, blokSelesai: 0 };
  });

  let totalMenit = 0;
  let totalBelajar = 0;

  // 1) Akumulasi blok jadwal per kategori dan per hari
  (data.blok || []).forEach(function (b) {
    if (!set[b.tanggal]) return;
    const menit = durasiBlok(b);
    if (menit <= 0) return;
    const kat = b.kategori || "Lainnya";
    perKategori[kat] = (perKategori[kat] || 0) + menit;
    totalMenit += menit;
    const h = perHari[b.tanggal];
    h.menit += menit;
    h.blok += 1;
    if (b.selesai_ === true) h.blokSelesai += 1;
    if (kat === "Belajar") {
      totalBelajar += menit;
      h.belajar += menit;
    }
  });

  // 2) Sesi Pomodoro fokus yang selesai
  let sesiPomodoro = 0;
  (data.riwayatPomodoro || []).forEach(function (s) {
    if (!set[s.tanggal]) return;
    if (s.jenis !== "fokus") return;
    sesiPomodoro++;
    if (perHari[s.tanggal]) perHari[s.tanggal].sesi += 1;
  });

  // 3) Kebiasaan terpenuhi
  const kebiasaan = persentaseKebiasaanMinggu(data.kebiasaan || [], daftarISO);

  // 4) Hari paling produktif = total menit jadwal terbanyak
  let hariProduktif = null;
  let menitProduktif = -1;
  daftarISO.forEach(function (t) {
    if (perHari[t].menit > menitProduktif) {
      menitProduktif = perHari[t].menit;
      hariProduktif = t;
    }
  });
  if (menitProduktif <= 0) hariProduktif = null;

  // 5) Target belajar mingguan
  const target = typeof opsi.targetBelajarMinggu === "number" ? opsi.targetBelajarMinggu : 0;
  const capaianBelajar = target > 0
    ? Math.min(100, Math.round((menitKeJamDesimal(totalBelajar) / target) * 100))
    : 0;

  return {
    totalMenit: totalMenit,
    totalJam: pembulatanJam(totalMenit),
    perKategori: perKategori,               // menit
    perKategoriJam: Object.keys(perKategori).reduce(function (acc, k) {
      acc[k] = pembulatanJam(perKategori[k]);
      return acc;
    }, {}),
    totalBelajarMenit: totalBelajar,
    totalBelajarJam: pembulatanJam(totalBelajar),
    sesiPomodoro: sesiPomodoro,
    kebiasaanPersen: kebiasaan.persen,
    kebiasaanTerpenuhi: kebiasaan.terpenuhi,
    kebiasaanTotal: kebiasaan.total,
    hariProduktif: hariProduktif,
    perHari: perHari,
    perHariJam: daftarISO.reduce(function (acc, t) {
      acc[t] = pembulatanJam(perHari[t].menit);
      return acc;
    }, {}),
    targetBelajarMinggu: target,
    capaianBelajar: capaianBelajar
  };
}

/* =========================================================
 * 5. SIKLUS POMODORO
 * ========================================================= */

/**
 * Konfigurasi durasi Pomodoro (dalam menit).
 * @param {Object} cfg { fokus, istirahatPendek, istirahatPanjang, panjangSiklus }
 */
function normalisasiPomodoro(cfg) {
  cfg = cfg || {};
  function angka(v, bawaan) {
    const n = Number(v);
    return isFinite(n) && n > 0 ? n : bawaan;
  }
  return {
    fokus: angka(cfg.fokus, 25),
    istirahatPendek: angka(cfg.istirahatPendek, 5),
    istirahatPanjang: angka(cfg.istirahatPanjang, 15),
    panjangSiklus: Math.max(1, Math.round(angka(cfg.panjangSiklus, 4)))
  };
}

/**
 * Jenis sesi berikutnya dalam siklus Pomodoro.
 * @param {number} sesiSelesai jumlah sesi fokus yang sudah selesai
 * @param {Object} cfg konfigurasi (lihat normalisasiPomodoro)
 * @returns {Object} { jenis, durasi, sesiKe } — jenis: "fokus" | "pendek" | "panjang"
 */
function sesiPomodoroBerikutnya(sesiSelesai, cfg) {
  const c = normalisasiPomodoro(cfg);
  const n = Math.max(0, Math.floor(Number(sesiSelesai) || 0));
  const ke = (n % c.panjangSiklus) + 1;          // sesi fokus berikutnya ke berapa
  const baruSajaFokus = n > 0;
  if (baruSajaFokus && ke === 1 && n % c.panjangSiklus === 0) {
    // Baru menyelesaikan sesi ke-4 (kelipatan panjangSiklus) -> istirahat panjang
    return { jenis: "panjang", durasi: c.istirahatPanjang, sesiKe: ke };
  }
  if (baruSajaFokus) {
    return { jenis: "pendek", durasi: c.istirahatPendek, sesiKe: ke };
  }
  return { jenis: "fokus", durasi: c.fokus, sesiKe: ke };
}

/** Daftar urutan sesi satu siklus penuh, mis. ["fokus","pendek","fokus","pendek",...,"panjang"]. */
function daftarSiklus(cfg) {
  const c = normalisasiPomodoro(cfg);
  const hasil = [];
  for (let i = 0; i < c.panjangSiklus; i++) {
    hasil.push("fokus");
    hasil.push(i === c.panjangSiklus - 1 ? "panjang" : "pendek");
  }
  return hasil;
}

/* =========================================================
 * 6. VALIDASI & EKSPOR/IMPOR JSON
 * ========================================================= */

const VERSI_SKEMA = 1;

/** Bentuk data bawaan (kosong) sesuai skema. */
function dataKosong() {
  return {
    versiSkema: VERSI_SKEMA,
    pengaturan: {
      tema: "terang",
      bunyi: true,
      pomodoro: { fokus: 25, istirahatPendek: 5, istirahatPanjang: 15, panjangSiklus: 4 },
      targetBelajarMinggu: 10
    },
    kategori: [
      { nama: "Belajar", warna: "#4f7cff" },
      { nama: "Kuliah", warna: "#9b5de5" },
      { nama: "Olahraga", warna: "#20bf6b" },
      { nama: "Makan", warna: "#f6a609" },
      { nama: "Istirahat", warna: "#8395a7" },
      { nama: "Ibadah", warna: "#0fb5ba" },
      { nama: "Lainnya", warna: "#7f8fa6" }
    ],
    blok: [],
    catatan: {},          // { "YYYY-MM-DD": "teks" }
    kebiasaan: [],
    riwayatPomodoro: []
  };
}

/**
 * Validasi objek hasil impor JSON.
 * @param {any} obj hasil JSON.parse
 * @returns {Object} { valid: boolean, galat: [..], data: objekBersih }
 */
function validasiImpor(obj) {
  const galat = [];
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return { valid: false, galat: ["File bukan objek JSON yang valid."], data: null };
  }
  if (obj.versiSkema === undefined) {
    galat.push("Kunci versiSkema tidak ditemukan — file mungkin bukan ekspor Planner Harian.");
  } else if (obj.versiSkema !== VERSI_SKEMA) {
    galat.push("Versi skema tidak didukung: " + String(obj.versiSkema) + " (didukung: " + VERSI_SKEMA + ").");
  }

  // Wajib ada minimal daftar blok berbentuk array
  if (!Array.isArray(obj.blok)) {
    galat.push("Kunci blok harus berupa array.");
  } else {
    for (let i = 0; i < obj.blok.length; i++) {
      const b = obj.blok[i];
      if (!b || typeof b !== "object") { galat.push("Blok ke-" + (i + 1) + " tidak valid."); break; }
      if (!apakahISO(b.tanggal)) { galat.push("Blok ke-" + (i + 1) + ": tanggal tidak valid (harus YYYY-MM-DD)."); break; }
      if (!apakahJam(b.mulai) || !apakahJam(b.selesai)) { galat.push("Blok ke-" + (i + 1) + ": jam tidak valid (harus HH:MM)."); break; }
      if (jamKeMenit(b.selesai) <= jamKeMenit(b.mulai)) { galat.push("Blok ke-" + (i + 1) + ": jam selesai harus setelah jam mulai."); break; }
      if (typeof b.judul !== "string" || b.judul.trim() === "") { galat.push("Blok ke-" + (i + 1) + ": judul kosong."); break; }
    }
  }

  if (obj.kebiasaan !== undefined && !Array.isArray(obj.kebiasaan)) {
    galat.push("Kunci kebiasaan harus berupa array.");
  }
  if (obj.riwayatPomodoro !== undefined && !Array.isArray(obj.riwayatPomodoro)) {
    galat.push("Kunci riwayatPomodoro harus berupa array.");
  }
  if (obj.catatan !== undefined && (obj.catatan === null || typeof obj.catatan !== "object" || Array.isArray(obj.catatan))) {
    galat.push("Kunci catatan harus berupa objek.");
  }

  if (galat.length > 0) return { valid: false, galat: galat, data: null };

  // Semua lolos -> susun objek bersih dengan default untuk kunci yang hilang
  const dasar = dataKosong();
  const hasil = {
    versiSkema: VERSI_SKEMA,
    pengaturan: Object.assign(dasar.pengaturan, obj.pengaturan || {}),
    kategori: Array.isArray(obj.kategori) && obj.kategori.length > 0 ? obj.kategori : dasar.kategori,
    blok: obj.blok,
    catatan: obj.catatan || {},
    kebiasaan: Array.isArray(obj.kebiasaan) ? obj.kebiasaan : [],
    riwayatPomodoro: Array.isArray(obj.riwayatPomodoro) ? obj.riwayatPomodoro : []
  };
  // Pastikan pengaturan pomodoro lengkap
  hasil.pengaturan.pomodoro = normalisasiPomodoro(
    (obj.pengaturan && obj.pengaturan.pomodoro) || {}
  );
  return { valid: true, galat: [], data: hasil };
}

/** Serialisasi data ke JSON rapi (untuk ekspor & penyimpanan). */
function serialisasi(data) {
  return JSON.stringify(data, null, 2);
}

/* =========================================================
 * 7. EKSPOR (browser & Node)
 * ========================================================= */

// API publik logika.js
const Logika = {
  // tanggal & jam
  duaDigit: duaDigit,
  keISO: keISO,
  dariISO: dariISO,
  hariIni: hariIni,
  apakahISO: apakahISO,
  apakahJam: apakahJam,
  jamKeMenit: jamKeMenit,
  menitKeJam: menitKeJam,
  tambahHari: tambahHari,
  indeksHari: indeksHari,
  namaHari: namaHari,
  tanggalPendek: tanggalPendek,
  mingguDari: mingguDari,
  menitKeJamDesimal: menitKeJamDesimal,
  pembulatanJam: pembulatanJam,
  NAMA_HARI: NAMA_HARI,
  // blok
  cariBentrok: cariBentrok,
  idBentrok: idBentrok,
  validasiBlok: validasiBlok,
  durasiBlok: durasiBlok,
  persentaseSelesai: persentaseSelesai,
  // kebiasaan
  hitungStreak: hitungStreak,
  streakSaatIni: streakSaatIni,
  streakTerpanjang: streakTerpanjang,
  persentaseKebiasaanMinggu: persentaseKebiasaanMinggu,
  // statistik
  statistikMinggu: statistikMinggu,
  // pomodoro
  normalisasiPomodoro: normalisasiPomodoro,
  sesiPomodoroBerikutnya: sesiPomodoroBerikutnya,
  daftarSiklus: daftarSiklus,
  // impor/ekspor
  VERSI_SKEMA: VERSI_SKEMA,
  dataKosong: dataKosong,
  validasiImpor: validasiImpor,
  serialisasi: serialisasi
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = Logika;   // Node.js (tes)
}
if (typeof window !== "undefined") {
  window.Logika = Logika;    // Browser (protokol file://)
}
