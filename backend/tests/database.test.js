'use strict';
const { resetDb, close, db } = require('./helpers/setup');
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');

const rejects = async (sql, params) => { await assert.rejects(() => db.query(sql, params)); };

describe('skema database: constraint', () => {
  before(() => resetDb());

  test('seed lengkap: 10 pengguna, 7 merchant, 7 listing', async () => {
    assert.equal((await db.query('SELECT COUNT(*) n FROM users'))[0].n, 10);
    assert.equal((await db.query('SELECT COUNT(*) n FROM merchants'))[0].n, 7);
    assert.equal((await db.query('SELECT COUNT(*) n FROM listings'))[0].n, 7);
  });
  test('email pengguna unik', () => rejects("INSERT INTO users (name, email, password_hash, role) VALUES ('X', 'ghefa@gmail.com', 'h', 'consumer')"));
  test('peran hanya consumer, merchant, atau admin', () => rejects("INSERT INTO users (name, email, password_hash, role) VALUES ('X', 'x@x.com', 'h', 'superuser')"));
  test('satu pengguna hanya punya satu merchant', () => rejects("INSERT INTO merchants (user_id, name, address, submitted_address, lat, lng, open_time, close_time) VALUES (3, 'Dobel', 'a', 'a', -6.2, 106.8, '07:00', '21:00')"));
  test('harga normal harus positif', () => rejects("INSERT INTO listings (merchant_id, name, normal_price, stock, initial_stock, close_time) VALUES (1, 'X', 0, 1, 1, '21:00')"));
  test('stok tidak boleh negatif', () => rejects('UPDATE listings SET stock = stock - 99 WHERE id = 1'));
  test('listing harus punya merchant yang ada', () => rejects("INSERT INTO listings (merchant_id, name, normal_price, stock, initial_stock, close_time) VALUES (999, 'X', 1000, 1, 1, '21:00')"));
  test('koordinat harus valid', () => rejects("UPDATE merchants SET lat = 120 WHERE id = 1"));
  test('rating 1 sampai 5', async () => {
    await db.query("INSERT INTO reservations (id, user_id, listing_id, qty, unit_price, normal_price) VALUES (1, 1, 1, 1, 17500, 25000)");
    await db.query("INSERT INTO vouchers (id, reservation_id, code, qr_payload, valid_until) VALUES (1, 1, 'NW-1', 'NW-1', '2026-10-22 21:00:00')");
    await db.query('INSERT INTO transactions (id, voucher_id) VALUES (1, 1)');
    await rejects('INSERT INTO ratings (transaction_id, user_id, merchant_id, score) VALUES (1, 1, 1, 6)');
    await db.query('INSERT INTO ratings (transaction_id, user_id, merchant_id, score) VALUES (1, 1, 1, 5)');
    await rejects('INSERT INTO ratings (transaction_id, user_id, merchant_id, score) VALUES (1, 1, 1, 4)'); // satu rating per transaksi
  });
  test('kode voucher unik', () => rejects("INSERT INTO reservations (id, user_id, listing_id, qty, unit_price, normal_price) VALUES (2, 1, 1, 1, 1, 1)")
    .then(() => null).catch(() => null).then(async () => {
      await db.query("INSERT INTO reservations (id, user_id, listing_id, qty, unit_price, normal_price) VALUES (3, 2, 1, 1, 17500, 25000)").catch(() => {});
      await rejects("INSERT INTO vouchers (reservation_id, code, qr_payload, valid_until) VALUES (3, 'NW-1', 'x', '2026-10-22 21:00:00')");
    }));
  test('menghapus merchant ikut menghapus listing-nya (cascade)', async () => {
    await db.query("INSERT INTO users (id, name, email, password_hash, role) VALUES (50, 'T', 't@t.com', 'h', 'merchant')");
    await db.query("INSERT INTO merchants (id, user_id, name, address, submitted_address, lat, lng, open_time, close_time) VALUES (50, 50, 'T', 'a', 'a', -6.2, 106.8, '07:00', '21:00')");
    await db.query("INSERT INTO listings (merchant_id, name, normal_price, stock, initial_stock, close_time) VALUES (50, 'L', 1000, 1, 1, '21:00')");
    await db.query('DELETE FROM merchants WHERE id = 50');
    assert.equal((await db.query('SELECT COUNT(*) n FROM listings WHERE merchant_id = 50'))[0].n, 0);
  });
});

// satu kali per berkas: tutup koneksi database setelah semua pengujian selesai
after(close);
