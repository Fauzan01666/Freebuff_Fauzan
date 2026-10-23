/**
 * tes.js — Pengecekan otomatis untuk logika.js Planner Harian.
 * Berjalan lewat:  node tes.js   (Node.js)
 * Atau lewat:     tes.html      (browser, protokol file://)
 * Tanpa framework tes: setiap kasus dipanggil lewat uji(nama, fungsi)
 * dan dianggap lulus bila tidak melempar galat.
 */

(function (glob) {
  "use strict";

  // Muat logika: browser memakai window.Logika, Node memakai require.
  const L = typeof Logika !== "undefined"
    ? Logika
    : (typeof require === "function" ? require("./logika.js") : null);
  const C = typeof Contoh !== "undefined"
    ? Contoh
    : (typeof require === "function" ? require("./contoh.js") : null);

  const hasil = [];   // daftar hasil: { nama, lulus, pesan }

  /** Galat bila kondisi tidak terpenuhi. */
  function assert(kondisi, pesan) {
    if (!kondisi) throw new Error(pesan || "Kondisi tidak terpenuhi.");
  }

  /** Galat bila a !== b. */
  function assertSama(a, b, pesan) {
    if (a !== b) {
      throw new Error((pesan || "Nilai tidak sama") +
        " — diharapkan " + JSON.stringify(b) + ", didapat " + JSON.stringify(a));
    }
  }

  /** Daftar galat validasi mengandung teks tertentu. */
  function galatMemuat(daftar, teks) {
    return Array.isArray(daftar) && daftar.some(function (g) {
      return String(g).indexOf(teks) !== -1;
    });
  }

  /** Daftar blok uji generik (tanpa tanggal) untuk tes bentrok/durasi. */
  function blokJam(id, mulai, selesai) {
    return { id: id, mulai: mulai, selesai: selesai, judul: "Uji", kategori: "Belajar" };
  }

  /** Jalankan satu kasus tes. */
  function uji(nama, fungsi) {
    try {
      fungsi();
      hasil.push({ nama: nama, lulus: true, pesan: "" });
    } catch (e) {
      hasil.push({ nama: nama, lulus: false, pesan: e && e.message ? e.message : String(e) });
    }
  }

  /* =========================================================
   * A. UTILITAS TANGGAL & JAM
   * ========================================================= */

  uji("keISO menghasilkan format YYYY-MM-DD", function () {
    assertSama(L.keISO(new Date(2026, 0, 5)), "2026-01-05");
    assertSama(L.keISO(new Date(2026, 9, 9)), "2026-10-09");
  });

  uji("apakahISO menerima tanggal valid dan menolak yang rusak", function () {
    assert(L.apakahISO("2026-10-09"), "seharusnya valid");
    assert(!L.apakahISO("2026-13-01"), "bulan 13 harus ditolak");
    assert(!L.apakahISO("2026-02-30"), "30 Feb harus ditolak");
    assert(!L.apakahISO("09-10-2026"), "format salah harus ditolak");
    assert(!L.apakahISO(null), "null harus ditolak");
  });

  uji("apakahJam menerima HH:MM valid dan menolak yang salah", function () {
    assert(L.apakahJam("05:00"));
    assert(L.apakahJam("23:59"));
    assert(!L.apakahJam("24:00"), "jam 24 harus ditolak");
    assert(!L.apakahJam("12:60"), "menit 60 harus ditolak");
    assert(!L.apakahJam("7:00"), "tanpa leading zero harus ditolak");
    assert(!L.apakahJam("siang"), "teks harus ditolak");
  });

  uji("jamKeMenit dan menitKeJam saling mengunci", function () {
    assertSama(L.jamKeMenit("05:00"), 300);
    assertSama(L.jamKeMenit("23:59"), 1439);
    assertSama(L.menitKeJam(300), "05:00");
    assertSama(L.menitKeJam(90), "01:30");
    assertSama(L.menitKeJam(L.jamKeMenit("17:42")), "17:42");
  });

  uji("tambahHari melewati batas bulan dan tahun", function () {
    assertSama(L.tambahHari("2026-01-31", 1), "2026-02-01");
    assertSama(L.tambahHari("2026-12-31", 1), "2027-01-01");
    assertSama(L.tambahHari("2026-03-01", -1), "2026-02-28");
  });

  uji("mingguDari selalu diawali Senin dan berisi 7 hari", function () {
    const m = L.mingguDari("2026-09-30");   // Rabu
    assertSama(m.length, 7, "jumlah hari");
    assertSama(m[0], "2026-09-28", "Senin");
    assertSama(m[6], "2026-10-04", "Minggu");
    assertSama(L.namaHari(m[0]), "Senin");
    assertSama(L.namaHari(m[6]), "Minggu");
  });

  uji("mingguDari pada hari Senin tidak mundur", function () {
    const m = L.mingguDari("2026-09-28");
    assertSama(m[0], "2026-09-28");
  });

  uji("indeksHari: Senin=0 sampai Minggu=6", function () {
    assertSama(L.indeksHari("2026-09-28"), 0);
    assertSama(L.indeksHari("2026-10-04"), 6);
    assertSama(L.indeksHari("2026-10-03"), 5);
  });

  uji("tanggalPendek menghasilkan label pendek", function () {
    assertSama(L.tanggalPendek("2026-10-09"), "09 Okt");
    assertSama(L.tanggalPendek("2026-01-05"), "05 Jan");
  });

  /* =========================================================
   * B. DETEKSI BENTROK & BLOK
   * ========================================================= */

  uji("bentrok: tumpang tindih parsial terdeteksi", function () {
    const d = [blokJam("a", "08:00", "10:00"), blokJam("b", "09:30", "11:00")];
    assertSama(L.cariBentrok(d).length, 1, "jumlah pasangan bentrok");
  });

  uji("bentrok: dua blok bersentuhan di batas jam TIDAK dianggap bentrok", function () {
    const d = [blokJam("a", "08:00", "09:00"), blokJam("b", "09:00", "10:00")];
    assertSama(L.cariBentrok(d).length, 0, "seharusnya tidak bentrok");
  });

  uji("bentrok: dua blok identik terdeteksi", function () {
    const d = [blokJam("a", "10:00", "11:00"), blokJam("b", "10:00", "11:00")];
    assertSama(L.cariBentrok(d).length, 1);
    assertSama(L.cariBentrok(d)[0].idA, "a");
    assertSama(L.cariBentrok(d)[0].idB, "b");
  });

  uji("bentrok: blok yang tertanam di dalam blok lain terdeteksi", function () {
    const d = [blokJam("a", "08:00", "12:00"), blokJam("b", "09:00", "10:00")];
    assertSama(L.cariBentrok(d).length, 1);
  });

  uji("bentrok: blok saling menyilang (mulai A < mulai B < selesai A < selesai B)", function () {
    const d = [blokJam("a", "08:00", "10:00"), blokJam("b", "09:00", "11:00")];
    assertSama(L.cariBentrok(d).length, 1);
  });

  uji("bentrok: jadwal berurutan tanpa tumpang tindih bersih", function () {
    const d = [
      blokJam("a", "06:00", "07:00"),
      blokJam("b", "07:00", "08:00"),
      blokJam("c", "08:30", "09:00")
    ];
    assertSama(L.cariBentrok(d).length, 0);
  });

  uji("bentrok: tiga blok saling tumpang tindih menghasilkan tiga pasangan", function () {
    const d = [
      blokJam("a", "08:00", "11:00"),
      blokJam("b", "09:00", "12:00"),
      blokJam("c", "10:00", "13:00")
    ];
    assertSama(L.cariBentrok(d).length, 3);
    const set = L.idBentrok(d);
    assert(set.a && set.b && set.c, "semua blok terlibat bentrok");
  });

  uji("idBentrok kosong bila tidak ada bentrok", function () {
    const d = [blokJam("a", "08:00", "09:00")];
    assertSama(Object.keys(L.idBentrok(d)).length, 0);
  });

  uji("durasiBlok dihitung dalam menit", function () {
    assertSama(L.durasiBlok({ mulai: "08:00", selesai: "10:15" }), 135);
    assertSama(L.durasiBlok({ mulai: "23:00", selesai: "23:30" }), 30);
    assertSama(L.durasiBlok({ mulai: "05:00", selesai: "23:00" }), 1080);
  });

  uji("validasiBlok menolak jam selesai sama dengan jam mulai", function () {
    const g = L.validasiBlok({ judul: "X", kategori: "Belajar", mulai: "08:00", selesai: "08:00" }, []);
    assert(galatMemuat(g, "setelah jam mulai"), "pesan galat tidak muncul");
  });

  uji("validasiBlok menolak jam selesai sebelum jam mulai", function () {
    const g = L.validasiBlok({ judul: "X", kategori: "Belajar", mulai: "10:00", selesai: "09:00" }, []);
    assert(galatMemuat(g, "setelah jam mulai"));
  });

  uji("validasiBlok menolak judul kosong", function () {
    const g = L.validasiBlok({ judul: "  ", kategori: "Belajar", mulai: "08:00", selesai: "09:00" }, []);
    assert(galatMemuat(g, "Judul"));
  });

  uji("validasiBlok menolak jam format salah", function () {
    const g = L.validasiBlok({ judul: "X", kategori: "Belajar", mulai: "8:00", selesai: "09:00" }, []);
    assert(galatMemuat(g, "HH:MM"));
  });

  uji("validasiBlok menerima blok valid tanpa galat", function () {
    const g = L.validasiBlok({ judul: "Kuliah", kategori: "Kuliah", mulai: "08:00", selesai: "10:00" }, []);
    assertSama(g.length, 0, JSON.stringify(g));
  });

  uji("validasiBlok memberi PERINGATAN bila menabrak blok lain", function () {
    const lain = [blokJam("a", "09:00", "10:00")];
    const g = L.validasiBlok({ judul: "Baru", kategori: "Belajar", mulai: "09:30", selesai: "10:30" }, lain);
    assert(galatMemuat(g, "PERINGATAN"));
  });

  uji("validasiBlok tanpa peringatan bila hanya bersentuhan batas jam", function () {
    const lain = [blokJam("a", "08:00", "09:00")];
    const g = L.validasiBlok({ judul: "Baru", kategori: "Belajar", mulai: "09:00", selesai: "10:00" }, lain);
    assertSama(g.length, 0, JSON.stringify(g));
  });

  uji("persentaseSelesai menghitung blok tercentang", function () {
    const d = [
      { selesai_: true }, { selesai_: false }, { selesai_: true }, { selesai_: true }
    ];
    assertSama(L.persentaseSelesai(d), 75);
    assertSama(L.persentaseSelesai([]), 0, "daftar kosong harus 0");
    assertSama(L.persentaseSelesai(null), 0, "null harus 0");
  });

  /* =========================================================
   * C. STREAK KEBIASAAN
   * ========================================================= */

  uji("streak: hari berurutan dihitung penuh", function () {
    const s = L.hitungStreak(["2026-10-07", "2026-10-08", "2026-10-09"], "2026-10-09");
    assertSama(s.streak, 3);
  });

  uji("streak: celah satu hari memutus rangkaian", function () {
    // 05 & 06 tercentang lalu ada celah pada 07, hari ini 09, kemarin 08 tercentang
    const s = L.hitungStreak(
      ["2026-10-05", "2026-10-06", "2026-10-08"], "2026-10-09");
    assertSama(s.streak, 1, "hanya kemarin yang berurutan dengan hari ini");
  });

  uji("streak: rangkaian panjang sebelum celah tidak ikut terhitung", function () {
    const s = L.hitungStreak(
      ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-05", "2026-10-06"], "2026-10-07");
    // hari ini (07) belum dicentang, kemarin (06) tercentang -> hitung 06,05 lalu celah
    assertSama(s.streak, 2);
  });

  uji("streak: hari ini belum dicentang tapi kemarin tercentang tetap jalan", function () {
    const s = L.hitungStreak(["2026-10-08"], "2026-10-09");
    assertSama(s.streak, 1);
  });

  uji("streak: hari ini dan kemarin tidak dicentang hasilnya 0", function () {
    assertSama(L.hitungStreak(["2026-10-05"], "2026-10-09").streak, 0);
    assertSama(L.hitungStreak([], "2026-10-09").streak, 0);
  });

  uji("streak: tanggal masa depan diabaikan (tidak bikin streak aneh)", function () {
    const s = L.hitungStreak(["2026-10-12"], "2026-10-09");
    assertSama(s.streak, 0);
  });

  uji("streak terpanjang mengambil rangkaian terpanjang", function () {
    const t = L.streakTerpanjang(
      ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-05", "2026-10-06"]);
    assertSama(t, 3);
  });

  uji("streak terpanjang: daftar kosong = 0", function () {
    assertSama(L.streakTerpanjang([]), 0);
    assertSama(L.streakTerpanjang(null), 0);
  });

  uji("streak terpanjang: satu hari saja = 1 dan urutan acak tak berpengaruh", function () {
    assertSama(L.streakTerpanjang(["2026-10-04"]), 1);
    const acak = ["2026-10-06", "2026-10-01", "2026-10-05", "2026-10-02", "2026-10-03"];
    assertSama(L.streakTerpanjang(acak), 3, "urutan input tidak boleh memengaruhi");
  });

  uji("streakSaatIni mengembalikan angka saja", function () {
    assertSama(L.streakSaatIni(["2026-10-08", "2026-10-09"], "2026-10-09"), 2);
  });

  uji("persentaseKebiasaanMinggu menghitung entri terpenuhi/total", function () {
    const minggu = ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"];
    const kebiasaan = [
      { riwayat: { "2026-09-28": true, "2026-09-29": true } },
      { riwayat: { "2026-09-28": true } }
    ];
    const r = L.persentaseKebiasaanMinggu(kebiasaan, minggu);
    assertSama(r.terpenuhi, 3);
    assertSama(r.total, 14);
    assertSama(r.persen, 21, "3/14 dibulatkan");
  });

  uji("persentaseKebiasaanMinggu tanpa kebiasaan = 0", function () {
    const r = L.persentaseKebiasaanMinggu([], ["2026-09-28"]);
    assertSama(r.persen, 0);
    assertSama(r.total, 0);
  });

  /* =========================================================
   * D. STATISTIK MINGGUAN & PEMBULATAN
   * ========================================================= */

  // Minggu uji: Senin 2026-09-28 .. Minggu 2026-10-04
  const MINGGU = L.mingguDari("2026-09-30");

  function dataStatistik() {
    return {
      blok: [
        { tanggal: MINGGU[0], judul: "A", kategori: "Belajar", mulai: "08:00", selesai: "10:00", selesai_: true },
        { tanggal: MINGGU[0], judul: "B", kategori: "Kuliah", mulai: "10:00", selesai: "11:00", selesai_: false },
        { tanggal: MINGGU[1], judul: "C", kategori: "Belajar", mulai: "09:00", selesai: "10:30", selesai_: true },
        { tanggal: MINGGU[2], judul: "D", kategori: "Olahraga", mulai: "08:00", selesai: "08:45", selesai_: false },
        { tanggal: MINGGU[6], judul: "E", kategori: "Belajar", mulai: "20:00", selesai: "21:00", selesai_: false },
        // Di luar minggu (Senin berikutnya) — tidak boleh ikut terhitung
        { tanggal: L.tambahHari(MINGGU[6], 1), judul: "F", kategori: "Belajar", mulai: "08:00", selesai: "18:00" },
        // Sebelum minggu (Minggu sebelumnya) — tidak boleh ikut terhitung
        { tanggal: L.tambahHari(MINGGU[0], -1), judul: "G", kategori: "Belajar", mulai: "08:00", selesai: "18:00" }
      ],
      riwayatPomodoro: [
        { tanggal: MINGGU[0], jenis: "fokus" },
        { tanggal: MINGGU[1], jenis: "fokus" },
        { tanggal: MINGGU[2], jenis: "pendek" },   // istirahat tidak dihitung sesi
        { tanggal: MINGGU[6], jenis: "fokus" },
        { tanggal: L.tambahHari(MINGGU[6], 1), jenis: "fokus" }  // di luar minggu
      ],
      kebiasaan: [
        { riwayat: (function () { const r = {}; r[MINGGU[0]] = true; r[MINGGU[1]] = true; return r; })() }
      ]
    };
  }

  uji("statistik: blok di luar minggu tidak dihitung (batas minggu)", function () {
    const s = L.statistikMinggu(dataStatistik(), MINGGU, {});
    // 120+60+90+45+60 = 375 menit (blok F & G di luar minggu tidak ikut)
    assertSama(s.totalMenit, 375, "total menit dalam minggu");
  });

  uji("statistik: total jam per kategori", function () {
    const s = L.statistikMinggu(dataStatistik(), MINGGU, {});
    // Belajar: 120 (Senin) + 90 (Selasa) + 60 (Minggu) = 270 menit = 4.5 jam
    assertSama(s.perKategori["Belajar"], 270, "menit Belajar");
    assertSama(s.perKategoriJam["Belajar"], 4.5, "jam Belajar");
    assertSama(s.perKategori["Kuliah"], 60);
    assertSama(s.perKategori["Olahraga"], 45);
    assert(s.perKategori["Belajar"] !== undefined, "Belajar harus ada");
  });

  uji("statistik: total jam belajar terpisah dari total keseluruhan", function () {
    const s = L.statistikMinggu(dataStatistik(), MINGGU, {});
    assertSama(s.totalBelajarMenit, 270);
    assertSama(s.totalBelajarJam, 4.5);
    assertSama(s.totalJam, 6.25, "total keseluruhan 375 menit");
  });

  uji("statistik: sesi Pomodoro hanya jenis fokus dan dalam minggu", function () {
    const s = L.statistikMinggu(dataStatistik(), MINGGU, {});
    assertSama(s.sesiPomodoro, 3);
  });

  uji("statistik: hari paling produktif diambil dari total menit harian", function () {
    const s = L.statistikMinggu(dataStatistik(), MINGGU, {});
    assertSama(s.hariProduktif, MINGGU[0], "Senin paling produktif (180 menit)");
  });

  uji("statistik: perHari terisi untuk seluruh hari minggu", function () {
    const s = L.statistikMinggu(dataStatistik(), MINGGU, {});
    MINGGU.forEach(function (t) {
      assert(s.perHari[t] !== undefined, "hari " + t + " harus ada");
    });
    assertSama(s.perHari[MINGGU[0]].menit, 180);
    assertSama(s.perHari[MINGGU[0]].blokSelesai, 1);
    assertSama(s.perHari[MINGGU[6]].menit, 60);
    assertSama(s.perHari[MINGGU[3]].menit, 0, "kamis tanpa blok");
  });

  uji("statistik: persentase kebiasaan mingguan ikut terhitung", function () {
    const s = L.statistikMinggu(dataStatistik(), MINGGU, {});
    assertSama(s.kebiasaanTerpenuhi, 2);
    assertSama(s.kebiasaanTotal, 7, "1 kebiasaan × 7 hari (minggu lampau)");
    assertSama(s.kebiasaanPersen, 29, "2/7 dibulatkan");
  });

  uji("statistik: capaian target belajar mingguan", function () {
    const s = L.statistikMinggu(dataStatistik(), MINGGU, { targetBelajarMinggu: 6 });
    // 4.5 jam dari target 6 jam = 75%
    assertSama(s.capaianBelajar, 75);
    const s3 = L.statistikMinggu(dataStatistik(), MINGGU, { targetBelajarMinggu: 4 });
    assertSama(s3.capaianBelajar, 100, "lebih dari target tetap 100");
    const s2 = L.statistikMinggu(dataStatistik(), MINGGU, { targetBelajarMinggu: 2 });
    assertSama(s2.capaianBelajar, 100, "dibatasi 100%");
  });

  uji("statistik: minggu kosong tidak error dan hasilnya nol", function () {
    const s = L.statistikMinggu({ blok: [], kebiasaan: [], riwayatPomodoro: [] }, MINGGU, {});
    assertSama(s.totalMenit, 0);
    assertSama(s.sesiPomodoro, 0);
    assertSama(s.hariProduktif, null, "tidak ada hari produktif");
    assertSama(s.kebiasaanPersen, 0);
  });

  uji("pembulatanJam dibulatkan dua tempat desimal", function () {
    assertSama(L.pembulatanJam(90), 1.5);
    assertSama(L.pembulatanJam(45), 0.75);
    assertSama(L.pembulatanJam(100), 1.67, "100 menit = 1.666... -> 1.67");
    assertSama(L.pembulatanJam(1), 0.02, "1 menit = 0.0166... -> 0.02");
    assertSama(L.pembulatanJam(0), 0);
    assertSama(L.pembulatanJam(61), 1.02);
  });

  uji("pembulatanJam mendukung jumlah desimal lain", function () {
    assertSama(L.pembulatanJam(100, 1), 1.7);
    assertSama(L.pembulatanJam(100, 0), 2);
  });

  uji("menitKeJamDesimal tidak dibulatkan berlebih", function () {
    assertSama(L.menitKeJamDesimal(90), 1.5);
    assertSama(L.menitKeJamDesimal(100), 1.67, "dibulatkan 2 desimal agar stabil");
  });

  /* =========================================================
   * E. SIKLUS POMODORO
   * ========================================================= */

  uji("pomodoro: sesi pertama selalu fokus 25 menit", function () {
    const s = L.sesiPomodoroBerikutnya(0, {});
    assertSama(s.jenis, "fokus");
    assertSama(s.durasi, 25);
  });

  uji("pomodoro: setelah 1 sesi fokus -> istirahat pendek", function () {
    const s = L.sesiPomodoroBerikutnya(1, {});
    assertSama(s.jenis, "pendek");
    assertSama(s.durasi, 5);
    assertSama(s.sesiKe, 2, "sesi fokus berikutnya ke-2");
  });

  uji("pomodoro: sesi ke-4 menghasilkan istirahat panjang 15 menit", function () {
    const s = L.sesiPomodoroBerikutnya(4, {});
    assertSama(s.jenis, "panjang");
    assertSama(s.durasi, 15);
    assertSama(s.sesiKe, 1, "siklus baru dimulai lagi dari sesi 1");
  });

  uji("pomodoro: sesi ke-8 juga istirahat panjang (kelipatan siklus)", function () {
    const s = L.sesiPomodoroBerikutnya(8, {});
    assertSama(s.jenis, "panjang");
    assertSama(s.durasi, 15);
  });

  uji("pomodoro: sesi ke-3 -> pendek, sesi ke-5 -> pendek (bukan panjang)", function () {
    assertSama(L.sesiPomodoroBerikutnya(3, {}).jenis, "pendek");
    assertSama(L.sesiPomodoroBerikutnya(5, {}).jenis, "pendek");
    assertSama(L.sesiPomodoroBerikutnya(7, {}).jenis, "pendek", "sesi ke-7 masih pendek");
  });

  uji("pomodoro: panjang siklus bisa diubah (mis. 2 sesi)", function () {
    const cfg = { fokus: 30, istirahatPendek: 7, istirahatPanjang: 20, panjangSiklus: 2 };
    assertSama(L.sesiPomodoroBerikutnya(0, cfg).durasi, 30);
    assertSama(L.sesiPomodoroBerikutnya(2, cfg).jenis, "panjang");
    assertSama(L.sesiPomodoroBerikutnya(2, cfg).durasi, 20);
    assertSama(L.sesiPomodoroBerikutnya(1, cfg).durasi, 7);
    assertSama(L.sesiPomodoroBerikutnya(3, cfg).jenis, "pendek", "sesi ke-3 (ganjil) tetap pendek");
    assertSama(L.sesiPomodoroBerikutnya(4, cfg).jenis, "panjang", "kelipatan 2 berikutnya");
  });

  uji("pomodoro: nilai durasi tidak valid jatuh ke default", function () {
    const c = L.normalisasiPomodoro({ fokus: -5, istirahatPendek: "abc", istirahatPanjang: null, panjangSiklus: 0 });
    assertSama(c.fokus, 25);
    assertSama(c.istirahatPendek, 5);
    assertSama(c.istirahatPanjang, 15);
    assertSama(c.panjangSiklus, 4);
    const d = L.normalisasiPomodoro(undefined);
    assertSama(d.fokus, 25);
  });

  uji("pomodoro: daftarSiklus berurutan dan berakhir istirahat panjang", function () {
    const d = L.daftarSiklus({});
    assertSama(d.length, 8, "4 fokus + 4 istirahat");
    assertSama(d[0], "fokus");
    assertSama(d[7], "panjang");
    assertSama(d[6], "fokus");
    const d2 = L.daftarSiklus({ panjangSiklus: 2 });
    assertSama(d2.length, 4);
    assertSama(d2[3], "panjang");
  });

  /* =========================================================
   * F. VALIDASI IMPOR JSON
   * ========================================================= */

  const contohValid = {
    versiSkema: 1,
    pengaturan: { tema: "gelap", bunyi: false, pomodoro: { fokus: 30 }, targetBelajarMinggu: 8 },
    kategori: [{ nama: "Belajar", warna: "#4f7cff" }],
    blok: [
      { id: "b1", tanggal: "2026-09-28", judul: "Kuliah", kategori: "Kuliah", mulai: "08:00", selesai: "10:00" }
    ],
    catatan: { "2026-09-28": "halo" },
    kebiasaan: [{ id: "k1", nama: "Baca", ikon: "📖", target: 1, riwayat: {} }],
    riwayatPomodoro: []
  };

  uji("impor: objek valid diterima dengan data lengkap", function () {
    const r = L.validasiImpor(contohValid);
    assert(r.valid, "seharusnya valid: " + JSON.stringify(r.galat));
    assertSama(r.galat.length, 0);
    assertSama(r.data.blok.length, 1);
    assertSama(r.data.pengaturan.tema, "gelap");
    assertSama(r.data.pengaturan.pomodoro.fokus, 30, "durasi custom terjaga");
    assertSama(r.data.versiSkema, L.VERSI_SKEMA);
  });

  uji("impor: file bukan objek (rusak) ditolak", function () {
    assertSama(L.validasiImpor(null).valid, false);
    assertSama(L.validasiImpor("bukan objek").valid, false);
    assertSama(L.validasiImpor([1, 2, 3]).valid, false);
    assertSama(L.validasiImpor(42).valid, false);
  });

  uji("impor: JSON hancur (parse error) tertangkap pemanggil", function () {
    let galat = null;
    try { JSON.parse("{rusak tanpa penutup"); } catch (e) { galat = e; }
    assert(galat !== null, "JSON.parse harus melempar galat");
    // Pemanggil mengubahnya jadi kegagalan validasi, bukan crash
    assertSama(L.validasiImpor(null).valid, false);
  });

  uji("impor: versi skema salah ditolak dengan pesan jelas", function () {
    const r = L.validasiImpor({ versiSkema: 99, blok: [] });
    assertSama(r.valid, false);
    assert(galatMemuat(r.galat, "Versi skema"), "pesan harus menyebut versi: " + JSON.stringify(r.galat));
    assert(galatMemuat(r.galat, "99"), "pesan menyertakan versi file");
  });

  uji("impor: objek tanpa kunci versiSkema ditolak", function () {
    const r = L.validasiImpor({ blok: [] });
    assertSama(r.valid, false);
    assert(galatMemuat(r.galat, "versiSkema"));
  });

  uji("impor: struktur salah (blok bukan array) ditolak", function () {
    const r = L.validasiImpor({ versiSkema: 1, blok: "kacau" });
    assertSama(r.valid, false);
    assert(galatMemuat(r.galat, "array"));
  });

  uji("impor: blok dengan tanggal rusak ditolak", function () {
    const r = L.validasiImpor({
      versiSkema: 1,
      blok: [{ judul: "X", kategori: "Belajar", tanggal: "31-10-2026", mulai: "08:00", selesai: "09:00" }]
    });
    assertSama(r.valid, false);
    assert(galatMemuat(r.galat, "tanggal"));
  });

  uji("impor: blok dengan jam selesai <= mulai ditolak", function () {
    const r = L.validasiImpor({
      versiSkema: 1,
      blok: [{ judul: "X", kategori: "Belajar", tanggal: "2026-10-01", mulai: "10:00", selesai: "09:00" }]
    });
    assertSama(r.valid, false);
    assert(galatMemuat(r.galat, "setelah jam mulai"));
  });

  uji("impor: kebiasaan bukan array ditolak", function () {
    const r = L.validasiImpor({ versiSkema: 1, blok: [], kebiasaan: "ya" });
    assertSama(r.valid, false);
    assert(galatMemuat(r.galat, "kebiasaan"));
  });

  uji("impor: kunci opsional yang hilang diganti default", function () {
    // Hanya versiSkema + blok; kunci lain boleh hilang dan diganti default
    const r = L.validasiImpor({ versiSkema: 1, blok: [] });
    assert(r.valid, "seharusnya valid: " + JSON.stringify(r.galat));
    assert(Array.isArray(r.data.kebiasaan), "kebiasaan default array kosong");
    assert(r.data.catatan && typeof r.data.catatan === "object", "catatan default objek");
  });

  uji("impor: objek minimal valid (hanya versiSkema + blok) menghasilkan default lengkap", function () {
    const r = L.validasiImpor({ versiSkema: 1, blok: [] });
    assert(r.valid, "seharusnya valid: " + JSON.stringify(r.galat));
    assert(Array.isArray(r.data.kebiasaan), "default kebiasaan");
    assert(Array.isArray(r.data.riwayatPomodoro), "default riwayatPomodoro");
    assert(r.data.catatan && typeof r.data.catatan === "object", "default catatan");
    assert(Array.isArray(r.data.kategori) && r.data.kategori.length > 0, "default kategori");
    assert(typeof r.data.pengaturan.targetBelajarMinggu === "number", "default target mingguan");
  });

  uji("impor: objek hasil impor bisa diserialisasi ulang tanpa hilang", function () {
    const r = L.validasiImpor(contohValid);
    assert(r.valid);
    const teks = L.serialisasi(r.data);
    const lagi = L.validasiImpor(JSON.parse(teks));
    assert(lagi.valid, "round-trip gagal: " + JSON.stringify(lagi.galat));
    assertSama(lagi.data.blok[0].judul, "Kuliah");
  });

  uji("dataKosong memenuhi skema (lolos validasiImpor sendiri)", function () {
    const r = L.validasiImpor(L.dataKosong());
    assert(r.valid, "data bawaan harus valid: " + JSON.stringify(r.galat));
    assertSama(L.dataKosong().versiSkema, L.VERSI_SKEMA);
  });

  /* =========================================================
   * G. DATASET CONTOH
   * ========================================================= */

  uji("contoh: dataset satu minggu penuh (7 hari) lolos validasi impor", function () {
    if (!C) throw new Error("contoh.js belum dimuat");
    const d = C.buatContoh("2026-09-30");
    const r = L.validasiImpor(d);
    assert(r.valid, "data contoh harus valid: " + JSON.stringify(r.galat));
    const tanggalSet = {};
    d.blok.forEach(function (b) { tanggalSet[b.tanggal] = true; });
    assertSama(Object.keys(tanggalSet).length, 7, "harus mencakup 7 hari");
    assert(d.blok.length > 20, "minimal 20 blok contoh");
    assert(d.kebiasaan.length >= 4, "minimal 4 kebiasaan contoh");
    assert(d.riwayatPomodoro.length > 0, "ada sesi pomodoro contoh");
  });

  uji("contoh: tidak ada blok bentrok pada data contoh", function () {
    if (!C) throw new Error("contoh.js belum dimuat");
    const d = C.buatContoh("2026-09-30");
    const perTanggal = {};
    d.blok.forEach(function (b) {
      perTanggal[b.tanggal] = perTanggal[b.tanggal] || [];
      perTanggal[b.tanggal].push(b);
    });
    Object.keys(perTanggal).forEach(function (t) {
      const bentrok = L.cariBentrok(perTanggal[t]);
      assertSama(bentrok.length, 0, "ada bentrok pada " + t + ": " + JSON.stringify(bentrok));
    });
  });

  uji("contoh: semua blok jam valid dan selesai setelah mulai", function () {
    if (!C) throw new Error("contoh.js belum dimuat");
    const d = C.buatContoh("2026-09-30");
    d.blok.forEach(function (b) {
      assert(L.apakahJam(b.mulai), "jam mulai rusak: " + b.mulai);
      assert(L.apakahJam(b.selesai), "jam selesai rusak: " + b.selesai);
      assert(L.jamKeMenit(b.selesai) > L.jamKeMenit(b.mulai), "selesai <= mulai pada " + b.id);
      assert(L.apakahISO(b.tanggal), "tanggal rusak: " + b.tanggal);
      assert(b.judul && b.judul.length > 0, "judul kosong");
    });
  });

  uji("contoh: kebiasaan contoh punya streak beragam (1 celah, dst.)", function () {
    if (!C) throw new Error("contoh.js belum dimuat");
    const d = C.buatContoh("2026-09-30");
    const streaks = d.kebiasaan.map(function (k) {
      return L.streakSaatIni(Object.keys(k.riwayat), "2026-09-30");
    });
    const adaBervariasi = streaks.some(function (s) { return s >= 3; }) &&
      streaks.some(function (s) { return s <= 1; });
    assert(adaBervariasi, "seharusnya ada streak panjang dan pendek: " + JSON.stringify(streaks));
  });

  /* =========================================================
   * H. RINGKASAN & EKSEKUSI
   * ========================================================= */

  const ringkasan = {
    total: hasil.length,
    lulus: hasil.filter(function (h) { return h.lulus; }).length,
    gagal: hasil.filter(function (h) { return !h.lulus; }).length
  };

  /** Cetak hasil ke konsol (dipakai mode Node). */
  function cetak() {
    console.log("=== Tes Planner Harian (logika.js) ===");
    hasil.forEach(function (h, i) {
      const no = String(i + 1).padStart(2, "0");
      if (h.lulus) {
        console.log("  " + no + " ✓ " + h.nama);
      } else {
        console.log("  " + no + " ✗ " + h.nama);
        console.log("      -> " + h.pesan);
      }
    });
    console.log("---------------------------------------");
    console.log("Total: " + ringkasan.total +
      " | Lulus: " + ringkasan.lulus +
      " | Gagal: " + ringkasan.gagal);
    console.log(ringkasan.gagal === 0 ? "HASIL: SEMUA LULUS ✓" : "HASIL: ADA YANG GAGAL ✗");
  }

  const api = { hasil: hasil, ringkasan: ringkasan, uji: uji, cetak: cetak };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
    // Dijalankan langsung lewat "node tes.js" -> cetak & tandai kode keluar.
    if (require.main === module) {
      cetak();
      if (ringkasan.gagal > 0) process.exitCode = 1;
    }
  }
  if (glob) glob.TesPlanner = api;   // dipakai tes.html
})(typeof window !== "undefined" ? window : null);
