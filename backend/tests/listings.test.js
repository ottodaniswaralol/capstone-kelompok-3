'use strict';
const { api, resetDb, login, bearer, close, db, clock } = require('./helpers/setup');
const { runDiscountJob } = require('../src/jobs/discount.job');
const { test, describe, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

const REF = 'lat=-6.26&lng=106.81';
const valid = { name: 'Ayam Bakar', emoji: '🍗', normalPrice: 25000, stock: 4, closeTime: '21:30' };

describe('listing publik (FR-05, FR-06, FR-07)', () => {
  beforeEach(() => resetDb());

  test('daftar publik: listing tayang dengan diskon dari database', async () => {
    const r = await api().get('/api/listings?state=live');
    assert.equal(r.status, 200);
    const l1 = r.body.items.find((i) => i.name === 'Paket Nasi Ayam');
    assert.equal(l1.state, 'live');
    assert.equal(l1.discountPct, 30);
    assert.equal(l1.price, 17500);
    assert.equal(l1.normalPrice, 25000);
    assert.deepEqual(l1.nextDiscount, { pct: 40, inMinutes: 15 });
    assert.equal(l1.merchant.name, 'Warteg Bahari');
    assert.equal(l1.closeTime, '21:00');
  });
  test('state=all memuat live dan upcoming; upcoming tanpa diskon', async () => {
    const r = await api().get('/api/listings');
    const soto = r.body.items.find((i) => i.name === 'Soto Ayam + Nasi');
    assert.equal(soto.state, 'upcoming');
    assert.equal(soto.discountPct, null);
    assert.equal(soto.price, 24000);
    assert.equal(r.body.items.length, 7);
    assert.equal((await api().get('/api/listings?state=upcoming')).body.items.length, 1);
  });
  test('filter radius (Haversine) dan jarak dalam km', async () => {
    const r3 = await api().get(`/api/listings?${REF}&radius=3&state=live`);
    const names3 = r3.body.items.map((i) => i.merchant.name);
    assert.ok(names3.includes('Warteg Bahari') && names3.includes('Dapur Bu Sari') && names3.includes('Warteg Melati'));
    assert.ok(!names3.includes('Warung Nusantara'), 'Nusantara 3,9 km di luar radius 3');
    const r10 = await api().get(`/api/listings?${REF}&radius=10&state=live`);
    assert.ok(r10.body.items.length > r3.body.items.length);
    for (const i of r3.body.items) assert.ok(i.distanceKm <= 3);
    const bahari = r3.body.items.find((i) => i.merchant.name === 'Warteg Bahari');
    assert.ok(bahari.distanceKm > 1.1 && bahari.distanceKm < 1.3);
  });
  test('urutan: terdekat, diskon terbesar, hampir tutup', async () => {
    const near = (await api().get(`/api/listings?${REF}&state=live&sort=near`)).body.items.map((i) => i.distanceKm);
    assert.deepEqual(near, [...near].sort((a, b) => a - b));
    const disc = (await api().get('/api/listings?state=live&sort=disc')).body.items.map((i) => i.discountPct);
    assert.deepEqual(disc, [...disc].sort((a, b) => b - a));
    const close = (await api().get('/api/listings?state=live&sort=close')).body.items.map((i) => i.closeTime);
    assert.deepEqual(close, [...close].sort());
  });
  test('pencarian nama makanan atau merchant', async () => {
    assert.deepEqual((await api().get('/api/listings?q=soto')).body.items.map((i) => i.name), ['Soto Ayam + Nasi']);
    assert.ok((await api().get('/api/listings?q=bahari')).body.items.length >= 2);
    assert.equal((await api().get('/api/listings?q=%25')).body.items.length, 0, 'karakter % tidak boleh jadi wildcard');
  });
  test('parameter tidak valid -> 400', async () => {
    for (const qs of ['lat=-6.26', 'radius=5', 'lat=999&lng=106', `${REF}&radius=0`, `${REF}&radius=500`, 'sort=acak', 'state=semua']) {
      assert.equal((await api().get('/api/listings?' + qs)).status, 400, qs);
    }
  });
  test('listing dijeda, habis, atau tutup tidak tampil di publik', async () => {
    const mt = await login('bahari@merchant.com');
    await api().patch('/api/merchant/listings/1').set(bearer(mt)).send({ isActive: false });
    await api().patch('/api/merchant/listings/7').set(bearer(mt)).send({ soldOut: true });
    const ids = (await api().get('/api/listings')).body.items.map((i) => i.id);
    assert.ok(!ids.includes(1) && !ids.includes(7));
    clock.advance(80); // 21.05: Bahari tutup 21.00
    await runDiscountJob();
    const live = (await api().get('/api/listings?state=live')).body.items.map((i) => i.name);
    assert.ok(!live.includes('Paket Nasi Ayam'));
  });
  test('listing milik merchant yang belum aktif tidak tampil', async () => {
    await db.query("UPDATE merchants SET status = 'review' WHERE id = 1");
    const names = (await api().get('/api/listings')).body.items.map((i) => i.merchant.name);
    assert.ok(!names.includes('Warteg Bahari'));
  });
  test('detail listing: 200 dan 404', async () => {
    const r = await api().get(`/api/listings/1?${REF}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.item.name, 'Paket Nasi Ayam');
    assert.ok(r.body.item.distanceKm > 0);
    assert.equal((await api().get('/api/listings/9999')).status, 404);
    assert.equal((await api().get('/api/listings/abc')).status, 404);
  });
  test('respons tidak membocorkan data lain (hash, email)', async () => {
    const txt = JSON.stringify((await api().get('/api/listings')).body);
    assert.ok(!/password|hash|email/i.test(txt));
  });
});

describe('listing merchant: CRUD (FR-05)', () => {
  beforeEach(() => resetDb());

  test('wajib login dan berperan merchant', async () => {
    assert.equal((await api().get('/api/merchant/listings')).status, 401);
    const tc = await login('ghefa@gmail.com');
    assert.equal((await api().get('/api/merchant/listings').set(bearer(tc))).status, 403);
    assert.equal((await api().post('/api/merchant/listings').set(bearer(tc)).send(valid)).status, 403);
  });
  test('merchant hanya melihat listing miliknya', async () => {
    const mt = await login('bahari@merchant.com');
    const r = await api().get('/api/merchant/listings').set(bearer(mt));
    assert.deepEqual(r.body.items.map((i) => i.id), [1, 7]);
    assert.equal(r.body.canCreate, true);
  });
  test('tambah listing: tayang langsung dengan diskon sesuai jam (19.45, tutup 21.30 -> 20%)', async () => {
    const mt = await login('bahari@merchant.com');
    const r = await api().post('/api/merchant/listings').set(bearer(mt)).send(valid);
    assert.equal(r.status, 201);
    assert.equal(r.body.item.state, 'live');
    assert.equal(r.body.item.discountPct, 20);
    assert.equal(r.body.item.price, 20000);
    assert.equal(r.body.item.initialStock, 4);
    const pub = (await api().get('/api/listings?q=ayam%20bakar')).body.items;
    assert.equal(pub.length, 1, 'muncul di daftar pembeli');
  });
  test('listing dengan jam tutup > 2 jam lagi berstatus upcoming', async () => {
    const mt = await login('bahari@merchant.com');
    const r = await api().post('/api/merchant/listings').set(bearer(mt)).send({ ...valid, closeTime: '23:00' });
    assert.equal(r.body.item.state, 'upcoming');
    assert.equal(r.body.item.discountPct, null);
  });
  test('validasi input tambah listing -> 400', async () => {
    const mt = await login('bahari@merchant.com');
    const bad = [{ name: '' }, { name: 'x'.repeat(121) }, { normalPrice: 0 }, { normalPrice: 500 }, { normalPrice: 'abc' }, { normalPrice: 12.5 }, { stock: 0 }, { stock: 1000 }, { stock: -1 }, { closeTime: '9:00' }, { closeTime: '25:00' }, { closeTime: undefined }];
    for (const patch of bad) {
      const r = await api().post('/api/merchant/listings').set(bearer(mt)).send({ ...valid, ...patch });
      assert.equal(r.status, 400, JSON.stringify(patch));
      assert.equal(r.body.error.code, 'VALIDATION_ERROR');
    }
  });
  test('jam tutup yang sudah lewat ditolak', async () => {
    const mt = await login('bahari@merchant.com');
    const r = await api().post('/api/merchant/listings').set(bearer(mt)).send({ ...valid, closeTime: '19:30' });
    assert.equal(r.status, 400);
    assert.equal(r.body.error.code, 'CLOSE_TIME_PASSED');
  });
  test('jendela pembuatan listing: 18.59 dikunci, 19.00 dan 00.30 boleh', async () => {
    const mt = await login('bahari@merchant.com');
    clock.pin('2026-10-22T18:59:00+07:00');
    const locked = await api().post('/api/merchant/listings').set(bearer(mt)).send(valid);
    assert.equal(locked.status, 403);
    assert.equal(locked.body.error.code, 'LISTING_WINDOW_CLOSED');
    assert.equal((await api().get('/api/merchant/listings').set(bearer(mt))).body.canCreate, false);
    clock.pin('2026-10-22T19:00:00+07:00');
    assert.equal((await api().post('/api/merchant/listings').set(bearer(mt)).send(valid)).status, 201);
    clock.pin('2026-10-23T00:30:00+07:00');
    assert.equal((await api().post('/api/merchant/listings').set(bearer(mt)).send({ ...valid, closeTime: '01:00' })).status, 201);
  });
  test('ubah stok: absolut, delta (tidak kurang dari 0), dan tandai habis', async () => {
    const mt = await login('bahari@merchant.com');
    const p = (body) => api().patch('/api/merchant/listings/1').set(bearer(mt)).send(body);
    assert.equal((await p({ stock: 2 })).body.item.stock, 2);
    assert.equal((await p({ stockDelta: 1 })).body.item.stock, 3);
    assert.equal((await p({ stockDelta: -99 })).body.item.stock, 0);
    const out = await p({ stockDelta: 0 });
    assert.equal(out.body.item.state, 'soldout');
    assert.equal((await p({ stock: 3 })).body.item.state, 'live');
    const sold = await p({ soldOut: true });
    assert.equal(sold.body.item.stock, 0);
    assert.equal(sold.body.item.state, 'soldout');
  });
  test('menambah stok melebihi stok awal menaikkan initial_stock', async () => {
    const mt = await login('bahari@merchant.com');
    const r = await api().patch('/api/merchant/listings/1').set(bearer(mt)).send({ stock: 9 });
    assert.equal(r.body.item.initialStock, 9);
  });
  test('jeda dan aktifkan listing, harga diskon ikut dihitung ulang saat jam tutup diubah', async () => {
    const mt = await login('bahari@merchant.com');
    const paused = await api().patch('/api/merchant/listings/1').set(bearer(mt)).send({ isActive: false });
    assert.equal(paused.body.item.state, 'paused');
    const back = await api().patch('/api/merchant/listings/1').set(bearer(mt)).send({ isActive: true, closeTime: '20:30' });
    assert.equal(back.body.item.state, 'live');
    assert.equal(back.body.item.discountPct, 40, 'tutup 20.30, sekarang 19.45: sisa 45 menit -> 40%');
  });
  test('patch tidak valid -> 400; kosong -> 400', async () => {
    const mt = await login('bahari@merchant.com');
    const p = (b) => api().patch('/api/merchant/listings/1').set(bearer(mt)).send(b);
    for (const b of [{ isActive: 'ya' }, { stock: -1 }, { stock: 'x' }, { normalPrice: 10 }, { closeTime: 'x' }, {}]) assert.equal((await p(b)).status, 400, JSON.stringify(b));
  });
  test('merchant lain tidak bisa mengubah atau menghapus listing yang bukan miliknya', async () => {
    const mt = await login('sari@merchant.com');
    assert.equal((await api().patch('/api/merchant/listings/1').set(bearer(mt)).send({ stock: 99 })).status, 404);
    assert.equal((await api().delete('/api/merchant/listings/1').set(bearer(mt))).status, 404);
    assert.equal((await db.query('SELECT stock FROM listings WHERE id = 1'))[0].stock, 5);
  });
  test('hapus listing: 204 lalu 404', async () => {
    const mt = await login('bahari@merchant.com');
    assert.equal((await api().delete('/api/merchant/listings/7').set(bearer(mt))).status, 204);
    assert.equal((await api().delete('/api/merchant/listings/7').set(bearer(mt))).status, 404);
    assert.equal((await api().get('/api/listings/7')).status, 404);
  });
  test('listing yang sudah punya reservasi tidak dapat dihapus (409), tapi bisa dijeda', async () => {
    await db.query("INSERT INTO reservations (user_id, listing_id, qty, unit_price, normal_price) VALUES (1, 1, 1, 17500, 25000)");
    const mt = await login('bahari@merchant.com');
    const r = await api().delete('/api/merchant/listings/1').set(bearer(mt));
    assert.equal(r.status, 409);
    assert.equal(r.body.error.code, 'LISTING_HAS_RESERVATIONS');
    assert.equal((await api().patch('/api/merchant/listings/1').set(bearer(mt)).send({ isActive: false })).status, 200);
  });
  test('pencegahan injeksi: input berisi SQL diperlakukan sebagai teks', async () => {
    const mt = await login('bahari@merchant.com');
    const name = "'); DROP TABLE listings; --";
    const r = await api().post('/api/merchant/listings').set(bearer(mt)).send({ ...valid, name });
    assert.equal(r.status, 201);
    assert.equal(r.body.item.name, name);
    assert.equal((await api().get('/api/listings?q=' + encodeURIComponent("' OR 1=1 --"))).body.items.length, 0);
    assert.ok((await db.query('SELECT COUNT(*) n FROM listings'))[0].n >= 8);
  });
});

// satu kali per berkas: tutup koneksi database setelah semua pengujian selesai
after(close);
