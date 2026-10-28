'use strict';
const bcrypt = require('bcryptjs');
const { query, tx } = require('../config/db');
const { signToken } = require('../middleware/auth');
const HttpError = require('../utils/httpError');
const { isEmail, isTime, str, fail } = require('../utils/validate');
const clock = require('../services/clock.service');

const userDto = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, area: u.area || null });
const merchantDto = (m) => m && ({
  id: m.id, name: m.name, address: m.address, submittedAddress: m.submitted_address, verifiedAddress: m.verified_address,
  addressStatus: m.address_status, mapChecked: !!m.map_checked, lat: m.lat, lng: m.lng,
  openTime: String(m.open_time).slice(0, 5), closeTime: String(m.close_time).slice(0, 5), status: m.status,
});

// Titik acuan dan posisi awal merchant baru (sebelum ada geocoding). Admin memverifikasi alamat lewat Google Maps.
const REF = { lat: -6.26, lng: 106.81 };
const OFFSETS_KM = [[1.5, 1.0], [-2.0, -1.5], [3.0, -2.0], [-1.0, 3.5], [0.5, -3.0], [2.5, 2.5]];
function placeholderCoords(index) {
  const [x, y] = OFFSETS_KM[index % OFFSETS_KM.length];
  return { lat: +(REF.lat - y / 111.19).toFixed(6), lng: +(REF.lng + x / 110.657).toFixed(6) };
}

async function currentMerchant(userId) {
  const [m] = await query('SELECT * FROM merchants WHERE user_id = ?', [userId]);
  return m || null;
}

function checkAccount({ name, email, password }) {
  const errors = [];
  if (!str(name, { max: 100 })) errors.push('Nama wajib diisi (maks. 100 karakter)');
  if (!isEmail(email)) errors.push('Format email belum benar');
  if (typeof password !== 'string' || password.length < 8) errors.push('Kata sandi minimal 8 karakter');
  if (typeof password === 'string' && password.length > 72) errors.push('Kata sandi maksimal 72 karakter');
  return errors;
}

async function login(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = req.body.password;
  fail([...(isEmail(email) ? [] : ['Format email belum benar']), ...(typeof password === 'string' && password ? [] : ['Kata sandi wajib diisi'])]);
  const [u] = await query('SELECT * FROM users WHERE email = ?', [email]);
  const ok = u && (await bcrypt.compare(password, u.password_hash));
  if (!ok) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email atau kata sandi salah');
  if (!u.is_active) throw new HttpError(403, 'ACCOUNT_DISABLED', 'Akun ini dinonaktifkan. Hubungi administrator.');
  const m = u.role === 'merchant' ? await currentMerchant(u.id) : null;
  if (m && m.status === 'rejected') throw new HttpError(403, 'MERCHANT_REJECTED', 'Pendaftaran merchant Anda ditolak. Hubungi administrator.');
  res.json({ token: signToken(u), user: userDto(u), merchant: merchantDto(m) });
}

async function registerConsumer(req, res) {
  const { name, password } = req.body;
  const email = String(req.body.email || '').trim().toLowerCase();
  fail(checkAccount({ name, email, password }));
  const hash = await bcrypt.hash(password, 10);
  let id;
  try {
    const r = await query('INSERT INTO users (name, email, password_hash, role, area) VALUES (?, ?, ?, \'consumer\', ?)', [name.trim(), email, hash, str(req.body.area, { max: 60 })]);
    id = r.insertId;
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'EMAIL_TAKEN', 'Email sudah terdaftar');
    throw err;
  }
  const [u] = await query('SELECT * FROM users WHERE id = ?', [id]);
  res.status(201).json({ token: signToken(u), user: userDto(u), merchant: null });
}

async function registerMerchant(req, res) {
  const b = req.body;
  const email = String(b.email || '').trim().toLowerCase();
  const errors = checkAccount({ name: b.ownerName, email, password: b.password });
  if (!str(b.businessName, { max: 120 })) errors.push('Nama usaha wajib diisi');
  if (!str(b.address, { max: 255 })) errors.push('Alamat usaha wajib diisi');
  const openTime = b.openTime || '07:00';
  const closeTime = b.closeTime || '21:00';
  if (!isTime(openTime) || !isTime(closeTime)) errors.push('Format jam buka/tutup harus HH:MM');
  else if (clock.parseHHMM(closeTime) <= clock.parseHHMM(openTime)) errors.push('Jam tutup harus setelah jam buka');
  fail(errors);
  const hash = await bcrypt.hash(b.password, 10);
  const address = b.address.trim();
  const out = await tx(async (conn) => {
    let userId;
    try {
      [{ insertId: userId }] = await conn.query('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, \'merchant\')', [b.ownerName.trim(), email, hash]);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'EMAIL_TAKEN', 'Email sudah terdaftar');
      throw err;
    }
    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM merchants');
    const c = placeholderCoords(n);
    await conn.query(
      'INSERT INTO merchants (user_id, name, address, submitted_address, lat, lng, open_time, close_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, b.businessName.trim(), address, address, c.lat, c.lng, openTime + ':00', closeTime + ':00'],
    );
    return userId;
  });
  const [u] = await query('SELECT * FROM users WHERE id = ?', [out]);
  res.status(201).json({ token: signToken(u), user: userDto(u), merchant: merchantDto(await currentMerchant(u.id)) });
}

async function me(req, res) {
  const m = req.user.role === 'merchant' ? await currentMerchant(req.user.id) : null;
  res.json({ user: userDto(req.user), merchant: merchantDto(m) });
}

async function updateMe(req, res) {
  const name = str(req.body.name, { max: 100 });
  fail(name ? [] : ['Nama tidak boleh kosong']);
  await query('UPDATE users SET name = ?, area = ? WHERE id = ?', [name, str(req.body.area, { max: 60 }), req.user.id]);
  const [u] = await query('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json({ user: userDto(u) });
}

async function changePassword(req, res) {
  const { oldPassword, newPassword } = req.body;
  const [u] = await query('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (typeof oldPassword !== 'string' || !(await bcrypt.compare(oldPassword, u.password_hash))) throw new HttpError(400, 'WRONG_PASSWORD', 'Kata sandi lama salah');
  fail(typeof newPassword === 'string' && newPassword.length >= 8 && newPassword.length <= 72 ? [] : ['Kata sandi baru minimal 8 karakter']);
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(newPassword, 10), req.user.id]);
  res.json({ ok: true });
}

module.exports = { login, registerConsumer, registerMerchant, me, updateMe, changePassword, userDto, merchantDto };
