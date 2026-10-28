'use strict';
const { api, resetDb, login, bearer, close, db } = require('./helpers/setup');
const { test, describe, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');

describe('auth: login, registrasi, profil', () => {
  before(() => resetDb());
  beforeEach(() => resetDb());

  test('login berhasil untuk tiga peran dan peran terbaca dari akun', async () => {
    for (const [email, role] of [['ghefa@gmail.com', 'consumer'], ['bahari@merchant.com', 'merchant'], ['ghefa@admin.com', 'admin']]) {
      const r = await api().post('/api/auth/login').send({ email, password: '12345678' });
      assert.equal(r.status, 200, email);
      assert.equal(r.body.user.role, role);
      assert.ok(r.body.token);
      assert.equal(r.body.user.password_hash, undefined, 'hash tidak boleh bocor');
    }
  });
  test('login merchant menyertakan profil usaha', async () => {
    const r = await api().post('/api/auth/login').send({ email: 'bahari@merchant.com', password: '12345678' });
    assert.equal(r.body.merchant.name, 'Warteg Bahari');
    assert.equal(r.body.merchant.status, 'active');
  });
  test('kata sandi salah dan email tidak dikenal sama-sama 401', async () => {
    assert.equal((await api().post('/api/auth/login').send({ email: 'ghefa@gmail.com', password: 'salah-salah' })).status, 401);
    assert.equal((await api().post('/api/auth/login').send({ email: 'tidak@ada.com', password: '12345678' })).status, 401);
  });
  test('input login tidak valid -> 400', async () => {
    assert.equal((await api().post('/api/auth/login').send({ email: 'bukan-email', password: 'x' })).status, 400);
    assert.equal((await api().post('/api/auth/login').send({})).status, 400);
  });
  test('akun nonaktif ditolak 403', async () => {
    await db.query("UPDATE users SET is_active = 0 WHERE email = 'rafli@gmail.com'");
    const r = await api().post('/api/auth/login').send({ email: 'rafli@gmail.com', password: '12345678' });
    assert.equal(r.status, 403);
    assert.equal(r.body.error.code, 'ACCOUNT_DISABLED');
  });
  test('token milik akun yang kemudian dinonaktifkan ditolak', async () => {
    const t = await login('rafli@gmail.com');
    await db.query("UPDATE users SET is_active = 0 WHERE email = 'rafli@gmail.com'");
    assert.equal((await api().get('/api/auth/me').set(bearer(t))).status, 403);
  });
  test('merchant yang ditolak tidak bisa masuk', async () => {
    await db.query("UPDATE merchants SET status = 'rejected' WHERE id = 1");
    const r = await api().post('/api/auth/login').send({ email: 'bahari@merchant.com', password: '12345678' });
    assert.equal(r.status, 403);
    assert.equal(r.body.error.code, 'MERCHANT_REJECTED');
  });

  test('registrasi pembeli: 201, langsung bisa dipakai, email unik', async () => {
    const r = await api().post('/api/auth/register/consumer').send({ name: 'Budi', email: 'Budi@Gmail.com', password: 'rahasia123', area: 'Depok' });
    assert.equal(r.status, 201);
    assert.equal(r.body.user.email, 'budi@gmail.com');
    assert.equal(r.body.user.role, 'consumer');
    const me = await api().get('/api/auth/me').set(bearer(r.body.token));
    assert.equal(me.body.user.name, 'Budi');
    const dup = await api().post('/api/auth/register/consumer').send({ name: 'Budi 2', email: 'budi@gmail.com', password: 'rahasia123' });
    assert.equal(dup.status, 409);
    assert.equal(dup.body.error.code, 'EMAIL_TAKEN');
  });
  test('registrasi pembeli: validasi nama, email, kata sandi', async () => {
    assert.equal((await api().post('/api/auth/register/consumer').send({ name: '', email: 'a@b.co', password: '12345678' })).status, 400);
    assert.equal((await api().post('/api/auth/register/consumer').send({ name: 'A', email: 'salah', password: '12345678' })).status, 400);
    assert.equal((await api().post('/api/auth/register/consumer').send({ name: 'A', email: 'a@b.co', password: 'pendek' })).status, 400);
  });
  test('kata sandi disimpan sebagai hash bcrypt, bukan teks asli', async () => {
    await api().post('/api/auth/register/consumer').send({ name: 'Cek', email: 'cek@gmail.com', password: 'rahasia123' });
    const [u] = await db.query("SELECT password_hash FROM users WHERE email = 'cek@gmail.com'");
    assert.match(u.password_hash, /^\$2[aby]\$10\$/);
    assert.notEqual(u.password_hash, 'rahasia123');
  });
  test('registrasi merchant: status Review, alamat pending, belum bisa membuat listing', async () => {
    const r = await api().post('/api/auth/register/merchant').send({ ownerName: 'Pak Baru', email: 'baru@merchant.com', password: 'rahasia123', businessName: 'Warung Baru', address: 'Jl. Baru 1', openTime: '07:00', closeTime: '22:00' });
    assert.equal(r.status, 201);
    assert.equal(r.body.merchant.status, 'review');
    assert.equal(r.body.merchant.addressStatus, 'pending');
    const c = await api().post('/api/merchant/listings').set(bearer(r.body.token)).send({ name: 'X', normalPrice: 10000, stock: 2, closeTime: '21:30' });
    assert.equal(c.status, 403);
    assert.equal(c.body.error.code, 'MERCHANT_NOT_ACTIVE');
  });
  test('registrasi merchant: validasi jam dan data wajib', async () => {
    const ok = { ownerName: 'A', email: 'a@m.com', password: 'rahasia123', businessName: 'B', address: 'C', openTime: '07:00', closeTime: '21:00' };
    assert.equal((await api().post('/api/auth/register/merchant').send({ ...ok, closeTime: '06:00' })).status, 400);
    assert.equal((await api().post('/api/auth/register/merchant').send({ ...ok, openTime: '7' })).status, 400);
    assert.equal((await api().post('/api/auth/register/merchant').send({ ...ok, businessName: '' })).status, 400);
    assert.equal((await api().post('/api/auth/register/merchant').send({ ...ok, address: '' })).status, 400);
  });
  test('registrasi merchant dengan email duplikat tidak meninggalkan data setengah jadi', async () => {
    const before = (await db.query('SELECT COUNT(*) n FROM users'))[0].n;
    const r = await api().post('/api/auth/register/merchant').send({ ownerName: 'A', email: 'bahari@merchant.com', password: 'rahasia123', businessName: 'B', address: 'C' });
    assert.equal(r.status, 409);
    assert.equal((await db.query('SELECT COUNT(*) n FROM users'))[0].n, before);
  });

  test('token palsu atau rusak -> 401', async () => {
    assert.equal((await api().get('/api/auth/me').set(bearer('abc.def.ghi'))).status, 401);
    const t = await login('ghefa@gmail.com');
    assert.equal((await api().get('/api/auth/me').set(bearer(t.slice(0, -3) + 'xxx'))).status, 401);
    assert.equal((await api().get('/api/auth/me')).status, 401);
  });
  test('ubah profil pembeli dan ubah kata sandi', async () => {
    const t = await login('ghefa@gmail.com');
    const p = await api().patch('/api/auth/me').set(bearer(t)).send({ name: 'Ghefari Baru', area: 'Depok' });
    assert.equal(p.body.user.name, 'Ghefari Baru');
    assert.equal((await api().patch('/api/auth/me').set(bearer(t)).send({ name: '  ' })).status, 400);
    assert.equal((await api().post('/api/auth/change-password').set(bearer(t)).send({ oldPassword: 'salah', newPassword: 'baru12345' })).status, 400);
    assert.equal((await api().post('/api/auth/change-password').set(bearer(t)).send({ oldPassword: '12345678', newPassword: 'pendek' })).status, 400);
    assert.equal((await api().post('/api/auth/change-password').set(bearer(t)).send({ oldPassword: '12345678', newPassword: 'baru12345' })).status, 200);
    assert.equal((await api().post('/api/auth/login').send({ email: 'ghefa@gmail.com', password: '12345678' })).status, 401);
    assert.equal((await api().post('/api/auth/login').send({ email: 'ghefa@gmail.com', password: 'baru12345' })).status, 200);
  });
  test('profil usaha: ubah alamat saat Review mengembalikan validasi ke pending', async () => {
    const reg = await api().post('/api/auth/register/merchant').send({ ownerName: 'A', email: 'p@m.com', password: 'rahasia123', businessName: 'Usaha P', address: 'Jl. Lama 1' });
    const admin = await login('ghefa@admin.com');
    const id = reg.body.merchant.id;
    await api().patch(`/api/admin/merchants/${id}/address`).set(bearer(admin)).send({ result: 'verified' });
    const patch = await api().patch('/api/merchant/profile').set(bearer(reg.body.token)).send({ name: 'Usaha P', address: 'Jl. Baru 99', openTime: '08:00', closeTime: '20:00' });
    assert.equal(patch.status, 200);
    assert.equal(patch.body.merchant.addressStatus, 'pending');
    assert.equal(patch.body.merchant.openTime, '08:00');
    assert.equal((await api().patch('/api/merchant/profile').set(bearer(reg.body.token)).send({ name: 'X', address: 'Y', openTime: '10:00', closeTime: '09:00' })).status, 400);
  });
});

describe('admin: verifikasi merchant (minimal Minggu 7)', () => {
  beforeEach(() => resetDb());

  test('alur lengkap: daftar -> verifikasi alamat -> setujui -> bisa membuat listing', async () => {
    const reg = await api().post('/api/auth/register/merchant').send({ ownerName: 'Pak Baru', email: 'baru@merchant.com', password: 'rahasia123', businessName: 'Warung Baru', address: 'Jl. Baru 1', closeTime: '22:00' });
    const id = reg.body.merchant.id;
    const admin = await login('ghefa@admin.com');
    const approveEarly = await api().patch(`/api/admin/merchants/${id}/status`).set(bearer(admin)).send({ status: 'active' });
    assert.equal(approveEarly.status, 409, 'tidak boleh disetujui sebelum alamat diverifikasi');
    assert.equal(approveEarly.body.error.code, 'ADDRESS_NOT_VERIFIED');
    const ver = await api().patch(`/api/admin/merchants/${id}/address`).set(bearer(admin)).send({ result: 'verified', verifiedAddress: 'Jl. Baru No. 1, Jakarta Selatan' });
    assert.equal(ver.body.merchant.addressStatus, 'verified');
    assert.equal(ver.body.merchant.address, 'Jl. Baru No. 1, Jakarta Selatan');
    const ok = await api().patch(`/api/admin/merchants/${id}/status`).set(bearer(admin)).send({ status: 'active' });
    assert.equal(ok.body.merchant.status, 'active');
    const c = await api().post('/api/merchant/listings').set(bearer(reg.body.token)).send({ name: 'Nasi Uduk', normalPrice: 15000, stock: 3, closeTime: '21:30' });
    assert.equal(c.status, 201);
  });
  test('alamat perlu perbaikan dan penolakan merchant', async () => {
    const reg = await api().post('/api/auth/register/merchant').send({ ownerName: 'A', email: 'x@m.com', password: 'rahasia123', businessName: 'X', address: 'Jl. X' });
    const admin = await login('ghefa@admin.com');
    const id = reg.body.merchant.id;
    const r1 = await api().patch(`/api/admin/merchants/${id}/address`).set(bearer(admin)).send({ result: 'needs_revision' });
    assert.equal(r1.body.merchant.addressStatus, 'needs_revision');
    assert.equal((await api().patch(`/api/admin/merchants/${id}/address`).set(bearer(admin)).send({ result: 'asal' })).status, 400);
    await api().patch(`/api/admin/merchants/${id}/status`).set(bearer(admin)).send({ status: 'rejected' });
    assert.equal((await api().post('/api/auth/login').send({ email: 'x@m.com', password: 'rahasia123' })).status, 403);
    assert.equal((await api().patch('/api/admin/merchants/9999/status').set(bearer(admin)).send({ status: 'active' })).status, 404);
  });
  test('hanya admin: pembeli dan merchant dapat 403', async () => {
    for (const email of ['ghefa@gmail.com', 'bahari@merchant.com']) {
      const t = await login(email);
      assert.equal((await api().get('/api/admin/merchants').set(bearer(t))).status, 403, email);
      assert.equal((await api().get('/api/admin/scheduler/logs').set(bearer(t))).status, 403, email);
    }
    assert.equal((await api().get('/api/admin/merchants')).status, 401);
  });
  test('admin melihat semua merchant beserta pemiliknya', async () => {
    const admin = await login('ghefa@admin.com');
    const r = await api().get('/api/admin/merchants').set(bearer(admin));
    assert.equal(r.body.items.length, 7);
    assert.equal(r.body.items.find((m) => m.name === 'Dapur Bu Maya').status, 'review');
    assert.equal(r.body.items[0].ownerEmail, 'bahari@merchant.com');
  });
});

// satu kali per berkas: tutup koneksi database setelah semua pengujian selesai
after(close);
