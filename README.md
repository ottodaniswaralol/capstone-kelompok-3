# ngeWARteg

Platform voucher diskon makanan sisa warteg dan UMKM makanan rumahan. Capstone Project Kelompok 3, Universitas Bakrie.

Pembeli menemukan makanan surplus di sekitar mereka, diskon naik otomatis (20% sampai 50%) mendekati jam tutup, reservasi dengan booking fee kecil, lalu voucher divalidasi merchant di lokasi.

## Struktur

```
ngewarteg/
├─ frontend/           HTML, CSS, JavaScript (tanpa framework)
│  ├─ index.html
│  ├─ css/style.css
│  └─ js/              env.js (alamat API), api.js (klien REST), store.js, listing.js, explore.js, ...
├─ backend/            API Node.js + Express
│  ├─ src/             routes, controllers, services (diskon, jam, geo, listing), jobs (scheduler), middleware
│  ├─ scripts/         setup-db.js, run-scheduler-once.js
│  └─ tests/           100 tes otomatis
├─ database/           schema.sql, seed.sql (MySQL 8 / MariaDB 10.5+)
└─ docs/               api-contract.md, ngewarteg.postman_collection.json, catatan-sprint-minggu-7.md
```

## Kebutuhan

- Node.js 18 atau lebih baru
- MySQL 8 atau MariaDB 10.5+ (XAMPP sudah cukup)

## Menjalankan (pertama kali)

### 1. Database

Nyalakan MySQL (XAMPP: Start pada modul MySQL).

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env        # Windows: copy .env.example .env  (isi DB_USER dan DB_PASSWORD sesuai MySQL Anda)
npm run db:setup            # membuat database, tabel, data awal, dan menghitung diskon pertama
npm start                   # API di http://localhost:3000/api
```

XAMPP biasanya memakai `DB_USER=root` dengan `DB_PASSWORD` kosong. Cek: buka `http://localhost:3000/api/health`, harus muncul `"db":"ok"`.

### 3. Frontend

Sajikan folder `frontend` lewat server statis apa pun, misalnya:

```bash
cd frontend
npx serve .                 # atau: python3 -m http.server 8080
```

Membuka `frontend/index.html` langsung dengan klik ganda juga bisa. Alamat API diatur di `frontend/js/env.js` (default `http://localhost:3000/api`).

- **Server hidup** → mode API: login, listing, dan diskon berasal dari database. Panel di kiri bawah menampilkan "Terhubung ke server".
- **Server mati atau `env.js` dikosongkan** → mode demo lokal otomatis (data contoh di browser), seperti prototype sebelumnya.

## Akun demo (kata sandi `12345678`)

| Peran | Email |
| --- | --- |
| Pembeli | `ghefa@gmail.com`, `rafli@gmail.com` |
| Merchant | `bahari@merchant.com`, `sari@merchant.com`, `melati@merchant.com`, ... |
| Merchant status Review | `maya@merchant.com` |
| Admin | `ghefa@admin.com` (di halaman login, tambahkan `#admin` pada alamat agar tombolnya muncul) |

## Mendemokan scheduler

Listing baru tayang 2 jam sebelum jam tutup merchant (tutup 20.30 sampai 22.00 pada data awal), jadi pada pagi atau siang hari daftar penawaran masih kosong. Gunakan panel "Waktu simulasi" (kiri bawah) untuk menggeser **jam server** (`DEV_TOOLS=1`). Contoh: atur jam 19.45, lihat Paket Nasi Ayam diskon 30% (Rp17.500), tekan +15 mnt, diskon naik jadi 40% (Rp15.000). Listing yang melewati jam tutup otomatis tertutup, dan pada pergantian hari stok kembali ke stok awal.

## Perintah backend

| Perintah | Fungsi |
| --- | --- |
| `npm start` | Menjalankan API dan scheduler |
| `npm run dev` | Sama, dengan auto-restart |
| `npm run db:setup` | Membuat database dan tabel; data awal dimuat bila tabel kosong (aman diulang) |
| `npm run db:reset` | HAPUS semua tabel lalu buat ulang dengan data awal |
| `npm run scheduler:once` | Menjalankan scheduler satu kali |
| `npm test` | 100 tes otomatis (memakai database `TEST_DB_NAME`, dihapus dan dibuat ulang) |

Akun MySQL untuk tes harus boleh membuat database. Jangan arahkan `TEST_DB_NAME` ke database yang berisi data penting.

## Variabel lingkungan (`backend/.env`)

Lihat `backend/.env.example`. Yang penting: `DB_*`, `JWT_SECRET` (wajib diganti di produksi), `SCHEDULER_INTERVAL_MIN` (5 sampai 15 menit sesuai M4), `DEV_TOOLS` (**0 di produksi**), `CORS_ORIGIN`.

## Dokumentasi

- `docs/api-contract.md`: kontrak API lengkap, aturan bisnis, scheduler
- `docs/ngewarteg.postman_collection.json`: impor ke Postman (42 request dengan 67 pemeriksaan). Jalankan folder dari atas ke bawah pada database yang baru direset (`npm run db:reset`)
- `docs/catatan-sprint-minggu-7.md`: catatan Sprint, keputusan, batasan

## Cakupan Minggu 7 dan yang belum

Sudah memakai server: login dan registrasi, profil, listing merchant (tambah, ubah stok, jeda, tandai habis, hapus), daftar listing untuk pembeli (radius Haversine, cari, urut), diskon otomatis oleh scheduler, verifikasi merchant oleh admin.

Masih lokal (demo di browser): reservasi, voucher, rating, notifikasi, serta halaman pengguna dan transaksi admin. Dikerjakan pada Minggu 9 sampai 12 sesuai rencana. Lihat `docs/catatan-sprint-minggu-7.md`.
