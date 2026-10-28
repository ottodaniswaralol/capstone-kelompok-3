# Catatan Sprint 3 (Minggu 7), Fase 3 Implementasi MVP

Sprint 1 = Minggu 5, Sprint 2 = Minggu 6, Sprint 3 = Minggu 7 (sprint mingguan, sesuai Subbab 3.2 laporan M4).

## Sprint Goal

Modul listing makanan (FR-05) dan scheduler diskon tahap awal (FR-06) berjalan di atas backend dan database, serta daftar makanan pembeli tampil dari data nyata.

## Deliverable terhadap rencana M4

| Rencana Minggu 7 (Tabel 3.2 M4) | WBS | Hasil | Bukti |
| --- | --- | --- | --- |
| Backend dan frontend listing makanan (FR-05) | 1.5.3 | Selesai. CRUD listing (tambah, ubah stok, jeda, tandai habis, hapus) di API dan tersambung ke frontend | `listings.test.js`, e2e frontend |
| Scheduler diskon tahap awal (FR-06) | 1.5.4 | Selesai. Diskon 20/30/40/50% dihitung server, tersimpan di database, dengan log dan retry | `discount.test.js`, `scheduler.test.js` |
| Halaman beranda dan daftar makanan pembeli | 1.5.x | Selesai. Landing, Home, dan Explore memakai data dari API (radius Haversine, cari, urut) | e2e frontend |
| Skema tabel voucher dan transaksi, riset payment sandbox | 1.5.6 | Skema draf selesai (`reservations`, `vouchers`, `transactions`, `ratings`, `activity_logs`). Payment sandbox: belum | `database.test.js` |
| Pengujian modul sprint | 1.6.2 | Selesai untuk modul auth, listing, scheduler, dan skema | 100 tes otomatis |

Tambahan di luar daftar Minggu 7 (dibutuhkan agar alur dapat dipakai dari ujung ke ujung): login dan registrasi (FR-01 sampai FR-04), profil (FR-03), dan endpoint admin minimal untuk memvalidasi alamat dan menyetujui merchant.

Tanggal dan PIC pelaksanaan aktual: **[isi dari logbook tim]**

## Hasil pengujian

| Jenis | Hasil |
| --- | --- |
| Tes otomatis backend (`npm test`) | 100 tes, 12 suite, 100 lolos: aturan diskon, jam, Haversine, auth, CRUD listing, scheduler (retry, reset tengah malam), constraint database |
| Koleksi Postman dijalankan dengan Newman | 42 request, 67 pemeriksaan, 0 gagal |
| Frontend mode API (browser tiruan + server sungguhan) | 47 pemeriksaan lolos: login, listing, scheduler, registrasi, verifikasi admin, fallback |
| Regresi frontend mode demo | 24 tampilan identik dengan versi sebelum integrasi |
| Instalasi dari nol mengikuti README | Berhasil |
| Contoh BDD US-07 (tutup 21.00, Rp25.000, sisa 75 menit) | 30% = Rp17.500 (lolos otomatis) |

## Keputusan teknis (perlu disepakati tim)

1. **Listing bersifat harian.** `close_time` disimpan sebagai jam (bukan tanggal) dan stok kembali ke `initial_stock` pada 00.00. Ini mengikuti aturan yang sudah ada di frontend v5, dan berbeda dari saran awal memakai tanggal lengkap.
2. **Diskon disimpan di database** dan diperbarui scheduler (sesuai rancangan M4), serta dihitung langsung saat listing dibuat atau diubah.
3. **Zona waktu tetap WIB** di server dan database.
4. **Jendela pembuatan listing 19.00 sampai 00.59** ditegakkan di server (bukan hanya di tampilan).
5. **Peran dibaca dari akun**, bukan dari email atau pilihan pengguna. Halaman login hanya satu form.
6. **Alat demo jam server** (`DEV_TOOLS`) menggantikan jam simulasi lokal agar frontend dan database selalu sepakat soal waktu.
7. **Jarak** dihitung dengan Haversine di SQL dari koordinat merchant.

## Perubahan terhadap rencana

- Endpoint admin minimal dikerjakan lebih awal dari Minggu 12, hanya untuk memvalidasi alamat dan menyetujui merchant. Dashboard admin penuh (FR-14) tetap Minggu 12.
- Frontend ditambah `api.js` dan `env.js`, serta fallback otomatis ke mode demo bila server tidak tersedia.

## Batasan dan risiko yang diketahui

- **Reservasi, voucher, rating masih lokal** di browser. Stok yang tampil = stok server dikurangi voucher lokal yang masih aktif; stok di server belum berkurang (Minggu 9).
- **Notifikasi** perubahan diskon masih dihitung di frontend, belum dikirim server.
- **Halaman pengguna dan transaksi admin** masih data demo (FR-14, Minggu 12).
- **Koordinat merchant baru** adalah titik sementara; admin memvalidasi alamat tetapi koordinat belum otomatis dari geocoding.
- **Endpoint `/dev/*` tanpa autentikasi.** Wajib `DEV_TOOLS=0` di produksi.
- **Pembatas percobaan login** berada di memori satu proses, belum cocok untuk banyak instance.
- **Tes UI** memakai browser tiruan (jsdom), bukan browser sungguhan. Tampilan visual perlu dicek manual.
- **Optimasi query lokasi** dan uji performa (respons di bawah 3 detik) dijadwalkan Minggu 13 dan 14.
- Skrip `docker-compose` belum disediakan.

## Risk Register

R-03 (scheduler diskon gagal atau tidak konsisten): mitigasi logging, retry (3 kali), dan pencegahan putaran tumpang tindih sudah diterapkan dan diuji; uji keandalan penuh tetap Minggu 14.
R-04 (keterlambatan antaranggota): API contract kini tersedia (`docs/api-contract.md`).

## Langkah berikutnya

- **Minggu 8:** finalisasi scheduler dan pencarian lokasi (FR-06, FR-07), persiapan demo progres tengah proyek.
- **Minggu 9:** reservasi dengan booking fee, penanganan stok bersamaan di server (FR-08).
- Tindak lanjut dari Sprint 1: revisi diagram arsitektur (scheduler, payment sandbox, QR, peta tampil eksplisit).

## Retrospektif

Berjalan baik: **[isi tim]**
Perlu diperbaiki: **[isi tim]**
