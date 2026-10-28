# Staging dan CI ngeWARteg

Dokumen ini menjelaskan pipeline CI (GitHub Actions) dan lingkungan staging (Docker Compose). WBS 1.7.1 *Setup staging server dan CI sederhana*.

## Berkas

| Berkas | Fungsi |
| --- | --- |
| `.github/workflows/ci.yml` | CI otomatis setiap push dan pull request |
| `backend/Dockerfile` | Image API (Node 20, mode produksi) |
| `.dockerignore` | Berkas yang tidak ikut ke image |
| `docker-compose.staging.yml` | Staging: MySQL 8 + API + Nginx |
| `deploy/nginx.conf` | Nginx: sajikan frontend, teruskan `/api` ke backend |
| `deploy/env.staging.js` | Alamat API frontend versi staging (`/api`) |
| `.env.staging.example` | Contoh variabel lingkungan staging |

## CI (GitHub Actions)

Berjalan otomatis pada push ke `main`, `master`, atau `develop` serta setiap pull request. Bisa juga dijalankan manual dari tab **Actions → CI → Run workflow**.

| Job | Isi | Lolos bila |
| --- | --- | --- |
| `test` | `npm ci` lalu `npm test` di Node 18 dan 20 dengan MySQL 8 | 100 tes lolos |
| `api` | Reset database, jalankan API, jalankan koleksi Postman dengan Newman | 42 request, 67 pemeriksaan lolos |
| `docker` | Build image `backend/Dockerfile` (tanpa push) | Image berhasil dibuat |

Laporan Newman (`newman-report.xml`) dan log API diunggah sebagai *artifact* `laporan-newman` pada setiap run.

Tidak perlu *secret* apa pun; kata sandi MySQL dan `JWT_SECRET` di workflow hanya untuk database sementara milik runner CI.

Saran: aktifkan **Settings → Branches → Branch protection** pada `main` dan centang *Require status checks to pass* (pilih job `test` dan `api`) agar kode yang gagal tes tidak bisa digabung.

## Staging (Docker Compose)

Kebutuhan server: Linux (VPS/kampus/laptop tim) dengan Docker Engine dan plugin Docker Compose.

```bash
git clone <repo> ngewarteg && cd ngewarteg
cp .env.staging.example .env.staging     # isi kata sandi dan JWT_SECRET
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d --build
```

Buka `http://<alamat-server>:8080`. Panel kiri bawah harus menampilkan "Terhubung ke server". Cek API: `http://<alamat-server>:8080/api/health` → `"db":"ok"`.

Saat pertama kali menyala, container `api` membuat tabel dan memuat data awal (akun demo sama dengan README). Data tersimpan di volume `db_data`, jadi tidak hilang saat container dihentikan atau di-*deploy* ulang.

### Perintah harian

| Perintah | Fungsi |
| --- | --- |
| `docker compose -f docker-compose.staging.yml --env-file .env.staging up -d --build` | Deploy ulang setelah `git pull` |
| `docker compose -f docker-compose.staging.yml logs -f api` | Lihat log API dan scheduler |
| `docker compose -f docker-compose.staging.yml ps` | Status container (kolom *health*) |
| `docker compose -f docker-compose.staging.yml down` | Hentikan (data tetap aman) |
| `docker compose -f docker-compose.staging.yml down -v` | Hentikan dan **HAPUS** database |

### Alat demo jam server

`DEV_TOOLS=0` secara bawaan karena endpoint `/api/dev/*` tidak memakai autentikasi. Untuk presentasi yang membutuhkan panel "Waktu simulasi", ubah sementara menjadi `DEV_TOOLS=1` di `.env.staging`, jalankan ulang perintah deploy, lalu kembalikan ke `0` setelah demo.

### Catatan

- Port publik bisa diubah lewat `WEB_PORT`. Hanya Nginx yang dibuka ke luar; MySQL dan API tidak diekspos.
- Untuk HTTPS dan domain, pasang reverse proxy (misalnya Caddy atau Nginx dengan Let's Encrypt) di depan port `WEB_PORT`.
- Kata sandi MySQL hanya dibaca saat volume pertama kali dibuat. Bila diganti kemudian, jalankan `down -v` (data terhapus) atau ubah kata sandi langsung di MySQL.
