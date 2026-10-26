'use strict';
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { query } = require('../config/db');
const HttpError = require('../utils/httpError');

const signToken = (user) => jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

/** Wajib login: membaca Bearer token, memuat pengguna dari DB (status aktif dicek setiap request) */
async function requireAuth(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) throw new HttpError(401, 'UNAUTHENTICATED', 'Silakan masuk terlebih dahulu');
    let payload;
    try { payload = jwt.verify(token, config.jwtSecret); }
    catch { throw new HttpError(401, 'INVALID_TOKEN', 'Sesi tidak valid atau sudah berakhir, silakan masuk lagi'); }
    const [user] = await query('SELECT id, name, email, role, area, is_active FROM users WHERE id = ?', [payload.sub]);
    if (!user) throw new HttpError(401, 'INVALID_TOKEN', 'Akun tidak ditemukan');
    if (!user.is_active) throw new HttpError(403, 'ACCOUNT_DISABLED', 'Akun ini dinonaktifkan');
    req.user = user;
    next();
  } catch (err) { next(err); }
}

module.exports = { signToken, requireAuth };
