'use strict';
const { api, resetDb, login, bearer, close, db, clock } = require('./helpers/setup');
const { runDiscountJob } = require('../src/jobs/discount.job');
const listingService = require('../src/services/listing.service');
const { test, describe, beforeEach, after, mock } = require('node:test');
const assert = require('node:assert/strict');

const state = async (id) => (await db.query('SELECT state, discount_pct, discount_price, stock FROM listings WHERE id = ?', [id]))[0];

describe('scheduler diskon (FR-06, R-03)', () => {
  beforeEach(() => resetDb());

  test('awal 19.45: diskon tiap listing sesuai sisa waktu', async () => {
    assert.deepEqual(await state(1), { state: 'live', discount_pct: 30, discount_price: 17500, stock: 5 }); // sisa 75
    assert.equal((await state(2)).discount_pct, 40); // tutup 20.30, sisa 45
    assert.equal((await state(3)).discount_pct, 20); // tutup 21.30, sisa 105
    assert.equal((await state(5)).state, 'upcoming'); // tutup 22.00, sisa 135
  });
  test('diskon naik bertahap saat jam maju, harga ikut berubah', async () => {
    clock.advance(15); // 20.00: Bahari sisa 60
    let r = await runDiscountJob();
    assert.equal(r.ok, true);
    assert.deepEqual(await state(1), { state: 'live', discount_pct: 40, discount_price: 15000, stock: 5 });
    clock.advance(30); // 20.30
    await runDiscountJob();
    assert.equal((await state(1)).discount_pct, 50);
    assert.equal((await state(1)).discount_price, 12500);
  });
  test('listing upcoming menjadi live saat masuk jendela 2 jam', async () => {
    clock.advance(15); // 20.00, Soto tutup 22.00 -> sisa 120
    const r = await runDiscountJob();
    assert.equal((await state(5)).state, 'live');
    assert.equal((await state(5)).discount_pct, 20);
    assert.ok(r.changes.some((c) => c.id === 5 && c.from.state === 'upcoming' && c.to.state === 'live'));
  });
  test('listing ditutup otomatis setelah lewat jam tutup', async () => {
    clock.advance(50); // 20.35, Bu Sari tutup 20.30
    await runDiscountJob();
    assert.equal((await state(2)).state, 'closed');
    assert.equal((await state(2)).discount_pct, null);
  });
  test('putaran tanpa perubahan: updated = 0', async () => {
    const r = await runDiscountJob();
    assert.equal(r.ok, true);
    assert.equal(r.updated, 0);
    assert.equal(r.checked, 7);
  });
  test('setiap putaran tercatat di scheduler_logs', async () => {
    clock.advance(15);
    await runDiscountJob();
    const admin = await login('ghefa@admin.com');
    const r = await api().get('/api/admin/scheduler/logs').set(bearer(admin));
    assert.ok(r.body.items.length >= 2);
    const last = r.body.items[0];
    assert.equal(last.job, 'discount');
    assert.equal(last.status, 'success');
    assert.equal(last.attempts, 1);
    assert.ok(last.updated > 0);
    assert.match(last.message, /Paket Nasi Ayam/);
  });
  test('retry: gagal dua kali lalu berhasil pada percobaan ketiga', async () => {
    let n = 0;
    const orig = listingService.recomputeAll;
    mock.method(listingService, 'recomputeAll', async () => { n += 1; if (n < 3) throw new Error('koneksi putus'); return orig(); });
    const r = await runDiscountJob({ maxAttempts: 3, backoffMs: 5 });
    mock.restoreAll();
    assert.equal(r.ok, true);
    assert.equal(r.attempts, 3);
    const [log] = await db.query("SELECT status, attempts FROM scheduler_logs WHERE job = 'discount' ORDER BY id DESC LIMIT 1");
    assert.deepEqual({ ...log }, { status: 'success', attempts: 3 });
  });
  test('gagal terus: tercatat failed dengan pesan galat, tidak melempar', async () => {
    mock.method(listingService, 'recomputeAll', async () => { throw new Error('database mati'); });
    const r = await runDiscountJob({ maxAttempts: 2, backoffMs: 5 });
    mock.restoreAll();
    assert.equal(r.ok, false);
    const [log] = await db.query("SELECT status, attempts, message FROM scheduler_logs WHERE job = 'discount' ORDER BY id DESC LIMIT 1");
    assert.equal(log.status, 'failed');
    assert.equal(log.attempts, 2);
    assert.match(log.message, /database mati/);
    assert.equal((await runDiscountJob()).ok, true, 'putaran berikutnya pulih');
  });
  test('putaran tidak boleh tumpang tindih', async () => {
    const [a, b] = await Promise.all([runDiscountJob(), runDiscountJob()]);
    assert.equal([a, b].filter((x) => x.skipped).length, 1);
  });
});

describe('reset tengah malam (aturan tim)', () => {
  beforeEach(() => resetDb('2026-10-22T23:50:00+07:00'));

  test('pergantian hari: stok kembali ke stok awal, voucher aktif dan transaksi diakhiri', async () => {
    await db.query('UPDATE listings SET stock = 1 WHERE id = 1');
    await db.query("INSERT INTO reservations (id, user_id, listing_id, qty, unit_price, normal_price, payment_status) VALUES (1, 1, 1, 2, 12500, 25000, 'paid')");
    await db.query("INSERT INTO vouchers (id, reservation_id, code, qr_payload, valid_until) VALUES (1, 1, 'NW-9001', 'NW-9001', '2026-10-22 23:59:00')");
    await db.query('INSERT INTO transactions (voucher_id) VALUES (1)');
    const before = await runDiscountJob();
    assert.equal(before.reset, null, 'belum ganti hari');
    assert.equal((await state(1)).stock, 1);
    clock.advance(20); // 00.10 tanggal 23
    const r = await runDiscountJob();
    assert.equal(r.reset.date, '2026-10-23');
    assert.equal((await state(1)).stock, 5, 'stok kembali ke initial_stock');
    assert.equal((await db.query('SELECT status FROM vouchers WHERE id = 1'))[0].status, 'expired');
    assert.equal((await db.query('SELECT status FROM transactions WHERE voucher_id = 1'))[0].status, 'expired');
    const [log] = await db.query("SELECT * FROM scheduler_logs WHERE job = 'midnight_reset'");
    assert.equal(log.status, 'success');
  });
  test('reset hanya sekali per hari', async () => {
    clock.advance(20);
    assert.ok((await runDiscountJob()).reset);
    clock.advance(30);
    assert.equal((await runDiscountJob()).reset, null);
    assert.equal((await db.query("SELECT COUNT(*) n FROM scheduler_logs WHERE job = 'midnight_reset'"))[0].n, 1);
  });
  test('setelah reset, listing hari baru kembali upcoming sampai masuk jendela', async () => {
    clock.advance(20);
    await runDiscountJob();
    assert.equal((await state(1)).state, 'upcoming');
    assert.equal((await state(1)).discount_pct, null);
  });
});

describe('alat demo jam server', () => {
  beforeEach(() => resetDb());

  test('GET /api/time memberi jam server WIB dan status jendela listing', async () => {
    const r = await api().get('/api/time');
    assert.equal(r.body.time, '19:45');
    assert.equal(r.body.minuteOfDay, 1185);
    assert.equal(r.body.listingWindowOpen, true);
    assert.equal(r.body.devTools, true);
  });
  test('POST /api/dev/clock: maju, set jam, validasi, dan menjalankan scheduler', async () => {
    const adv = await api().post('/api/dev/clock').send({ advanceMinutes: 15 });
    assert.equal(adv.body.time.time, '20:00');
    assert.ok(adv.body.scheduler.updated > 0);
    assert.equal((await state(1)).discount_pct, 40);
    assert.equal((await api().post('/api/dev/clock').send({ setTime: '21:05' })).body.time.time, '21:05');
    assert.equal((await api().post('/api/dev/clock').send({ setTime: 'abc' })).status, 400);
    assert.equal((await api().post('/api/dev/clock').send({})).status, 400);
    assert.equal((await api().post('/api/dev/clock').send({ advanceMinutes: 0 })).status, 400);
  });
  test('GET /api/health memeriksa koneksi database', async () => {
    const r = await api().get('/api/health');
    assert.equal(r.status, 200);
    assert.equal(r.body.db, 'ok');
  });
  test('endpoint tidak dikenal dan JSON rusak mengembalikan galat terstruktur', async () => {
    const nf = await api().get('/api/tidak-ada');
    assert.equal(nf.status, 404);
    assert.equal(nf.body.error.code, 'NOT_FOUND');
    const bad = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{rusak');
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.code, 'INVALID_JSON');
  });
});

// satu kali per berkas: tutup koneksi database setelah semua pengujian selesai
after(close);
