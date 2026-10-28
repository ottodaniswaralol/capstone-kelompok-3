-- ============================================================
-- ngeWARteg: data awal (demo/pengembangan). Kata sandi semua akun: 12345678 (bcrypt)
-- Koordinat merchant dihitung dari titik acuan pembeli (-6.2600, 106.8100), Jakarta Selatan.
-- Kolom state, discount_pct, discount_price diisi scheduler: jalankan `npm run db:setup`
-- (otomatis) atau `npm run scheduler:once` setelah seed.
-- ============================================================
SET NAMES utf8mb4;

INSERT INTO users (id, name, email, password_hash, role, area, is_active) VALUES
  (1, 'Ghefari Marva', 'ghefa@gmail.com', '$2b$10$SCNsZPgg4tyhc91IkHzY3OvyvEJqT9DspDSkqeXO3.wE9w/3HR1gm', 'consumer', 'Jakarta Selatan', 1),
  (2, 'Rafli Pradana', 'rafli@gmail.com', '$2b$10$SCNsZPgg4tyhc91IkHzY3OvyvEJqT9DspDSkqeXO3.wE9w/3HR1gm', 'consumer', 'Jakarta Selatan', 1),
  (3, 'Bu Lastri', 'bahari@merchant.com', '$2b$10$SCNsZPgg4tyhc91IkHzY3OvyvEJqT9DspDSkqeXO3.wE9w/3HR1gm', 'merchant', NULL, 1),
  (4, 'Bu Sari', 'sari@merchant.com', '$2b$10$SCNsZPgg4tyhc91IkHzY3OvyvEJqT9DspDSkqeXO3.wE9w/3HR1gm', 'merchant', NULL, 1),
  (5, 'Pak Wahyu', 'melati@merchant.com', '$2b$10$SCNsZPgg4tyhc91IkHzY3OvyvEJqT9DspDSkqeXO3.wE9w/3HR1gm', 'merchant', NULL, 1),
  (6, 'Pak Anto', 'nusantara@merchant.com', '$2b$10$SCNsZPgg4tyhc91IkHzY3OvyvEJqT9DspDSkqeXO3.wE9w/3HR1gm', 'merchant', NULL, 1),
  (7, 'Bu Rina', 'rina@merchant.com', '$2b$10$SCNsZPgg4tyhc91IkHzY3OvyvEJqT9DspDSkqeXO3.wE9w/3HR1gm', 'merchant', NULL, 1),
  (8, 'Pak Slamet', 'sederhana@merchant.com', '$2b$10$SCNsZPgg4tyhc91IkHzY3OvyvEJqT9DspDSkqeXO3.wE9w/3HR1gm', 'merchant', NULL, 1),
  (9, 'Administrator', 'ghefa@admin.com', '$2b$10$SCNsZPgg4tyhc91IkHzY3OvyvEJqT9DspDSkqeXO3.wE9w/3HR1gm', 'admin', NULL, 1),
  (10, 'Bu Maya', 'maya@merchant.com', '$2b$10$SCNsZPgg4tyhc91IkHzY3OvyvEJqT9DspDSkqeXO3.wE9w/3HR1gm', 'merchant', NULL, 1);

INSERT INTO merchants (id, user_id, name, address, submitted_address, verified_address, address_status, map_checked, lat, lng, open_time, close_time, status) VALUES
  (1, 3, 'Warteg Bahari', 'Jl. Bahari No. 12, Jakarta Selatan', 'Jl. Bahari No. 12, Jakarta Selatan', 'Jl. Bahari No. 12, Jakarta Selatan', 'verified', 1, -6.252805, 106.818133, '07:00:00', '21:00:00', 'active'),
  (2, 4, 'Dapur Bu Sari', 'Jl. Kemang Raya No. 5, Jakarta Selatan', 'Jl. Kemang Raya No. 5, Jakarta Selatan', 'Jl. Kemang Raya No. 5, Jakarta Selatan', 'verified', 1, -6.270792, 106.795541, '08:00:00', '20:30:00', 'active'),
  (3, 5, 'Warteg Melati', 'Jl. Melati No. 3, Jakarta Selatan', 'Jl. Melati No. 3, Jakarta Selatan', 'Jl. Melati No. 3, Jakarta Selatan', 'verified', 1, -6.276189, 106.829881, '07:00:00', '21:30:00', 'active'),
  (4, 6, 'Warung Nusantara', 'Jl. Nusantara No. 21, Jakarta Selatan', 'Jl. Nusantara No. 21, Jakarta Selatan', 'Jl. Nusantara No. 21, Jakarta Selatan', 'verified', 1, -6.238415, 106.781985, '08:00:00', '21:15:00', 'active'),
  (5, 7, 'Katering Ibu Rina', 'Jl. Cempaka No. 8, Jakarta Selatan', 'Jl. Cempaka No. 8, Jakarta Selatan', 'Jl. Cempaka No. 8, Jakarta Selatan', 'verified', 1, -6.286981, 106.846148, '09:00:00', '22:00:00', 'active'),
  (6, 8, 'Warteg Sederhana', 'Jl. Sederhana No. 2, Jakarta Selatan', 'Jl. Sederhana No. 2, Jakarta Selatan', 'Jl. Sederhana No. 2, Jakarta Selatan', 'verified', 1, -6.300471, 106.760297, '07:00:00', '20:45:00', 'active'),
  (7, 10, 'Dapur Bu Maya', 'Jl. Tebet Raya No. 18, Jakarta Selatan', 'Jl. Tebet Raya No. 18, Jakarta Selatan', NULL, 'pending', 0, -6.278887, 106.820844, '08:00:00', '21:00:00', 'review');

INSERT INTO listings (id, merchant_id, name, emoji, note, normal_price, stock, initial_stock, close_time, is_active) VALUES
  (1, 1, 'Paket Nasi Ayam', '🍗', 'Nasi, ayam goreng, sambal, lalapan', 25000, 5, 5, '21:00:00', 1),
  (2, 2, 'Nasi Telur Balado', '🍳', 'Telur balado, sayur, sambal', 20000, 3, 3, '20:30:00', 1),
  (3, 3, 'Paket Sayur & Tempe', '🥬', 'Sayur asem, tempe orek, nasi', 18000, 4, 4, '21:30:00', 1),
  (4, 4, 'Nasi Rames Komplit', '🍛', 'Nasi rames dengan 3 lauk', 22000, 6, 6, '21:15:00', 1),
  (5, 5, 'Soto Ayam + Nasi', '🍲', 'Soto ayam kuah bening', 24000, 4, 4, '22:00:00', 1),
  (6, 6, 'Gado-gado Porsi Besar', '🥗', 'Gado-gado, lontong, kerupuk', 17000, 2, 2, '20:45:00', 1),
  (7, 1, 'Tempe Orek + Nasi', '🍱', 'Tempe orek, sayur, nasi', 15000, 4, 4, '21:30:00', 1);

-- Reset auto-increment agar data baru dimulai setelah data awal
ALTER TABLE users AUTO_INCREMENT = 11;
ALTER TABLE merchants AUTO_INCREMENT = 8;
ALTER TABLE listings AUTO_INCREMENT = 8;
