/**
 * contoh.js — Dataset contoh untuk Planner Harian.
 * Berisi data satu minggu penuh (Senin-Minggu minggu berjalan)
 * yang dibuat relatif terhadap hari ini, sehingga selalu terasa
 * segar saat tombol "Muat contoh" ditekan.
 * Dipakai oleh app.js (browser) dan bisa juga lewat Node.
 */

/* global Logika */
(function (glob) {
  "use strict";

  // Ambil logika dasar; di Node logika.js sudah dimuat via require.
  const L = typeof Logika !== "undefined"
    ? Logika
    : (typeof require === "function" ? require("./logika.js") : null);

  let nomorUrut = 0;
  /** id unik sederhana untuk blok contoh. */
  function idBlok() {
    nomorUrut++;
    return "c" + Date.now().toString(36) + "-" + nomorUrut;
  }

  /**
   * Buat satu blok jadwal.
   * @param {string} tanggal ISO
   * @param {string} judul
   * @param {string} kategori
   * @param {string} mulai HH:MM
   * @param {string} selesai HH:MM
   * @param {boolean} selesaiStatus penanda blok selesai
   * @param {string} catatan catatan blok (opsional)
   */
  function blok(tanggal, judul, kategori, mulai, selesai, selesaiStatus, catatan) {
    return {
      id: idBlok(),
      tanggal: tanggal,
      judul: judul,
      kategori: kategori,
      mulai: mulai,
      selesai: selesai,
      catatan: catatan || "",
      selesai_: selesaiStatus === true
    };
  }

  /** Buat kebiasaan dengan riwayat centang. */
  function kebiasaan(nama, ikon, target, hariTercentang) {
    const riwayat = {};
    hariTercentang.forEach(function (iso) { riwayat[iso] = true; });
    return {
      id: "k" + Date.now().toString(36) + "-" + (nomorUrut++),
      nama: nama,
      ikon: ikon,
      target: target,
      riwayat: riwayat
    };
  }

  /**
   * Susun data contoh satu minggu penuh.
   * @param {string} hariIniISO tanggal hari ini (ISO), default hari ini
   * @returns {Object} objek data siap pakai (skema sama dengan ekspor)
   */
  function buatContoh(hariIniISO) {
    const L2 = L || {
      hariIni: function () { return new Date().toISOString().slice(0, 10); },
      mingguDari: function (iso) { return [iso]; },
      tambahHari: function (iso) { return iso; },
      dataKosong: function () { return { pengaturan: {}, kategori: [] }; }
    };
    const hariIni = hariIniISO || L2.hariIni();
    const minggu = L2.mingguDari(hariIni);   // Senin..Minggu

    const blokDaftar = [];
    const catatan = {};
    const riwayatPomodoro = [];

    // Pola jadwal harian untuk tiap hari
    const pola = [
      // Senin
      [
        ["06:00", "06:45", "Olahraga", "Lari pagi", true],
        ["07:00", "07:30", "Ibadah", "Sholat Subuh & doa", true],
        ["07:30", "08:00", "Makan", "Sarapan & siap-siap", true],
        ["08:00", "10:00", "Kuliah", "Matematika Diskrit", true],
        ["10:00", "10:30", "Istirahat", "Camilan & jalan sebentar", true],
        ["10:30", "12:00", "Kuliah", "Pemrograman Web", true],
        ["12:00", "13:00", "Makan", "Makan siang", true],
        ["13:00", "15:00", "Belajar", "Latihan soal Diskrit", true],
        ["15:00", "16:00", "Istirahat", "Tidur siang", true],
        ["16:00", "18:00", "Belajar", "Proyek basis data", true],
        ["19:00", "20:00", "Ibadah", "Sholat Maghrib & makan", true],
        ["20:00", "21:30", "Belajar", "Review catatan kuliah", false]
      ],
      // Selasa
      [
        ["06:00", "06:45", "Olahraga", "Senam pagi", true],
        ["08:00", "10:00", "Kuliah", "Basis Data", true],
        ["10:30", "12:00", "Kuliah", "Praktikum Basis Data", true],
        ["12:00", "13:00", "Makan", "Makan siang", true],
        ["13:30", "15:30", "Belajar", "Normalisasi ERD", true],
        ["16:00", "17:30", "Belajar", "Rangkuman kuliah", false],
        ["19:00", "21:00", "Lainnya", "Rapat organisasi", false]
      ],
      // Rabu
      [
        ["07:00", "07:30", "Ibadah", "Kajian pagi", true],
        ["08:00", "10:00", "Kuliah", "Sistem Informasi Manajemen", true],
        ["10:30", "12:00", "Kuliah", "Bahasa Inggris", true],
        ["12:00", "13:00", "Makan", "Makan siang", true],
        ["14:00", "16:00", "Belajar", "Studi kasus SIM", true],
        ["16:00", "17:00", "Olahraga", "Gym", true],
        ["20:00", "21:30", "Belajar", "Reading task", false]
      ],
      // Kamis
      [
        ["06:00", "06:45", "Olahraga", "Lari pagi", true],
        ["08:00", "10:00", "Kuliah", "Statistika", true],
        ["10:30", "12:00", "Kuliah", "Praktikum Statistika", true],
        ["12:00", "13:00", "Makan", "Makan siang", true],
        ["13:30", "15:00", "Belajar", "Latihan distribusi", true],
        ["15:30", "17:00", "Belajar", "Kerjakan tugas kelompok", false],
        ["19:30", "20:30", "Ibadah", "Tadarus", false]
      ],
      // Jumat
      [
        ["06:00", "06:30", "Olahraga", "Peregangan", true],
        ["07:00", "08:00", "Ibadah", "Sholat Jumat", true],
        ["09:00", "11:00", "Belajar", "Konsultasi tugas", true],
        ["11:00", "12:00", "Makan", "Makan siang", true],
        ["13:00", "15:00", "Belajar", "Proyek akhir", false],
        ["16:00", "17:00", "Istirahat", "Main game", false],
        ["19:00", "21:00", "Lainnya", "Nonton dokumenter", false]
      ],
      // Sabtu
      [
        ["07:00", "08:00", "Olahraga", "Sepeda sore", false],
        ["08:00", "09:00", "Makan", "Sarapan santai", false],
        ["09:00", "11:00", "Belajar", "Belajar mandiri mingguan", false],
        ["11:00", "12:00", "Istirahat", "Istirahat", false],
        ["14:00", "16:00", "Lainnya", "Kerja sampingan freelance", false],
        ["19:00", "20:00", "Makan", "Makan malam keluarga", false],
        ["20:00", "22:00", "Belajar", "Persiapan minggu depan", false]
      ],
      // Minggu
      [
        ["08:00", "09:00", "Makan", "Sarapan", false],
        ["09:00", "11:00", "Belajar", "Baca buku pemrograman", false],
        ["11:00", "12:00", "Ibadah", "Renungan mingguan", false],
        ["13:00", "15:00", "Lainnya", "Kuliner bareng teman", false],
        ["16:00", "17:00", "Olahraga", "Renang", false],
        ["19:00", "20:00", "Makan", "Makan malam", false],
        ["20:00", "22:00", "Istirahat", "Menonton film", false]
      ]
    ];

    // Catatan harian contoh
    const catatanContoh = [
      "Hari pertama minggu ini — fokus ke tugas Diskrit.",
      "Jangan lupa upload tugas basis data sebelum tengah malam.",
      "Konsultasi dosen jam 09:00, bawa draft laporan.",
      "Cek pengumuman kelas statistika.",
      "Jumat: waktu yang tepat menyelesaikan tugas kelompok.",
      "Akhir pekan, sisihkan 2 jam untuk belajar mandiri.",
      "Rencanakan minggu depan sambil minum kopi."
    ];

    for (let i = 0; i < 7; i++) {
      const tgl = minggu[i];
      const lewat = tgl < hariIni;
      pola[i].forEach(function (p) {
        // Blok dianggap selesai bila hari sudah lewat, atau status pola true
        blokDaftar.push(blok(tgl, p[3], p[2], p[0], p[1], lewat || p[4], ""));
      });
      catatan[tgl] = catatanContoh[i];
    }

    // Sesi Pomodoro contoh pada hari-hari yang sudah lewat
    minggu.forEach(function (tgl) {
      if (tgl > hariIni) return;
      const jumlah = 2 + (L2.indeksHari ? L2.indeksHari(tgl) : 0) % 3;
      for (let s = 0; s < jumlah; s++) {
        riwayatPomodoro.push({
          waktu: tgl + "T" + (8 + s * 2) + ":00:00",
          tanggal: tgl,
          jenis: "fokus",
          durasiMenit: 25,
          kaitanId: null
        });
      }
    });

    // Kebiasaan contoh: riwayat diisi agar streak terlihat menarik
    const kosong = L2.dataKosong();
    const hasil = {
      versiSkema: (L ? L.VERSI_SKEMA : 1),
      pengaturan: {
        tema: "terang",
        bunyi: true,
        pomodoro: { fokus: 25, istirahatPendek: 5, istirahatPanjang: 15, panjangSiklus: 4 },
        targetBelajarMinggu: 12
      },
      kategori: kosong.kategori && kosong.kategori.length ? kosong.kategori : undefined,
      blok: blokDaftar,
      catatan: catatan,
      kebiasaan: [],
      riwayatPomodoro: riwayatPomodoro
    };

    // Kebiasaan: "Minum air" tercentang 4 hari terakhir berurutan
    const air = [];
    for (let d = 0; d < 4; d++) air.push(L2.tambahHari(hariIni, -d));
    hasil.kebiasaan.push(kebiasaan("Minum air 8 gelas", "💧", 8, air));

    // "Baca 20 menit" tercentang hari berurutan tanpa celah (5 hari, termasuk hari ini)
    const baca = [];
    for (let d = 0; d < 5; d++) baca.push(L2.tambahHari(hariIni, -d));
    hasil.kebiasaan.push(kebiasaan("Baca 20 menit", "📖", 1, baca));

    // "Olahraga" ada celah — tercentang 3 hari lalu & 4 hari lalu saja
    hasil.kebiasaan.push(kebiasaan("Olahraga 30 menit", "🏃", 1, [
      L2.tambahHari(hariIni, -3),
      L2.tambahHari(hariIni, -4)
    ]));

    // "Bangun pagi" baru kemarin (streak 1)
    hasil.kebiasaan.push(kebiasaan("Bangun sebelum 06:00", "⏰", 1, [
      L2.tambahHari(hariIni, -1)
    ]));

    if (hasil.kategori === undefined) delete hasil.kategori;
    return hasil;
  }

  const Contoh = { buatContoh: buatContoh };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Contoh;  // Node.js
  }
  if (glob) glob.Contoh = Contoh;  // Browser
})(typeof window !== "undefined" ? window : null);
