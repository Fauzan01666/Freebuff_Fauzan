/**
 * app.js — Antarmuka Planner Harian.
 * Berisi: penyimpanan localStorage (aman dari JSON rusak), rendering
 * seluruh tab, timer Pomodoro berbasis timestamp, ekspor/impor JSON.
 * Seluruh teks UI dan komentar dalam bahasa Indonesia.
 * Prinsip keamanan: TIDAK PERNAH memasukkan input pengguna lewat
 * innerHTML — semuanya lewat textContent/createElement.
 */
(function () {
  "use strict";

  const L = window.Logika;
  const C = window.Contoh;
  const KUNCI_DATA = "planner.data.v1";
  const NS_SVG = "http://www.w3.org/2000/svg";

  // Jika logika.js gagal dimuat, hentikan dengan pesan jelas.
  if (!L) {
    document.body.textContent = "Kesalahan: logika.js belum dimuat. Pastikan ketiga file berada di folder yang sama.";
    return;
  }

  /* =========================================================
   * 1. PENYIMPANAN (localStorage dengan cadangan memori)
   * ========================================================= */

  const Penyimpanan = (function () {
    let bisa = true;
    try {
      window.localStorage.setItem("__uji_penyimpanan", "1");
      window.localStorage.removeItem("__uji_penyimpanan");
    } catch (e) {
      bisa = false;   // file:// di beberapa peramban menolak localStorage
    }
    const cadangan = {};   // fallback bila localStorage tidak tersedia
    return {
      get tersedia() { return bisa; },
      ambil: function (kunci) {
        if (!bisa) return Object.prototype.hasOwnProperty.call(cadangan, kunci) ? cadangan[kunci] : null;
        try { return window.localStorage.getItem(kunci); } catch (e) { return null; }
      },
      simpan: function (kunci, nilai) {
        if (!bisa) { cadangan[kunci] = nilai; return false; }
        try { window.localStorage.setItem(kunci, nilai); return true; } catch (e) { return false; }
      },
      hapus: function (kunci) {
        if (!bisa) { delete cadangan[kunci]; return; }
        try { window.localStorage.removeItem(kunci); } catch (e) { /* abaikan */ }
      }
    };
  })();

  /* =========================================================
   * 2. KEADAAN APLIKASI
   * ========================================================= */

  const state = {
    data: null,
    tanggalAktif: L.hariIni(),   // tanggal yang dibuka di tab Hari Ini
    mingguAktif: L.hariIni(),    // minggu yang dibuka di tab Statistik
    editBlok: null,              // id blok yang sedang diubah
    editKebiasaan: null,         // id kebiasaan yang sedang diubah
    konfirmasiBentrok: false     // sudah ditekan 2× saat ada peringatan bentrok
  };

  const pesanMuat = [];   // pesan saat aplikasi dibuka (localStorage rusak, dll.)

  /** Muat data dari penyimpanan; tangani JSON rusak tanpa crash. */
  function muatData() {
    const teks = Penyimpanan.ambil(KUNCI_DATA);
    if (teks === null || teks === undefined || teks === "") return L.dataKosong();
    let objek = null;
    try {
      objek = JSON.parse(teks);
    } catch (e) {
      pesanMuat.push("Data tersimpan rusak (JSON tidak valid) dan diabaikan. Memulai dengan data kosong.");
      return L.dataKosong();
    }
    const hasil = L.validasiImpor(objek);
    if (!hasil.valid) {
      pesanMuat.push("Data tersimpan tidak sesuai skema dan diabaikan:\n• " + hasil.galat.join("\n• "));
      return L.dataKosong();
    }
    return hasil.data;
  }

  let peringatanSimpan = false;

  /** Simpan seluruh data ke penyimpanan (dipanggil setiap perubahan). */
  function simpanData() {
    const ok = Penyimpanan.simpan(KUNCI_DATA, L.serialisasi(state.data));
    if (!ok && !peringatanSimpan) {
      peringatanSimpan = true;
      beritahu("Penyimpanan lokal tidak tersedia — perubahan hanya bertahan selama halaman terbuka.", true);
    }
    perbaruiPratinjau();
  }

  /* =========================================================
   * 3. ALAT BANTU DOM
   * ========================================================= */

  /** Ambil elemen berdasarkan id. */
  function el(id) { return document.getElementById(id); }

  /** Elemen teks aman (anti-XSS): hanya textContent. */
  function buat(tag, kelas, teks) {
    const n = document.createElement(tag);
    if (kelas) n.className = kelas;
    if (teks !== undefined && teks !== null) n.textContent = teks;
    return n;
  }

  /** Elemen SVG dengan atribut + teks aman. */
  function buatSvg(tag, atribut, teks) {
    const n = document.createElementNS(NS_SVG, tag);
    Object.keys(atribut || {}).forEach(function (k) { n.setAttribute(k, atribut[k]); });
    if (teks !== undefined && teks !== null) n.textContent = teks;
    return n;
  }

  /** Validasi warna heksadesimal agar aman dipakai di style. */
  function amanWarna(w) {
    return typeof w === "string" && /^#[0-9a-fA-F]{6}$/.test(w) ? w : "#7f8fa6";
  }

  /** Angka -> teks jam gaya Indonesia (koma desimal). */
  function teksJam(angka) {
    return String(angka).replace(".", ",") + " jam";
  }

  /** id unik sederhana. */
  function idUnik(prefiks) {
    return prefiks + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /** Cari kategori berdasarkan nama. */
  function cariKategori(nama) {
    return state.data.kategori.find(function (k) { return k.nama === nama; }) || null;
  }

  /** Warna kategori (dengan fallback). */
  function warnaKategori(nama) {
    const k = cariKategori(nama);
    return amanWarna(k ? k.warna : "#7f8fa6");
  }

  let idNotifikasi = null;
  /** Tampilkan notifikasi toast. */
  function beritahu(pesan, gagal) {
    const n = el("notifikasi");
    if (!n) return;
    n.textContent = pesan;
    n.classList.toggle("gagal", !!gagal);
    n.hidden = false;
    // paksa reflow agar transisi berjalan
    void n.offsetWidth;
    n.classList.add("tampil");
    if (idNotifikasi) window.clearTimeout(idNotifikasi);
    idNotifikasi = window.setTimeout(function () {
      n.classList.remove("tampil");
      idNotifikasi = window.setTimeout(function () { n.hidden = true; }, 350);
    }, 3600);
  }

  /* =========================================================
   * 4. TAB & TEMA
   * ========================================================= */

  const NAMA_TAB = ["hariini", "kebiasaan", "pomodoro", "statistik", "pengaturan"];

  /** Buka satu tab dan tutup yang lain. */
  function bukaTab(nama) {
    NAMA_TAB.forEach(function (t) {
      const tab = el("tab-" + t);
      const panel = el("panel-" + t);
      const aktif = t === nama;
      tab.setAttribute("aria-selected", aktif ? "true" : "false");
      tab.tabIndex = aktif ? 0 : -1;
      panel.hidden = !aktif;
      panel.classList.toggle("aktif", aktif);
    });
    renderPerTab(nama);
  }

  /** Render panel yang baru dibuka (menghindari kerja sia-sia). */
  function renderPerTab(nama) {
    if (nama === "hariini") renderHariIni();
    else if (nama === "kebiasaan") renderKebiasaan();
    else if (nama === "pomodoro") renderPomodoro();
    else if (nama === "statistik") renderStatistik();
    else if (nama === "pengaturan") renderPengaturan();
  }

  /** Terapkan tema ke halaman dan sinkronkan kontrol. */
  function terapkanTema(tema) {
    const bersih = tema === "gelap" ? "gelap" : "terang";
    state.data.pengaturan.tema = bersih;
    document.documentElement.setAttribute("data-tema", bersih);
    const gelap = bersih === "gelap";
    el("ikonTema").textContent = gelap ? "☀️" : "🌙";
    el("labelTema").textContent = gelap ? "Mode terang" : "Mode gelap";
    el("tombolTema").setAttribute("aria-pressed", gelap ? "true" : "false");
    el("temaTerang").checked = !gelap;
    el("temaGelap").checked = gelap;
  }

  function pasangTab() {
    NAMA_TAB.forEach(function (t) {
      const tombol = el("tab-" + t);
      tombol.addEventListener("click", function () { bukaTab(t); });
      tombol.addEventListener("keydown", function (e) {
        const i = NAMA_TAB.indexOf(t);
        let tuju = null;
        if (e.key === "ArrowRight") tuju = NAMA_TAB[(i + 1) % NAMA_TAB.length];
        else if (e.key === "ArrowLeft") tuju = NAMA_TAB[(i - 1 + NAMA_TAB.length) % NAMA_TAB.length];
        else if (e.key === "Home") tuju = NAMA_TAB[0];
        else if (e.key === "End") tuju = NAMA_TAB[NAMA_TAB.length - 1];
        if (tuju) {
          e.preventDefault();
          bukaTab(tuju);
          el("tab-" + tuju).focus();
        }
      });
    });
  }

  /* =========================================================
   * 5. TAB HARI INI — timeline, blok, bentrok, catatan
   * ========================================================= */

  const MULAI_TL = 5 * 60;     // timeline mulai 05:00
  const AKHIR_TL = 23 * 60;    // timeline berakhir 23:00
  const SPAN_TL = AKHIR_TL - MULAI_TL;

  /** Blok pada tanggal yang sedang dibuka. */
  function blokHariAktif() {
    return state.data.blok.filter(function (b) { return b.tanggal === state.tanggalAktif; })
      .sort(function (a, b) { return L.jamKeMenit(a.mulai) - L.jamKeMenit(b.mulai); });
  }

  /** Susun blok ke lajur-lajur agar blok yang tumpang tindih berdampingan. */
  function tataLajur(daftar) {
    const klaster = [];   // kelompok blok yang saling terhubung
    daftar.forEach(function (b) {
      const mulai = L.jamKeMenit(b.mulai);
      const selesai = L.jamKeMenit(b.selesai);
      const akhir = klaster[klaster.length - 1];
      if (!akhir || mulai >= akhir.akhir) klaster.push({ akhir: selesai, anggota: [b] });
      else {
        akhir.anggota.push(b);
        akhir.akhir = Math.max(akhir.akhir, selesai);
      }
    });
    const hasil = [];
    klaster.forEach(function (k) {
      const lajur = [];   // menit akhir tiap lajur
      const rute = [];
      k.anggota.forEach(function (b) {
        const mulai = L.jamKeMenit(b.mulai);
        const selesai = L.jamKeMenit(b.selesai);
        let i = lajur.findIndex(function (akh) { return akh <= mulai; });
        if (i === -1) { lajur.push(selesai); i = lajur.length - 1; }
        else lajur[i] = selesai;
        rute.push({ blok: b, lajur: i });
      });
      rute.forEach(function (r) {
        hasil.push({ blok: r.blok, lajur: r.lajur, totalLajur: lajur.length });
      });
    });
    return hasil;
  }

  /** Render garis jam pada timeline (05:00 sampai 23:00). */
  function renderLabelJam() {
    const wadah = el("labelJam");
    wadah.textContent = "";
    for (let jam = 5; jam <= 23; jam++) {
      const menit = jam * 60;
      const s = buat("span", null, String(jam).padStart(2, "0") + ":00");
      s.style.top = ((menit - MULAI_TL) / SPAN_TL * 100) + "%";
      wadah.appendChild(s);
    }
    // Garis putus-putus di area blok
    const area = el("areaBlok");
    Array.prototype.slice.call(area.querySelectorAll(".garis-jam"))
      .forEach(function (g) { g.remove(); });
    for (let jam = 5; jam <= 23; jam++) {
      const g = buat("div", "garis-jam");
      g.style.top = ((jam * 60 - MULAI_TL) / SPAN_TL * 100) + "%";
      area.appendChild(g);
    }
  }

  /** Render seluruh isi tab Hari Ini. */
  function renderHariIni() {
    const tgl = state.tanggalAktif;
    el("labelTanggal").textContent = L.tanggalPendek(tgl) + " " + tgl.slice(0, 4);
    el("labelHari").textContent = L.namaHari(tgl) + (tgl === L.hariIni() ? " · Hari ini" : "");
    el("salinKeTanggal").value = L.tambahHari(tgl, 1);

    const daftar = blokHariAktif();
    renderLabelJam();

    // --- Bentrok ---
    const pasangan = L.cariBentrok(daftar);
    const setBentrok = L.idBentrok(daftar);
    const kotak = el("kotakBentrok");
    const daftarBentrok = el("daftarBentrok");
    daftarBentrok.textContent = "";
    if (pasangan.length > 0) {
      pasangan.forEach(function (p) {
        const teks = p.a.mulai + "–" + p.a.selesai + " “" + p.a.judul + "”  ↔  " +
          p.b.mulai + "–" + p.b.selesai + " “" + p.b.judul + "”";
        daftarBentrok.appendChild(buat("li", null, teks));
      });
      kotak.hidden = false;
    } else {
      kotak.hidden = true;
    }

    // --- Blok pada timeline ---
    const area = el("areaBlok");
    Array.prototype.slice.call(area.querySelectorAll(".blok"))
      .forEach(function (b) { b.remove(); });

    let diLuarTimeline = 0;
    tataLajur(daftar).forEach(function (r) {
      const b = r.blok;
      const mulai = L.jamKeMenit(b.mulai);
      const selesai = L.jamKeMenit(b.selesai);
      if (selesai <= MULAI_TL || mulai >= AKHIR_TL) { diLuarTimeline++; return; }

      const atas = Math.max(mulai, MULAI_TL);
      const bawah = Math.min(selesai, AKHIR_TL);
      const kartu = buat("article", "blok");
      kartu.style.top = ((atas - MULAI_TL) / SPAN_TL * 100) + "%";
      kartu.style.height = ((bawah - atas) / SPAN_TL * 100) + "%";
      const lebar = 100 / r.totalLajur;
      kartu.style.left = "calc(" + (r.lajur * lebar) + "% + 3px)";
      kartu.style.width = "calc(" + lebar + "% - 6px)";
      kartu.style.setProperty("--warna-blok", warnaKategori(b.kategori));

      kartu.appendChild(buat("span", "blok-judul", b.judul));
      kartu.appendChild(buat("span", "blok-jam",
        b.mulai + "–" + b.selesai + " · " + b.kategori));

      if (setBentrok[b.id]) {
        kartu.classList.add("blok-bentrok");
        const lencana = buat("span", "lencana-bentrok", "⚠️");
        lencana.title = "Blok ini tumpang tindih dengan blok lain";
        kartu.appendChild(lencana);
      }
      if (b.selesai_ === true) kartu.classList.add("blok-selesai");

      // Centang selesai langsung dari timeline
      const centang = document.createElement("input");
      centang.type = "checkbox";
      centang.className = "blok-tandai-selesai";
      centang.checked = b.selesai_ === true;
      centang.setAttribute("aria-label", "Tandai selesai: " + b.judul);
      centang.dataset.id = b.id;
      kartu.appendChild(centang);

      const aksi = buat("div", "blok-aksi");
      const tUbah = buat("button", "tombol tombol-krem tombol-kecil", "Ubah");
      tUbah.type = "button";
      tUbah.dataset.aksi = "ubah";
      tUbah.dataset.id = b.id;
      tUbah.setAttribute("aria-label", "Ubah blok " + b.judul);
      const tHapus = buat("button", "tombol tombol-bahaya tombol-kecil", "Hapus");
      tHapus.type = "button";
      tHapus.dataset.aksi = "hapus";
      tHapus.dataset.id = b.id;
      tHapus.setAttribute("aria-label", "Hapus blok " + b.judul);
      aksi.appendChild(tUbah);
      aksi.appendChild(tHapus);
      kartu.appendChild(aksi);

      area.appendChild(kartu);
    });

    // --- Ringkasan & persentase selesai ---
    const totalMenit = daftar.reduce(function (a, b) { return a + L.durasiBlok(b); }, 0);
    const persen = L.persentaseSelesai(daftar);
    el("labelSelesai").textContent = persen + "% selesai";
    el("barSelesai").style.width = persen + "%";
    el("barSelesaiWadah").setAttribute("aria-valuenow", String(persen));

    let teks = daftar.length === 0
      ? "Belum ada blok pada tanggal ini. Tambahkan lewat formulir di samping."
      : daftar.length + " blok · total " + teksJam(L.pembulatanJam(totalMenit)) +
        " · " + daftar.filter(function (b) { return b.selesai_; }).length + " selesai";
    if (diLuarTimeline > 0) {
      teks += " · " + diLuarTimeline + " blok di luar rentang 05:00–23:00 tidak ditampilkan";
    }
    el("ringkasanHari").textContent = teks;

    // --- Catatan harian ---
    el("catatanHarian").value = state.data.catatan[tgl] || "";
    el("keteranganTimeline").textContent = pasangan.length > 0
      ? pasangan.length + " pasangan bentrok" : "Klik Ubah untuk mengedit blok";
  }

  /** Set form blok ke keadaan siap tambah baru. */
  function resetFormBlok() {
    state.editBlok = null;
    state.konfirmasiBentrok = false;
    el("formBlok").reset();
    el("blokId").value = "";
    el("blokMulai").value = "08:00";
    el("blokSelesai").value = "09:00";
    el("pesanBlok").textContent = "";
    el("judulFormBlok").textContent = "Tambah blok waktu";
    el("tombolSimpanBlok").textContent = "Simpan blok";
    el("blokBatal").hidden = true;
  }

  /** Isi select kategori pada form blok. */
  function isiPilihanKategori() {
    const sel = el("blokKategori");
    const nilai = sel.value;
    sel.textContent = "";
    state.data.kategori.forEach(function (k) {
      const o = document.createElement("option");
      o.value = k.nama;
      o.textContent = k.nama;
      sel.appendChild(o);
    });
    if (nilai && state.data.kategori.some(function (k) { return k.nama === nilai; })) sel.value = nilai;
  }

  /** Simpan blok dari formulir (validasi + peringatan bentrok 2 langkah). */
  function simpanBlokDariForm(e) {
    e.preventDefault();
    const id = el("blokId").value || null;
    const kandidat = {
      id: id || idUnik("b"),
      tanggal: state.tanggalAktif,
      judul: el("blokJudul").value.trim(),
      kategori: el("blokKategori").value,
      mulai: el("blokMulai").value,
      selesai: el("blokSelesai").value,
      catatan: el("blokCatatan").value.trim(),
      selesai_: el("blokCentang").checked
    };

    // Validasi dasar oleh logika.js (tanpa daftar bentrok dulu)
    const galat = L.validasiBlok(kandidat, null);
    if (galat.length > 0) {
      el("pesanBlok").textContent = galat.join("\n");
      state.konfirmasiBentrok = false;
      return;
    }
    // Rentang timeline
    if (L.jamKeMenit(kandidat.mulai) < MULAI_TL || L.jamKeMenit(kandidat.selesai) > AKHIR_TL) {
      el("pesanBlok").textContent = "Blok harus berada dalam rentang timeline 05:00–23:00.";
      state.konfirmasiBentrok = false;
      return;
    }
    // Peringatan bentrok: minta konfirmasi kedua sebelum tetap menyimpan
    const lain = blokHariAktif().filter(function (b) { return b.id !== kandidat.id; });
    const adaBentrok = lain.some(function (b) {
      return L.jamKeMenit(kandidat.mulai) < L.jamKeMenit(b.selesai) &&
        L.jamKeMenit(b.mulai) < L.jamKeMenit(kandidat.selesai);
    });
    if (adaBentrok && !state.konfirmasiBentrok) {
      state.konfirmasiBentrok = true;
      el("pesanBlok").textContent =
        "⚠️ PERINGATAN: jadwal ini tumpang tindih dengan blok lain.\n" +
        "Tekan “Simpan blok” sekali lagi untuk menyimpan tetap saja.";
      return;
    }

    if (id) {
      const i = state.data.blok.findIndex(function (b) { return b.id === id; });
      if (i !== -1) state.data.blok[i] = kandidat;
    } else {
      state.data.blok.push(kandidat);
    }
    simpanData();
    resetFormBlok();
    renderHariIni();
    beritahu(id ? "Blok berhasil diubah." : "Blok berhasil ditambahkan.");
  }

  /** Isi form untuk mengubah blok. */
  function ubahBlok(id) {
    const b = state.data.blok.find(function (x) { return x.id === id; });
    if (!b) return;
    state.editBlok = id;
    state.konfirmasiBentrok = false;
    el("blokId").value = b.id;
    el("blokJudul").value = b.judul;
    isiPilihanKategori();
    el("blokKategori").value = b.kategori;
    if (!el("blokKategori").value) el("blokKategori").selectedIndex = 0;
    el("blokMulai").value = b.mulai;
    el("blokSelesai").value = b.selesai;
    el("blokCatatan").value = b.catatan || "";
    el("blokCentang").checked = b.selesai_ === true;
    el("pesanBlok").textContent = "";
    el("judulFormBlok").textContent = "Ubah blok waktu";
    el("tombolSimpanBlok").textContent = "Simpan perubahan";
    el("blokBatal").hidden = false;
    el("blokJudul").focus();
  }

  /** Hapus blok dengan konfirmasi. */
  function hapusBlok(id) {
    const b = state.data.blok.find(function (x) { return x.id === id; });
    if (!b) return;
    if (!window.confirm("Hapus blok “" + b.judul + "” (" + b.mulai + "–" + b.selesai + ")?")) return;
    state.data.blok = state.data.blok.filter(function (x) { return x.id !== id; });
    if (state.editBlok === id) resetFormBlok();
    simpanData();
    renderHariIni();
    beritahu("Blok dihapus.");
  }

  /** Navigasi tanggal. */
  function geserTanggal(selisih) {
    state.tanggalAktif = L.tambahHari(state.tanggalAktif, selisih);
    resetFormBlok();
    renderHariIni();
  }

  /** Salin seluruh blok hari ini ke tanggal lain. */
  function salinJadwal() {
    const tujuan = el("salinKeTanggal").value;
    const pesan = el("pesanSalin");
    if (!L.apakahISO(tujuan)) {
      pesan.textContent = "Pilih tanggal tujuan yang valid.";
      return;
    }
    const sumber = blokHariAktif();
    if (sumber.length === 0) {
      pesan.textContent = "Tidak ada blok pada tanggal ini untuk disalin.";
      return;
    }
    const ada = state.data.blok.filter(function (b) { return b.tanggal === tujuan; });
    if (ada.length > 0) {
      const yakin = window.confirm(
        "Tanggal " + L.tanggalPendek(tujuan) + " sudah berisi " + ada.length +
        " blok. Timpa dengan jadwal yang disalin?");
      if (!yakin) { pesan.textContent = "Penyalinan dibatalkan."; return; }
      state.data.blok = state.data.blok.filter(function (b) { return b.tanggal !== tujuan; });
    }
    sumber.forEach(function (b) {
      const salinan = Object.assign({}, b, { id: idUnik("b"), tanggal: tujuan, selesai_: false });
      state.data.blok.push(salinan);
    });
    simpanData();
    renderHariIni();
    pesan.textContent = sumber.length + " blok disalin ke " + L.tanggalPendek(tujuan) + ".";
    beritahu("Jadwal disalin ke " + L.namaHari(tujuan) + ".");
  }

  function pasangHariIni() {
    el("tombolSebelumnya").addEventListener("click", function () { geserTanggal(-1); });
    el("tombolBerikutnya").addEventListener("click", function () { geserTanggal(1); });
    el("tombolHariIni").addEventListener("click", function () {
      state.tanggalAktif = L.hariIni();
      resetFormBlok();
      renderHariIni();
    });
    el("formBlok").addEventListener("submit", simpanBlokDariForm);
    el("blokBatal").addEventListener("click", resetFormBlok);
    // Reset peringatan bentrok begitu pengguna mengubah isian
    ["blokJudul", "blokMulai", "blokSelesai", "blokKategori"].forEach(function (id) {
      el(id).addEventListener("input", function () {
        state.konfirmasiBentrok = false;
        el("pesanBlok").textContent = "";
      });
    });

    // Aksi pada timeline (delegasi peristiwa)
    el("areaBlok").addEventListener("click", function (e) {
      const tombol = e.target.closest ? e.target.closest("button[data-aksi]") : null;
      if (!tombol) return;
      if (tombol.dataset.aksi === "ubah") ubahBlok(tombol.dataset.id);
      else if (tombol.dataset.aksi === "hapus") hapusBlok(tombol.dataset.id);
    });
    el("areaBlok").addEventListener("change", function (e) {
      const kotak = e.target;
      if (!kotak.classList || !kotak.classList.contains("blok-tandai-selesai")) return;
      const b = state.data.blok.find(function (x) { return x.id === kotak.dataset.id; });
      if (!b) return;
      b.selesai_ = kotak.checked;
      simpanData();
      renderHariIni();
    });

    // Catatan harian (tersimpan otomatis)
    el("catatanHarian").addEventListener("input", function () {
      const nilai = el("catatanHarian").value;
      if (nilai.trim() === "") delete state.data.catatan[state.tanggalAktif];
      else state.data.catatan[state.tanggalAktif] = nilai;
      simpanData();
    });

    // Area salin jadwal
    el("tombolSalin").addEventListener("click", function () {
      const area = el("areaSalin");
      area.hidden = !area.hidden;
      el("tombolSalin").setAttribute("aria-expanded", area.hidden ? "false" : "true");
      if (!area.hidden) el("salinKeTanggal").focus();
      else el("pesanSalin").textContent = "";
    });
    el("tombolSalinBatal").addEventListener("click", function () {
      el("areaSalin").hidden = true;
      el("tombolSalin").setAttribute("aria-expanded", "false");
      el("pesanSalin").textContent = "";
      el("tombolSalin").focus();
    });
    el("tombolSalinYa").addEventListener("click", salinJadwal);
  }

  /* =========================================================
   * 6. TAB KEBIASAAN
   * ========================================================= */

  /** Tujuh hari terakhir (diakhiri hari ini), paling kiri paling lama. */
  function tujuhHariTerakhir() {
    const hasil = [];
    for (let i = 6; i >= 0; i--) hasil.push(L.tambahHari(L.hariIni(), -i));
    return hasil;
  }

  const SINGKAT_HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

  /** Render daftar kebiasaan lengkap dengan grid 7 hari. */
  function renderKebiasaan() {
    const wadah = el("daftarKebiasaan");
    wadah.textContent = "";
    const daftar = state.data.kebiasaan;
    el("kosongKebiasaan").hidden = daftar.length > 0;

    const hari = tujuhHariTerakhir();

    daftar.forEach(function (k) {
      const kartu = buat("div", "kartu-kebiasaan");

      // Informasi & streak
      const info = buat("div", "info-kebiasaan");
      const nama = buat("div", "nama", (k.ikon || "✅") + " " + k.nama);
      const streak = L.hitungStreak(Object.keys(k.riwayat || {}), L.hariIni());
      const terpanjang = L.streakTerpanjang(Object.keys(k.riwayat || {}));
      info.appendChild(nama);
      info.appendChild(buat("div", "streak",
        "Target harian: " + (k.target || 1)));
      const teksStreak = buat("div", "streak");
      const b1 = document.createElement("b");
      b1.textContent = "🔥 " + streak.streak + " hari";
      teksStreak.appendChild(b1);
      teksStreak.appendChild(document.createTextNode(
        " saat ini · terpanjang " + terpanjang + " hari"));
      info.appendChild(teksStreak);
      kartu.appendChild(info);

      // Grid 7 hari
      const grid = buat("div", "grid-hari");
      hari.forEach(function (iso) {
        const kolom = buat("div", "kolom-hari" + (iso === L.hariIni() ? " hari-ini" : ""));
        kolom.appendChild(buat("span", null, SINGKAT_HARI[L.indeksHari(iso)]));
        kolom.appendChild(buat("span", null, iso.slice(8, 10)));

        const tercentang = (k.riwayat || {})[iso] === true;
        const tombol = buat("button", "centang", tercentang ? "✓" : "");
        tombol.type = "button";
        tombol.setAttribute("aria-pressed", tercentang ? "true" : "false");
        tombol.setAttribute("aria-label",
          (tercentang ? "Batalkan centang" : "Centang") + " " + k.nama +
          " tanggal " + L.tanggalPendek(iso));
        tombol.title = L.namaHari(iso) + ", " + L.tanggalPendek(iso);
        tombol.addEventListener("click", function () {
          const r = k.riwayat = k.riwayat || {};
          if (r[iso]) delete r[iso];
          else r[iso] = true;
          simpanData();
          renderKebiasaan();
        });
        kolom.appendChild(tombol);
        grid.appendChild(kolom);
      });
      kartu.appendChild(grid);

      // Aksi ubah/hapus
      const aksi = buat("div", "aksi-kebiasaan");
      const tUbah = buat("button", "tombol tombol-krem tombol-kecil", "Ubah");
      tUbah.type = "button";
      tUbah.setAttribute("aria-label", "Ubah kebiasaan " + k.nama);
      tUbah.addEventListener("click", function () { ubahKebiasaan(k.id); });
      const tHapus = buat("button", "tombol tombol-bahaya tombol-kecil", "Hapus");
      tHapus.type = "button";
      tHapus.setAttribute("aria-label", "Hapus kebiasaan " + k.nama);
      tHapus.addEventListener("click", function () { hapusKebiasaan(k.id); });
      aksi.appendChild(tUbah);
      aksi.appendChild(tHapus);
      kartu.appendChild(aksi);

      wadah.appendChild(kartu);
    });
  }

  function resetFormKebiasaan() {
    state.editKebiasaan = null;
    el("formKebiasaan").reset();
    el("kebiasaanTarget").value = "1";
    el("kebiasaanId").value = "";
    el("pesanKebiasaan").textContent = "";
    el("judulFormKebiasaan").textContent = "Tambah kebiasaan";
    el("kebiasaanBatal").hidden = true;
  }

  function simpanKebiasaan(e) {
    e.preventDefault();
    const id = el("kebiasaanId").value || null;
    const nama = el("kebiasaanNama").value.trim();
    if (nama === "") {
      el("pesanKebiasaan").textContent = "Nama kebiasaan wajib diisi.";
      return;
    }
    const kembar = state.data.kebiasaan.some(function (k) {
      return k.nama.toLowerCase() === nama.toLowerCase() && k.id !== id;
    });
    if (kembar) {
      el("pesanKebiasaan").textContent = "Kebiasaan bernama sama sudah ada.";
      return;
    }
    let target = parseInt(el("kebiasaanTarget").value, 10);
    if (!isFinite(target) || target < 1) target = 1;
    const ikon = el("kebiasaanIkon").value.trim() || "✅";

    if (id) {
      const k = state.data.kebiasaan.find(function (x) { return x.id === id; });
      if (k) { k.nama = nama; k.ikon = ikon; k.target = target; }
    } else {
      state.data.kebiasaan.push({
        id: idUnik("k"), nama: nama, ikon: ikon, target: target, riwayat: {}
      });
    }
    simpanData();
    resetFormKebiasaan();
    renderKebiasaan();
    beritahu(id ? "Kebiasaan diubah." : "Kebiasaan ditambahkan.");
  }

  function ubahKebiasaan(id) {
    const k = state.data.kebiasaan.find(function (x) { return x.id === id; });
    if (!k) return;
    state.editKebiasaan = id;
    el("kebiasaanId").value = k.id;
    el("kebiasaanNama").value = k.nama;
    el("kebiasaanIkon").value = k.ikon || "";
    el("kebiasaanTarget").value = String(k.target || 1);
    el("pesanKebiasaan").textContent = "";
    el("judulFormKebiasaan").textContent = "Ubah kebiasaan";
    el("kebiasaanBatal").hidden = false;
    el("kebiasaanNama").focus();
  }

  function hapusKebiasaan(id) {
    const k = state.data.kebiasaan.find(function (x) { return x.id === id; });
    if (!k) return;
    if (!window.confirm("Hapus kebiasaan “" + k.nama + "” beserta riwayatnya?")) return;
    state.data.kebiasaan = state.data.kebiasaan.filter(function (x) { return x.id !== id; });
    if (state.editKebiasaan === id) resetFormKebiasaan();
    simpanData();
    renderKebiasaan();
    beritahu("Kebiasaan dihapus.");
  }

  function pasangKebiasaan() {
    el("formKebiasaan").addEventListener("submit", simpanKebiasaan);
    el("kebiasaanBatal").addEventListener("click", resetFormKebiasaan);
    el("kebiasaanNama").addEventListener("input", function () {
      el("pesanKebiasaan").textContent = "";
    });
  }

  /* =========================================================
   * 7. TAB POMODORO
   * ========================================================= */

  const KELILING_CINCIN = 2 * Math.PI * 110;   // r = 110 px

  const timer = {
    mode: "fokus",        // "fokus" | "pendek" | "panjang"
    berjalan: false,
    jeda: false,
    selesai: false,       // sesi baru saja berakhir (untuk judul tab)
    sisaMs: 0,
    tenggat: 0,
    sesiSelesai: 0,       // sesi fokus selesai dalam siklus berjalan
    idInterval: null
  };

  let ctxAudio = null;

  function konfigurasi() {
    return L.normalisasiPomodoro(state.data.pengaturan.pomodoro);
  }

  function durasiMode(mode) {
    const c = konfigurasi();
    if (mode === "pendek") return c.istirahatPendek;
    if (mode === "panjang") return c.istirahatPanjang;
    return c.fokus;
  }

  function namaMode(mode) {
    if (mode === "pendek") return "Istirahat pendek";
    if (mode === "panjang") return "Istirahat panjang";
    return "Fokus";
  }

  /** Bunyi penanda memakai Web Audio API (tanpa file audio). */
  function bunyikan() {
    if (!state.data.pengaturan.bunyi) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!ctxAudio) ctxAudio = new AC();
      if (ctxAudio.state === "suspended") {
        const p = ctxAudio.resume();
        if (p && typeof p.catch === "function") p.catch(function () { /* abaikan */ });
      }
      const t0 = ctxAudio.currentTime + 0.03;
      [0, 0.3, 0.6].forEach(function (jeda) {
        const osc = ctxAudio.createOscillator();
        const gain = ctxAudio.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, t0 + jeda);
        gain.gain.exponentialRampToValueAtTime(0.22, t0 + jeda + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + jeda + 0.22);
        osc.connect(gain);
        gain.connect(ctxAudio.destination);
        osc.start(t0 + jeda);
        osc.stop(t0 + jeda + 0.25);
      });
    } catch (e) {
      /* sebagian peramban membatasi audio di file:// — diamkan */
    }
  }

  function mmss(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  /** Perbarui tampilan lingkaran, teks, dan judul tab. */
  function gambarTimer() {
    const total = durasiMode(timer.mode) * 60000;
    const rasio = total > 0 ? Math.min(1, Math.max(0, timer.sisaMs / total)) : 0;
    el("cincinIsi").style.strokeDasharray = String(KELILING_CINCIN);
    el("cincinIsi").style.strokeDashoffset = String(KELILING_CINCIN * (1 - rasio));
    el("cincinIsi").classList.toggle("mode-istirahat", timer.mode !== "fokus");
    el("pomodoroJenis").textContent = namaMode(timer.mode);
    el("pomodoroWaktu").textContent = mmss(timer.sisaMs);

    const berikut = L.sesiPomodoroBerikutnya(timer.sesiSelesai, konfigurasi());
    const c = konfigurasi();
    el("pomodoroSesi").textContent = timer.mode === "fokus"
      ? "Sesi " + berikut.sesiKe + "/" + c.panjangSiklus
      : "Sesi berikut: " + berikut.sesiKe + "/" + c.panjangSiklus;

    // Judul tab menampilkan sisa waktu selama timer berjalan;
    // saat sesi berakhir tampilkan penanda agar terlihat di tab latar belakang
    if (timer.berjalan) {
      document.title = mmss(timer.sisaMs) + " · " + namaMode(timer.mode) + " — Planner Harian";
    } else if (timer.selesai) {
      document.title = "✓ Sesi selesai — Planner Harian";
    } else {
      document.title = "Planner Harian";
    }

    // Status tombol
    el("pomodoroMulai").hidden = timer.berjalan || timer.jeda;
    el("pomodoroJeda").disabled = !timer.berjalan;
    el("pomodoroLanjut").hidden = !timer.jeda;
    el("pomodoroLewati").disabled = !(timer.berjalan || timer.jeda);
  }

  /** Catat sesi fokus selesai ke riwayat (masuk statistik). */
  function catatSesiFokus() {
    const kaitan = el("pomodoroKaitan").value || "";
    const sekarang = new Date();
    state.data.riwayatPomodoro.push({
      waktu: sekarang.toISOString(),
      tanggal: L.hariIni(),
      jenis: "fokus",
      durasiMenit: konfigurasi().fokus,
      kaitan: kaitan
    });
    simpanData();
  }

  /** Denyut interval: hitung sisa waktu dari selisih timestamp. */
  function detikTimer() {
    if (!timer.berjalan) return;
    const sisa = timer.tenggat - Date.now();
    timer.sisaMs = Math.max(0, sisa);
    gambarTimer();
    if (sisa <= 0) akhiriSesi(true);
  }

  /**
   * Akhiri sesi berjalan.
   * @param {boolean} catat true bila sesi fokus dicatat & berbunyi
   */
  function akhiriSesi(catat) {
    window.clearInterval(timer.idInterval);
    timer.idInterval = null;
    const modeLama = timer.mode;
    timer.berjalan = false;
    timer.jeda = false;
    timer.selesai = true;
    timer.sisaMs = 0;

    if (modeLama === "fokus") {
      if (catat) {
        catatSesiFokus();
        bunyikan();
      }
      timer.sesiSelesai++;
      const berikut = L.sesiPomodoroBerikutnya(timer.sesiSelesai, konfigurasi());
      timer.mode = berikut.jenis;
      timer.sisaMs = berikut.durasi * 60000;
      el("pesanPomodoro").textContent = catat
        ? "✅ Sesi fokus selesai dan dicatat. Siap istirahat " + berikut.durasi + " menit — tekan Mulai."
        : "Sesi dilewati. Lanjut ke istirahat " + berikut.durasi + " menit.";
    } else {
      timer.mode = "fokus";
      timer.sisaMs = konfigurasi().fokus * 60000;
      if (catat) bunyikan();
      el("pesanPomodoro").textContent = "Istirahat selesai. Siap fokus lagi — tekan Mulai.";
    }
    gambarTimer();
    renderRingkasPomodoro();
  }

  function mulaiTimer() {
    if (timer.berjalan) return;
    // Buat AudioContext pada gestur pengguna (syarat peramban)
    if (!ctxAudio) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) ctxAudio = new AC();
      } catch (e) { /* abaikan */ }
    }
    if (timer.sisaMs <= 0) timer.sisaMs = durasiMode(timer.mode) * 60000;
    timer.tenggat = Date.now() + timer.sisaMs;
    timer.berjalan = true;
    timer.jeda = false;
    timer.selesai = false;
    el("pesanPomodoro").textContent = "";
    if (timer.idInterval) window.clearInterval(timer.idInterval);
    timer.idInterval = window.setInterval(detikTimer, 250);
    gambarTimer();
  }

  function jedaTimer() {
    if (!timer.berjalan) return;
    timer.sisaMs = Math.max(0, timer.tenggat - Date.now());
    timer.berjalan = false;
    timer.jeda = true;
    window.clearInterval(timer.idInterval);
    timer.idInterval = null;
    gambarTimer();
  }

  function lanjutTimer() {
    if (!timer.jeda) return;
    mulaiTimer();
  }

  function resetTimer() {
    window.clearInterval(timer.idInterval);
    timer.idInterval = null;
    timer.berjalan = false;
    timer.jeda = false;
    timer.sesiSelesai = 0;
    timer.selesai = false;
    timer.mode = "fokus";
    timer.sisaMs = konfigurasi().fokus * 60000;
    el("pesanPomodoro").textContent = "Timer direset ke sesi fokus awal.";
    gambarTimer();
    renderRingkasPomodoro();
  }

  function lewatiTimer() {
    if (!timer.berjalan && !timer.jeda) return;
    akhiriSesi(false);
  }

  /** Isi select kaitan sesi (blok hari ini + kategori). */
  function isiKaitanPomodoro() {
    const sel = el("pomodoroKaitan");
    const nilaiLama = sel.value;
    sel.textContent = "";

    const kosong = document.createElement("option");
    kosong.value = "";
    kosong.textContent = "— Tanpa kaitan —";
    sel.appendChild(kosong);

    const hariIniISO = L.hariIni();
    const blok = state.data.blok.filter(function (b) { return b.tanggal === hariIniISO; })
      .sort(function (a, b) { return L.jamKeMenit(a.mulai) - L.jamKeMenit(b.mulai); });
    if (blok.length > 0) {
      const grup = document.createElement("optgroup");
      grup.label = "Blok hari ini";
      blok.forEach(function (b) {
        const o = document.createElement("option");
        o.value = "blok:" + b.id;
        o.textContent = b.mulai + "–" + b.selesai + " " + b.judul;
        grup.appendChild(o);
      });
      sel.appendChild(grup);
    }

    const grupKat = document.createElement("optgroup");
    grupKat.label = "Kategori";
    state.data.kategori.forEach(function (k) {
      const o = document.createElement("option");
      o.value = "kat:" + k.nama;
      o.textContent = k.nama;
      grupKat.appendChild(o);
    });
    sel.appendChild(grupKat);

    sel.value = nilaiLama;   // pertahankan pilihan bila masih ada
    if (sel.value !== nilaiLama) sel.value = "";
  }

  /** Angka ringkasan (sesi hari ini / minggu ini / siklus). */
  function renderRingkasPomodoro() {
    const hariIniISO = L.hariIni();
    const minggu = L.mingguDari(hariIniISO);
    const setMinggu = {};
    minggu.forEach(function (t) { setMinggu[t] = true; });
    const riwayat = state.data.riwayatPomodoro.filter(function (r) { return r.jenis === "fokus"; });
    el("pomodoroHariIni").textContent =
      String(riwayat.filter(function (r) { return r.tanggal === hariIniISO; }).length);
    el("pomodoroMinggu").textContent =
      String(riwayat.filter(function (r) { return setMinggu[r.tanggal]; }).length);
    el("pomodoroSiklus").textContent = timer.sesiSelesai + " sesi selesai";
    el("pomodoroBunyi").textContent = state.data.pengaturan.bunyi ? "Aktif" : "Mati";
  }

  function renderPomodoro() {
    isiKaitanPomodoro();
    renderRingkasPomodoro();
    gambarTimer();
  }

  function pasangPomodoro() {
    el("pomodoroMulai").addEventListener("click", mulaiTimer);
    el("pomodoroJeda").addEventListener("click", jedaTimer);
    el("pomodoroLanjut").addEventListener("click", lanjutTimer);
    el("pomodoroReset").addEventListener("click", resetTimer);
    el("pomodoroLewati").addEventListener("click", lewatiTimer);
    el("pomodoroUjiBunyi").addEventListener("click", function () {
      const lama = state.data.pengaturan.bunyi;
      state.data.pengaturan.bunyi = true;
      bunyikan();
      state.data.pengaturan.bunyi = lama;
      beritahu("Bunyi penanda diuji.");
    });

    // Akurasi saat tab kembali aktif / difokuskan: hitung ulang dari timestamp
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) detikTimer();
    });
    window.addEventListener("focus", detikTimer);
  }

  /* =========================================================
   * 8. TAB STATISTIK
   * ========================================================= */

  /** Render seluruh tab statistik untuk minggu aktif. */
  function renderStatistik() {
    const minggu = L.mingguDari(state.mingguAktif);
    const info = L.statistikMinggu(state.data, minggu, {
      targetBelajarMinggu: state.data.pengaturan.targetBelajarMinggu
    });

    el("labelMinggu").textContent =
      L.tanggalPendek(minggu[0]) + " – " + L.tanggalPendek(minggu[6]) + " " + minggu[6].slice(0, 4);
    el("labelMingguRentang").textContent =
      (state.mingguAktif === L.hariIni() || minggu.indexOf(L.hariIni()) !== -1)
        ? "Minggu ini · Senin s/d Minggu" : "Minggu lampau/akan datang · Senin s/d Minggu";

    // Kartu ringkasan
    el("statTotal").textContent = teksJam(info.totalJam);
    el("statBelajar").textContent = teksJam(info.totalBelajarJam);
    el("statPomodoro").textContent = info.sesiPomodoro + " sesi";
    el("statKebiasaan").textContent = info.kebiasaanPersen + "%";
    el("statProduktif").textContent = info.hariProduktif
      ? L.namaHari(info.hariProduktif) + " (" + L.tanggalPendek(info.hariProduktif) + ")"
      : "—";

    // Target belajar mingguan
    const target = info.targetBelajarMinggu;
    el("barTarget").style.width = info.capaianBelajar + "%";
    el("barTargetWadah").setAttribute("aria-valuenow", String(info.capaianBelajar));
    if (target > 0) {
      el("labelTarget").textContent = info.totalBelajarJam + " / " + target + " jam";
      el("keteranganTarget").textContent =
        "Capaian " + info.capaianBelajar + "% dari target " + String(target).replace(".", ",") +
        " jam minggu ini.";
    } else {
      el("labelTarget").textContent = "Belum diatur";
      el("keteranganTarget").textContent = "Atur target belajar mingguan pada tab Pengaturan.";
    }

    // Tabel per kategori
    const tb = el("isiTabelKategori");
    tb.textContent = "";
    const namaKategori = Object.keys(info.perKategori).sort(function (a, b) {
      return info.perKategori[b] - info.perKategori[a];
    });
    if (namaKategori.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 3;
      td.className = "redup";
      td.textContent = "Belum ada data pada minggu ini.";
      tr.appendChild(td);
      tb.appendChild(tr);
    } else {
      namaKategori.forEach(function (nama) {
        const tr = document.createElement("tr");
        const td1 = document.createElement("td");
        const kotak = buat("span", "kotak-warna");
        kotak.style.background = warnaKategori(nama);
        td1.appendChild(kotak);
        td1.appendChild(document.createTextNode(nama));
        const td2 = document.createElement("td");
        td2.textContent = String(info.perKategori[nama]);
        const td3 = document.createElement("td");
        td3.textContent = teksJam(info.perKategoriJam[nama]);
        tr.appendChild(td1);
        tr.appendChild(td2);
        tr.appendChild(td3);
        tb.appendChild(tr);
      });
    }

    renderGrafik(info, minggu);
  }

  /** Grafik batang 7 hari memakai SVG murni (tanpa library). */
  function renderGrafik(info, minggu) {
    const svg = el("grafikBatang");
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const W = 700, H = 300;
    const padKiri = 52, padKanan = 14, padAtas = 26, padBawah = 52;
    const lebarArea = W - padKiri - padKanan;
    const tinggiArea = H - padAtas - padBawah;

    let maksMenit = 60;
    minggu.forEach(function (t) { maksMenit = Math.max(maksMenit, info.perHari[t].menit); });

    // Garis bantu horizontal + label jam
    [0, 0.5, 1].forEach(function (fraksi) {
      const y = padAtas + tinggiArea * (1 - fraksi);
      svg.appendChild(buatSvg("line", {
        x1: padKiri, x2: W - padKanan, y1: y, y2: y, class: "grafik-garis"
      }));
      svg.appendChild(buatSvg("text", {
        x: padKiri - 8, y: y + 4, "text-anchor": "end", class: "grafik-teks"
      }, String(Math.round(maksMenit * fraksi / 60)) + " j"));
    });

    const slot = lebarArea / 7;
    const lebarBatang = slot * 0.56;

    minggu.forEach(function (t, i) {
      const menit = info.perHari[t].menit;
      const tinggi = (menit / maksMenit) * tinggiArea;
      const x = padKiri + i * slot + (slot - lebarBatang) / 2;
      const y = padAtas + tinggiArea - tinggi;

      const batang = buatSvg("rect", {
        x: x.toFixed(1),
        y: y.toFixed(1),
        width: lebarBatang.toFixed(1),
        height: Math.max(0, tinggi).toFixed(1),
        rx: 7,
        class: "grafik-batang" + (info.hariProduktif === t && menit > 0 ? " penting" : "")
      });
      batang.appendChild(buatSvg("title", {}, L.namaHari(t) + ": " + teksJam(L.pembulatanJam(menit))));
      svg.appendChild(batang);

      // Nilai di atas batang
      svg.appendChild(buatSvg("text", {
        x: (x + lebarBatang / 2).toFixed(1),
        y: (y - 7).toFixed(1),
        "text-anchor": "middle",
        class: "grafik-nilai"
      }, menit > 0 ? String(L.pembulatanJam(menit)).replace(".", ",") : ""));

      // Label hari di bawah
      svg.appendChild(buatSvg("text", {
        x: (x + lebarBatang / 2).toFixed(1),
        y: H - padBawah + 22,
        "text-anchor": "middle",
        class: "grafik-teks"
      }, L.NAMA_HARI[i].slice(0, 3) + " " + t.slice(8, 10)));
    });

    el("ketGrafik").textContent = info.totalMenit > 0
      ? "Total " + teksJam(info.totalJam) + " pada minggu ini. Batang oranye = hari paling produktif."
      : "Belum ada data pada minggu ini.";
  }

  function pasangStatistik() {
    el("mingguSebelumnya").addEventListener("click", function () {
      state.mingguAktif = L.tambahHari(state.mingguAktif, -7);
      renderStatistik();
    });
    el("mingguBerikutnya").addEventListener("click", function () {
      state.mingguAktif = L.tambahHari(state.mingguAktif, 7);
      renderStatistik();
    });
    el("mingguIni").addEventListener("click", function () {
      state.mingguAktif = L.hariIni();
      renderStatistik();
    });
  }

  /* =========================================================
   * 9. TAB PENGATURAN
   * ========================================================= */

  function perbaruiPratinjau() {
    const ta = el("pratinjauJSON");
    if (ta) ta.value = L.serialisasi(state.data);
  }

  /** Render isi tab Pengaturan dari state.data. */
  function renderPengaturan() {
    const p = state.data.pengaturan;
    el("temaTerang").checked = p.tema !== "gelap";
    el("temaGelap").checked = p.tema === "gelap";
    el("setBunyi").checked = p.bunyi !== false;
    el("setFokus").value = String(p.pomodoro.fokus);
    el("setPendek").value = String(p.pomodoro.istirahatPendek);
    el("setPanjang").value = String(p.pomodoro.istirahatPanjang);
    el("setSiklus").value = String(p.pomodoro.panjangSiklus);
    el("setTargetMinggu").value = String(p.targetBelajarMinggu);
    el("labelVersiSkema").textContent = String(L.VERSI_SKEMA);

    renderDaftarKategori();
    perbaruiPratinjau();
  }

  function renderDaftarKategori() {
    const ul = el("daftarKategori");
    ul.textContent = "";
    state.data.kategori.forEach(function (k) {
      const li = document.createElement("li");
      const titik = buat("span", "titik-warna");
      titik.style.background = amanWarna(k.warna);
      li.appendChild(titik);
      li.appendChild(buat("span", "nama-kategori", k.nama));
      const dipakai = state.data.blok.filter(function (b) { return b.kategori === k.nama; }).length;
      li.appendChild(buat("span", "jml", dipakai + " blok"));
      const tHapus = buat("button", "tombol tombol-bahaya tombol-kecil", "Hapus");
      tHapus.type = "button";
      tHapus.setAttribute("aria-label", "Hapus kategori " + k.nama);
      tHapus.addEventListener("click", function () { hapusKategori(k.nama); });
      li.appendChild(tHapus);
      ul.appendChild(li);
    });
  }

  function tambahKategori(e) {
    e.preventDefault();
    const nama = el("kategoriNama").value.trim();
    const warna = el("kategoriWarna").value;
    if (nama === "") {
      el("pesanKategori").textContent = "Nama kategori wajib diisi.";
      return;
    }
    if (state.data.kategori.some(function (k) { return k.nama.toLowerCase() === nama.toLowerCase(); })) {
      el("pesanKategori").textContent = "Kategori “" + nama + "” sudah ada.";
      return;
    }
    if (!amanWarna(warna) || !/^#[0-9a-fA-F]{6}$/.test(warna)) {
      el("pesanKategori").textContent = "Warna tidak valid.";
      return;
    }
    state.data.kategori.push({ nama: nama, warna: warna });
    el("kategoriNama").value = "";
    el("pesanKategori").textContent = "";
    simpanData();
    renderDaftarKategori();
    isiPilihanKategori();
    beritahu("Kategori “" + nama + "” ditambahkan.");
  }

  function hapusKategori(nama) {
    const dipakai = state.data.blok.filter(function (b) { return b.kategori === nama; }).length;
    if (dipakai > 0) {
      el("pesanKategori").textContent =
        "Kategori “" + nama + "” masih dipakai " + dipakai +
        " blok. Pindahkan blok itu dulu sebelum menghapus.";
      return;
    }
    if (state.data.kategori.length <= 1) {
      el("pesanKategori").textContent = "Minimal harus ada satu kategori.";
      return;
    }
    if (!window.confirm("Hapus kategori “" + nama + "”?")) return;
    state.data.kategori = state.data.kategori.filter(function (k) { return k.nama !== nama; });
    simpanData();
    renderDaftarKategori();
    isiPilihanKategori();
    beritahu("Kategori dihapus.");
  }

  /** Baca angka dari input pengaturan; tolak nilai di luar rentang. */
  function bacaAngka(idInput, minimal, maksimal, bawaan) {
    const n = Number(el(idInput).value);
    if (!isFinite(n) || n < minimal || n > maksimal) {
      el("pesanPengaturan").textContent =
        "Nilai harus antara " + minimal + " dan " + maksimal + ".";
      el(idInput).value = String(bawaan);
      return null;
    }
    el("pesanPengaturan").textContent = "";
    return n;
  }

  function pasangPengaturan() {
    // Tema
    el("tombolTema").addEventListener("click", function () {
      terapkanTema(state.data.pengaturan.tema === "gelap" ? "terang" : "gelap");
      simpanData();
    });
    el("temaTerang").addEventListener("change", function () {
      terapkanTema("terang"); simpanData();
    });
    el("temaGelap").addEventListener("change", function () {
      terapkanTema("gelap"); simpanData();
    });

    // Bunyi
    el("setBunyi").addEventListener("change", function () {
      state.data.pengaturan.bunyi = el("setBunyi").checked;
      simpanData();
      renderRingkasPomodoro();
    });

    // Durasi pomodoro
    function ubahDurasi(idInput, kunci, minimal, maksimal, bawaan) {
      el(idInput).addEventListener("change", function () {
        const n = bacaAngka(idInput, minimal, maksimal, bawaan);
        if (n === null) return;
        state.data.pengaturan.pomodoro[kunci] = n;
        simpanData();
        // Bila timer sedang diam, sesuaikan tampilan dengan durasi baru
        if (!timer.berjalan && !timer.jeda) {
          timer.sisaMs = durasiMode(timer.mode) * 60000;
          gambarTimer();
        }
        renderRingkasPomodoro();
      });
    }
    ubahDurasi("setFokus", "fokus", 1, 180, 25);
    ubahDurasi("setPendek", "istirahatPendek", 1, 60, 5);
    ubahDurasi("setPanjang", "istirahatPanjang", 1, 120, 15);
    ubahDurasi("setSiklus", "panjangSiklus", 1, 12, 4);

    // Target belajar mingguan
    el("setTargetMinggu").addEventListener("change", function () {
      const n = bacaAngka("setTargetMinggu", 0, 168, 10);
      if (n === null) return;
      state.data.pengaturan.targetBelajarMinggu = n;
      simpanData();
      renderStatistik();
    });

    // Kategori
    el("formKategori").addEventListener("submit", tambahKategori);
    el("kategoriNama").addEventListener("input", function () {
      el("pesanKategori").textContent = "";
    });

    // Ekspor
    el("tombolEkspor").addEventListener("click", eksporJSON);
    // Impor
    el("inputImpor").addEventListener("change", function (e) {
      const berkas = e.target.files && e.target.files[0];
      if (!berkas) return;
      const pembaca = new FileReader();
      pembaca.onerror = function () {
        tampilkanPesanData("File gagal dibaca. Pastikan file JSON berekstensi .json.", true);
      };
      pembaca.onload = function () {
        imporTeks(String(pembaca.result));
      };
      pembaca.readAsText(berkas);
      e.target.value = "";   // izinkan memilih file yang sama lagi
    });

    // Muat contoh
    el("tombolContoh").addEventListener("click", function () { muatContoh(); });
    // Hapus semua data
    el("tombolHapus").addEventListener("click", hapusSemuaData);
  }

  function tampilkanPesanData(teks, gagal) {
    const p = el("pesanData");
    p.textContent = teks;
    p.classList.toggle("gagal", !!gagal);
    if (gagal) beritahu("Data tidak valid. Pesan galat ditampilkan di tab Pengaturan.", true);
  }

  /** Ekspor data sebagai file JSON. */
  function eksporJSON() {
    const teks = L.serialisasi(state.data);
    try {
      const blob = new Blob([teks], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "planner-harian-" + L.hariIni() + ".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      tampilkanPesanData("Ekspor berhasil: " + a.download, false);
      beritahu("Data berhasil diekspor.");
    } catch (e) {
      // Cadangan bila unduhan diblokir (mis. peramban tertentu di file://)
      const ta = el("pratinjauJSON");
      ta.focus();
      ta.select();
      tampilkanPesanData(
        "Unduhan tidak didukung peramban ini. Data telah disalin ke kotak pratinjau — tekan Ctrl+C.", true);
      try { document.execCommand("copy"); } catch (err) { /* abaikan */ }
    }
  }

  /** Impor dari teks JSON: validasi jelas untuk file rusak. */
  function imporTeks(teks) {
    let obj = null;
    try {
      obj = JSON.parse(teks);
    } catch (err) {
      tampilkanPesanData(
        "File bukan JSON yang valid.\nDetail: " + (err && err.message ? err.message : err), true);
      return false;
    }
    const hasil = L.validasiImpor(obj);
    if (!hasil.valid) {
      tampilkanPesanData("Impor gagal:\n• " + hasil.galat.join("\n• "), true);
      return false;
    }
    if (!window.confirm(
      "Impor akan MENIMPA seluruh data saat ini (" + hasil.data.blok.length +
      " blok, " + hasil.data.kebiasaan.length + " kebiasaan). Lanjutkan?")) {
      tampilkanPesanData("Impor dibatalkan.", false);
      return false;
    }
    const tema = state.data.pengaturan.tema;   // pertahankan tema yang sedang dipakai
    state.data = hasil.data;
    state.data.pengaturan.tema = tema;
    terapkanTema(tema);
    resetFormBlok();
    resetFormKebiasaan();
    simpanData();
    renderSemua();
    tampilkanPesanData("Impor berhasil: " + state.data.blok.length + " blok dan " +
      state.data.kebiasaan.length + " kebiasaan dimuat.", false);
    beritahu("Data berhasil diimpor.");
    return true;
  }

  /** Muat dataset contoh satu minggu penuh. */
  function muatContoh() {
    if (!C) {
      tampilkanPesanData("File contoh.js belum dimuat.", true);
      return false;
    }
    if (!window.confirm("Muat data contoh satu minggu penuh? Data saat ini akan diganti.")) {
      tampilkanPesanData("Pemuatan contoh dibatalkan.", false);
      return false;
    }
    const hasil = L.validasiImpor(C.buatContoh(L.hariIni()));
    if (!hasil.valid) {
      tampilkanPesanData("Data contoh tidak valid:\n• " + hasil.galat.join("\n• "), true);
      return false;
    }
    const tema = state.data.pengaturan.tema;
    state.data = hasil.data;
    state.data.pengaturan.tema = tema;
    state.tanggalAktif = L.hariIni();
    state.mingguAktif = L.hariIni();
    resetFormBlok();
    resetFormKebiasaan();
    simpanData();
    renderSemua();
    tampilkanPesanData("Data contoh dimuat: " + state.data.blok.length + " blok, " +
      state.data.kebiasaan.length + " kebiasaan.", false);
    beritahu("Data contoh dimuat. Selamat mencoba!");
    return true;
  }

  /** Hapus seluruh data dengan konfirmasi ganda. */
  function hapusSemuaData() {
    const yakin = window.confirm(
      "HAPUS SEMUA DATA?\n\nSemua blok jadwal, kebiasaan, catatan, riwayat Pomodoro, " +
      "kategori, dan pengaturan akan hilang permanen.\n\nKlik OK untuk melanjutkan.");
    if (!yakin) { tampilkanPesanData("Penghapusan dibatalkan.", false); return; }
    const kata = window.prompt("Ketik HAPUS untuk konfirmasi:");
    if (kata === null) { tampilkanPesanData("Penghapusan dibatalkan.", false); return; }
    if (kata.trim().toUpperCase() !== "HAPUS") {
      tampilkanPesanData("Konfirmasi tidak cocok — data tidak dihapus.", true);
      return;
    }
    const tema = state.data.pengaturan.tema;   // tema hanya preferensi tampilan
    state.data = L.dataKosong();
    state.data.pengaturan.tema = tema;
    state.tanggalAktif = L.hariIni();
    state.mingguAktif = L.hariIni();
    resetFormBlok();
    resetFormKebiasaan();
    resetTimer();
    terapkanTema(tema);
    simpanData();
    renderSemua();
    tampilkanPesanData("Semua data telah dihapus.", false);
    beritahu("Semua data dihapus.");
  }

  /* =========================================================
   * 10. RENDER SEMUA & INISIALISASI
   * ========================================================= */

  function renderSemua() {
    isiPilihanKategori();
    renderHariIni();
    renderKebiasaan();
    renderPomodoro();
    renderStatistik();
    renderPengaturan();
  }

  function mulai() {
    state.data = muatData();

    pasangTab();
    pasangHariIni();
    pasangKebiasaan();
    pasangPomodoro();
    pasangStatistik();
    pasangPengaturan();

    terapkanTema(state.data.pengaturan.tema);
    // Timer awal = durasi fokus
    timer.sisaMs = konfigurasi().fokus * 60000;

    renderSemua();
    bukaTab("hariini");

    if (!Penyimpanan.tersedia) {
      beritahu("localStorage tidak tersedia — data hanya bertahan selama halaman terbuka.", true);
    }
    if (pesanMuat.length > 0) {
      tampilkanPesanData(pesanMuat.join("\n"), true);
    }
  }

  // Jalankan setelah seluruh DOM tersedia (skrip ditempatkan di akhir body)
  mulai();

  /* =========================================================
   * 11. JEMBATAN UNTUK PENGUJIAN BROWSER (tes.html / headless)
   * ========================================================= */
  window.PlannerUji = {
    dataLengkap: function () { return state.data; },
    imporTeks: imporTeks,
    muatContoh: muatContoh,
    bukaTab: bukaTab,
    renderSemua: renderSemua,
    geserTanggal: geserTanggal,
    simpanData: simpanData,
    state: state,
    timer: timer,
    muatData: muatData
  };
})();
