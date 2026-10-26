'use strict';
const HttpError = require('../utils/httpError');
const { query } = require('../config/db');

/** Role-based access: requireRole('merchant'), requireRole('admin', 'merchant') */
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user && req.user.role) ? next() : next(new HttpError(403, 'FORBIDDEN', 'Anda tidak memiliki akses ke sumber daya ini'));

/** Memuat data merchant milik pengguna yang login ke req.merchant */
async function loadMerchant(req, res, next) {
  try {
    const [m] = await query('SELECT * FROM merchants WHERE user_id = ?', [req.user.id]);
    if (!m) throw new HttpError(403, 'NO_MERCHANT', 'Akun ini belum memiliki profil merchant');
    req.merchant = m;
    next();
  } catch (err) { next(err); }
}

module.exports = { requireRole, loadMerchant };
