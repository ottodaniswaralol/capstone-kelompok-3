-- ============================================================
-- ngeWARteg: skema database (MySQL 8 / MariaDB 10.5+)
-- Zona waktu aplikasi: WIB (UTC+7). Semua DATETIME/TIME disimpan sebagai waktu WIB.
-- Tabel inti Minggu 7 : users, merchants, listings, scheduler_logs, app_meta
-- Tabel DRAF          : reservations, vouchers, transactions, ratings, activity_logs
--                       (disiapkan agar skema siap untuk Minggu 9 sampai 12; belum ada API)
-- Aman dijalankan berulang (CREATE TABLE IF NOT EXISTS).
-- ============================================================
SET NAMES utf8mb4;

-- ---------- Akun ----------
CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(150)  NOT NULL,
  password_hash VARCHAR(100)  NOT NULL,
  role          ENUM('consumer','merchant','admin') NOT NULL,
  area          VARCHAR(60)   NULL,
  is_active     TINYINT(1)    NOT NULL DEFAULT 1,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS merchants (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id           BIGINT UNSIGNED NOT NULL,
  name              VARCHAR(120) NOT NULL,
  address           VARCHAR(255) NOT NULL,
  submitted_address VARCHAR(255) NOT NULL,
  verified_address  VARCHAR(255) NULL,
  address_status    ENUM('pending','verified','needs_revision') NOT NULL DEFAULT 'pending',
  map_checked       TINYINT(1)   NOT NULL DEFAULT 0,
  lat               DECIMAL(9,6) NOT NULL,
  lng               DECIMAL(9,6) NOT NULL,
  open_time         TIME         NOT NULL,
  close_time        TIME         NOT NULL,
  status            ENUM('review','active','rejected') NOT NULL DEFAULT 'review',
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_merchants_user (user_id),
  KEY idx_merchants_status (status),
  CONSTRAINT fk_merchants_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT ck_merchants_lat CHECK (lat BETWEEN -90 AND 90),
  CONSTRAINT ck_merchants_lng CHECK (lng BETWEEN -180 AND 180)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Listing makanan (FR-05, FR-06) ----------
-- Listing berulang harian: close_time adalah jam tutup (waktu WIB), stok dikembalikan ke
-- initial_stock pada pergantian hari (00.00). Kolom state, discount_pct, discount_price
-- DIHITUNG oleh scheduler (dan dihitung ulang saat listing dibuat/diubah).
CREATE TABLE IF NOT EXISTS listings (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  merchant_id    BIGINT UNSIGNED NOT NULL,
  name           VARCHAR(120)  NOT NULL,
  emoji          VARCHAR(16)   NOT NULL DEFAULT '🍱',
  note           VARCHAR(255)  NULL,
  normal_price   INT UNSIGNED  NOT NULL,
  stock          INT UNSIGNED  NOT NULL,
  initial_stock  INT UNSIGNED  NOT NULL,
  close_time     TIME          NOT NULL,
  is_active      TINYINT(1)    NOT NULL DEFAULT 1,
  state          ENUM('upcoming','live','soldout','paused','closed') NOT NULL DEFAULT 'upcoming',
  discount_pct   TINYINT UNSIGNED NULL,
  discount_price INT UNSIGNED  NULL,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_listings_merchant (merchant_id),
  KEY idx_listings_state (state, close_time),
  CONSTRAINT fk_listings_merchant FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
  CONSTRAINT ck_listings_price CHECK (normal_price > 0),
  CONSTRAINT ck_listings_initial CHECK (initial_stock > 0),
  CONSTRAINT ck_listings_pct CHECK (discount_pct IS NULL OR discount_pct BETWEEN 1 AND 90)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Scheduler ----------
CREATE TABLE IF NOT EXISTS scheduler_logs (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  job              ENUM('discount','midnight_reset') NOT NULL,
  started_at       DATETIME NOT NULL,
  finished_at      DATETIME NULL,
  status           ENUM('running','success','failed') NOT NULL DEFAULT 'running',
  attempts         TINYINT UNSIGNED NOT NULL DEFAULT 1,
  listings_checked INT UNSIGNED NOT NULL DEFAULT 0,
  listings_updated INT UNSIGNED NOT NULL DEFAULT 0,
  message          VARCHAR(255) NULL,
  PRIMARY KEY (id),
  KEY idx_scheduler_started (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_meta (
  k VARCHAR(40)  NOT NULL,
  v VARCHAR(255) NOT NULL,
  PRIMARY KEY (k)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- DRAF (Rio, Minggu 7): reservasi, voucher, transaksi, rating, log aktivitas
-- Relasi: reservations 1-1 vouchers 1-1 transactions 1-0..1 ratings (lihat Tabel 3.3 laporan M5)
-- ============================================================
CREATE TABLE IF NOT EXISTS reservations (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        BIGINT UNSIGNED NOT NULL,
  listing_id     BIGINT UNSIGNED NOT NULL,
  qty            INT UNSIGNED NOT NULL,
  unit_price     INT UNSIGNED NOT NULL,
  normal_price   INT UNSIGNED NOT NULL,
  booking_fee    INT UNSIGNED NOT NULL DEFAULT 2000,
  payment_status ENUM('pending','paid','failed') NOT NULL DEFAULT 'pending',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_res_user (user_id),
  KEY idx_res_listing (listing_id),
  CONSTRAINT fk_res_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_res_listing FOREIGN KEY (listing_id) REFERENCES listings(id),
  CONSTRAINT ck_res_qty CHECK (qty > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vouchers (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reservation_id BIGINT UNSIGNED NOT NULL,
  code           VARCHAR(20)  NOT NULL,
  qr_payload     VARCHAR(255) NOT NULL,
  valid_until    DATETIME     NOT NULL,
  status         ENUM('active','used','expired') NOT NULL DEFAULT 'active',
  PRIMARY KEY (id),
  UNIQUE KEY uq_vouchers_code (code),
  UNIQUE KEY uq_vouchers_reservation (reservation_id),
  KEY idx_vouchers_status (status, valid_until),
  CONSTRAINT fk_vouchers_res FOREIGN KEY (reservation_id) REFERENCES reservations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transactions (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  voucher_id   BIGINT UNSIGNED NOT NULL,
  status       ENUM('reserved','completed','expired') NOT NULL DEFAULT 'reserved',
  completed_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_transactions_voucher (voucher_id),
  KEY idx_transactions_status (status),
  CONSTRAINT fk_transactions_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ratings (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  transaction_id BIGINT UNSIGNED NOT NULL,
  user_id        BIGINT UNSIGNED NOT NULL,
  merchant_id    BIGINT UNSIGNED NOT NULL,
  score          TINYINT UNSIGNED NOT NULL,
  feedback       VARCHAR(500) NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ratings_transaction (transaction_id),
  KEY idx_ratings_merchant (merchant_id),
  CONSTRAINT fk_ratings_transaction FOREIGN KEY (transaction_id) REFERENCES transactions(id),
  CONSTRAINT fk_ratings_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_ratings_merchant FOREIGN KEY (merchant_id) REFERENCES merchants(id),
  CONSTRAINT ck_ratings_score CHECK (score BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity_logs (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id   BIGINT UNSIGNED NULL,
  action     VARCHAR(150) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_activity_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
