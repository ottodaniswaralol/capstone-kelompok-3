# API Contract ngeWARteg (Minggu 7)

Kontrak antara frontend dan backend (WBS 1.3.3). Seluruh isi dokumen ini sudah diuji: 100 tes otomatis backend dan 42 request / 67 pemeriksaan pada koleksi Postman (`ngewarteg.postman_collection.json`).

- **Base URL (lokal):** `http://localhost:3000/api`
- **Format:** JSON (`Content-Type: application/json`), UTF-8
- **Zona waktu:** WIB (UTC+7). Jam ditulis `HH:MM` (24 jam).
- **Autentikasi:** `Authorization: Bearer <token>` (JWT, berlaku 8 jam). Token didapat dari login atau registrasi.
- **Peran:** `consumer` (pembeli), `merchant`, `admin`. Peran dibaca dari akun, bukan dari input pengguna.

## Format galat

Semua galat berbentuk sama:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Nama makanan wajib diisi (maks. 120 karakter)", "details": ["..."] } }
```

| HTTP | code | Arti |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Input tidak valid (`details` memuat semua pesan) |
| 400 | `CLOSE_TIME_PASSED` | Jam tutup listing sudah lewat |
| 400 | `WRONG_PASSWORD` | Kata sandi lama salah |
| 400 | `INVALID_JSON` | Body bukan JSON |
| 401 | `UNAUTHENTICATED`, `INVALID_TOKEN`, `INVALID_CREDENTIALS` | Belum masuk, token rusak/kedaluwarsa, atau email/kata sandi salah |
| 403 | `FORBIDDEN` | Peran tidak berhak |
| 403 | `ACCOUNT_DISABLED`, `MERCHANT_REJECTED` | Akun dinonaktifkan / pendaftaran merchant ditolak |
| 403 | `MERCHANT_NOT_ACTIVE` | Merchant belum disetujui admin |
| 403 | `LISTING_WINDOW_CLOSED` | Listing baru hanya boleh dibuat 19.00 sampai 00.59 |
| 404 | `NOT_FOUND`, `LISTING_NOT_FOUND`, `MERCHANT_NOT_FOUND` | Sumber daya tidak ada (atau bukan milik Anda) |
| 409 | `EMAIL_TAKEN` | Email sudah terdaftar |
| 409 | `ADDRESS_NOT_VERIFIED` | Merchant belum boleh disetujui sebelum alamat valid |
| 409 | `LISTING_HAS_RESERVATIONS` | Listing yang sudah punya reservasi tidak bisa dihapus (jeda saja) |
| 429 | `TOO_MANY_REQUESTS` | Terlalu banyak percobaan login/registrasi |

## Ringkasan endpoint

| Metode | Path | Akses | Fungsi | FR |
| --- | --- | --- | --- | --- |
| GET | `/health` | publik | Status server dan database | |
| GET | `/time` | publik | Jam server WIB dan status jendela listing | |
| POST | `/auth/login` | publik | Masuk | FR-02 |
| POST | `/auth/register/consumer` | publik | Daftar pembeli | FR-01 |
| POST | `/auth/register/merchant` | publik | Daftar merchant (status Review) | FR-04 |
| GET | `/auth/me` | login | Profil sendiri | FR-03 |
| PATCH | `/auth/me` | login | Ubah nama dan lokasi utama | FR-03 |
| POST | `/auth/change-password` | login | Ubah kata sandi | FR-03 |
| GET | `/listings` | publik | Daftar listing tayang (radius, cari, urut) | FR-07 |
| GET | `/listings/:id` | publik | Detail listing | FR-07 |
| GET | `/merchant/listings` | merchant | Listing milik merchant | FR-05 |
| POST | `/merchant/listings` | merchant | Tambah listing | FR-05 |
| PATCH | `/merchant/listings/:id` | merchant | Ubah stok / jeda / tandai habis / data | FR-05 |
| DELETE | `/merchant/listings/:id` | merchant | Hapus listing | FR-05 |
| PATCH | `/merchant/profile` | merchant | Ubah profil usaha | FR-03/04 |
| GET | `/admin/merchants` | admin | Semua merchant | FR-14 (minimal) |
| PATCH | `/admin/merchants/:id/address` | admin | Validasi alamat (Google Maps) | FR-14 (minimal) |
| PATCH | `/admin/merchants/:id/status` | admin | Setujui / tolak merchant | FR-14 (minimal) |
| GET | `/admin/scheduler/logs` | admin | Log scheduler | NFR-05 |
| POST | `/dev/clock`, `/dev/scheduler/run`, `/dev/reset` | alat demo | Geser jam, jalankan scheduler, reset data | hanya `DEV_TOOLS=1` |

Reservasi, voucher, rating, dan dashboard admin penuh belum punya endpoint (Minggu 9 sampai 12). Tabelnya sudah disiapkan di `database/schema.sql`.

## Auth

### `POST /auth/login`
Body: `{ "email": "bahari@merchant.com", "password": "12345678" }`

Respons `200`:
```json
{
  "token": "eyJhbGciOi...",
  "user": { "id": 3, "name": "Bu Lastri", "email": "bahari@merchant.com", "role": "merchant", "area": null },
  "merchant": { "id": 1, "name": "Warteg Bahari", "address": "Jl. Bahari No. 12, Jakarta Selatan",
    "submittedAddress": "...", "verifiedAddress": "...", "addressStatus": "verified", "mapChecked": true,
    "lat": -6.252805, "lng": 106.818133, "openTime": "07:00", "closeTime": "21:00", "status": "active" }
}
```
`merchant` bernilai `null` untuk pembeli dan admin. Email tidak peka huruf besar-kecil.

### `POST /auth/register/consumer`
Body: `{ "name", "email", "password" (8 sampai 72 karakter), "area" (opsional) }` → `201`, respons sama seperti login (langsung masuk).

### `POST /auth/register/merchant`
Body: `{ "ownerName", "email", "password", "businessName", "address", "openTime": "07:00", "closeTime": "21:00" }` → `201`.
Merchant baru berstatus `review` dan `addressStatus: "pending"`. Koordinat sementara diberikan sistem sampai ada geocoding.

### `GET /auth/me` · `PATCH /auth/me` · `POST /auth/change-password`
- `PATCH /auth/me` body `{ "name", "area" }` → `{ "user": {...} }`
- `POST /auth/change-password` body `{ "oldPassword", "newPassword" }` → `{ "ok": true }`

## Listing publik

### `GET /listings`
Hanya listing milik merchant berstatus `active` dengan state `live` atau `upcoming`.

| Query | Nilai | Keterangan |
| --- | --- | --- |
| `lat`, `lng` | angka | Lokasi pembeli. Wajib berpasangan. Menambahkan `distanceKm` (Haversine) |
| `radius` | 0 sampai 100 (km) | Memerlukan `lat` dan `lng` |
| `q` | teks (maks. 60) | Cari nama makanan atau merchant |
| `sort` | `near` (default), `disc`, `close` | Terdekat, diskon terbesar, hampir tutup |
| `state` | `all` (default), `live`, `upcoming` | |

Respons `200`: `{ "items": [Listing], "count": 7, "serverTime": "19:45" }`

### Objek `Listing`
```json
{
  "id": 1,
  "merchant": { "id": 1, "name": "Warteg Bahari", "address": "Jl. Bahari No. 12, Jakarta Selatan", "lat": -6.252805, "lng": 106.818133, "status": "active" },
  "name": "Paket Nasi Ayam", "emoji": "🍗", "note": "Nasi, ayam goreng, sambal, lalapan",
  "normalPrice": 25000, "price": 17500, "discountPct": 30,
  "stock": 5, "initialStock": 5, "closeTime": "21:00", "isActive": true,
  "state": "live", "remainingMinutes": 75,
  "nextDiscount": { "pct": 40, "inMinutes": 15 },
  "distanceKm": 1.2
}
```
- `price` = harga yang harus dibayar sekarang (`normalPrice` bila belum ada diskon).
- `state`: `upcoming` (tutup > 2 jam lagi), `live`, `soldout`, `paused`, `closed`.
- `distanceKm` hanya ada bila `lat` dan `lng` dikirim. `merchant` tidak ada pada `/merchant/listings`.

### `GET /listings/:id`
Query opsional `lat`, `lng`. Respons `200`: `{ "item": Listing }`. `404` bila tidak ada atau merchant belum aktif.

## Merchant: listing

Semua memerlukan token merchant. Merchant hanya bisa mengakses listing miliknya (milik orang lain dijawab `404`).

### `GET /merchant/listings`
`{ "items": [Listing], "count": 2, "serverTime": "19:45", "canCreate": true }`

### `POST /merchant/listings`
Body:
```json
{ "name": "Ayam Bakar Madu", "emoji": "🍗", "note": "Pedas manis", "normalPrice": 25000, "stock": 4, "closeTime": "21:30" }
```
| Field | Aturan |
| --- | --- |
| `name` | wajib, 1 sampai 120 karakter |
| `normalPrice` | bilangan bulat Rp1.000 sampai Rp1.000.000 |
| `stock` | bilangan bulat 1 sampai 999 |
| `closeTime` | `HH:MM`, harus setelah jam sekarang |
| `emoji` | opsional, default 🍱 |
| `note` | opsional, maks. 255 |

Urutan pemeriksaan: merchant `active` (403) → jam 19.00 sampai 00.59 (403) → validasi (400) → jam tutup belum lewat (400). Respons `201`: `{ "item": Listing }`. State dan diskon langsung dihitung saat dibuat.

### `PATCH /merchant/listings/:id`
Kirim satu atau lebih field. `stock` (absolut 0 sampai 999), `stockDelta` (relatif, hasil tidak kurang dari 0), `soldOut: true` (stok jadi 0), `isActive` (jeda/aktifkan), `name`, `emoji`, `note`, `normalPrice`, `closeTime`.
Menaikkan `stock` melebihi `initialStock` ikut menaikkan `initialStock`. Respons `200`: `{ "item": Listing }`.

### `DELETE /merchant/listings/:id`
`204`. Bila sudah ada reservasi: `409 LISTING_HAS_RESERVATIONS`.

### `PATCH /merchant/profile`
Body `{ "name", "address", "openTime", "closeTime" }` → `{ "merchant": {...} }`. Mengubah alamat saat status `review` mengembalikan `addressStatus` ke `pending`.

## Admin (minimal Minggu 7)

- `GET /admin/merchants` → `{ items: [merchant + ownerName, ownerEmail, userId] }`
- `PATCH /admin/merchants/:id/address` body `{ "result": "verified" | "needs_revision", "verifiedAddress": "(opsional)" }`
- `PATCH /admin/merchants/:id/status` body `{ "status": "active" | "rejected" }`. Menyetujui merchant `review` yang alamatnya belum `verified` → `409 ADDRESS_NOT_VERIFIED`.
- `GET /admin/scheduler/logs?limit=30` → `{ items: [{ id, job, startedAt, finishedAt, status, attempts, checked, updated, message }] }`

## Aturan bisnis yang ditegakkan server

**Diskon otomatis (FR-06, Tabel 1.6 laporan M4)** berdasarkan sisa waktu menuju `closeTime`:

| Sisa waktu | state | Diskon |
| --- | --- | --- |
| lebih dari 120 menit | `upcoming` | tidak ada |
| lebih dari 90 sampai 120 | `live` | 20% |
| lebih dari 60 sampai 90 | `live` | 30% |
| lebih dari 30 sampai 60 | `live` | 40% |
| 30 menit atau kurang | `live` | 50% |
| 0 atau kurang | `closed` | tidak ada |

Prioritas status: `paused` > `closed` > `soldout` > `upcoming` > `live`. Contoh BDD: tutup 21.00, harga Rp25.000, sisa 75 menit → 30% → **Rp17.500**.

**Listing harian.** `closeTime` adalah jam tutup berulang setiap hari (bukan tanggal). Pada pergantian hari (00.00), scheduler mengembalikan `stock` ke `initialStock` dan mengakhiri voucher aktif.

**Jendela pembuatan listing.** Listing baru hanya boleh dibuat 19.00 sampai 00.59 WIB.

## Scheduler

- Berjalan saat server hidup dan tiap `SCHEDULER_INTERVAL_MIN` menit (default 5, rentang M4: 5 sampai 15).
- Setiap putaran: (1) reset tengah malam bila tanggal berganti, (2) hitung ulang `state`, `discountPct`, dan harga semua listing, lalu simpan ke database.
- Gagal → diulang sampai 3 kali dengan jeda bertambah, setiap putaran dicatat di `scheduler_logs` (mitigasi risiko R-03). Putaran tidak boleh tumpang tindih.
- Listing yang dibuat atau diubah langsung dihitung ulang, tanpa menunggu putaran berikutnya.

## Alat demo (`DEV_TOOLS=1`, matikan di produksi)

Tanpa autentikasi, hanya untuk pengembangan dan presentasi.

| Endpoint | Body | Fungsi |
| --- | --- | --- |
| `POST /dev/clock` | `{ "advanceMinutes": 15 }` atau `{ "setTime": "19:45" }` atau `{ "reset": true }` | Menggeser jam server lalu menjalankan scheduler |
| `POST /dev/scheduler/run` | `{}` | Menjalankan scheduler sekali |
| `POST /dev/reset` | `{}` | Mengembalikan database ke data awal |

## Keamanan (NFR-01)

Kata sandi di-hash bcrypt; token JWT diverifikasi dan akun dicek aktif pada setiap request; akses berbasis peran; query memakai parameter terikat (tahan injeksi SQL); batas percobaan pada login/registrasi; header keamanan `helmet`; `JWT_SECRET` wajib diatur di produksi.
