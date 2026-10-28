'use strict';
const { query } = require('../config/db');
const HttpError = require('../utils/httpError');
const { str, int, fail } = require('../utils/validate');
const { merchantDto } = require('./auth.controller');

/* Admin minimal untuk Minggu 7 agar alur registrasi merchant dapat dipakai.
   Dashboard admin penuh (FR-14) dikerjakan pada Minggu 12. */
async function listMerchants(req, res) {
  const rows = await query('SELECT m.*, u.name AS owner_name, u.email AS owner_email FROM merchants m JOIN users u ON u.id = m.user_id ORDER BY m.id');
  res.json({ items: rows.map((r) => ({ ...merchantDto(r), ownerName: r.owner_name, ownerEmail: r.owner_email, userId: r.user_id })) });
}

async function findMerchant(req) {
  const id = int(req.params.id, { min: 1 });
  const [m] = id ? await query('SELECT * FROM merchants WHERE id = ?', [id]) : [];
  if (!m) throw new HttpError(404, 'MERCHANT_NOT_FOUND', 'Merchant tidak ditemukan');
  return m;
}

async function reviewAddress(req, res) {
  const m = await findMerchant(req);
  const { result } = req.body;
  fail(['verified', 'needs_revision'].includes(result) ? [] : ['result harus verified atau needs_revision']);
  if (result === 'verified') {
    const corrected = str(req.body.verifiedAddress, { max: 255 }) || m.submitted_address;
    await query("UPDATE merchants SET verified_address = ?, address = ?, address_status = 'verified', map_checked = 1 WHERE id = ?", [corrected, corrected, m.id]);
  } else {
    await query("UPDATE merchants SET address_status = 'needs_revision', map_checked = 1 WHERE id = ?", [m.id]);
  }
  const [row] = await query('SELECT * FROM merchants WHERE id = ?', [m.id]);
  res.json({ merchant: merchantDto(row) });
}

async function setStatus(req, res) {
  const m = await findMerchant(req);
  const { status } = req.body;
  fail(['active', 'rejected'].includes(status) ? [] : ['status harus active atau rejected']);
  if (status === 'active' && m.status === 'review' && m.address_status !== 'verified') {
    throw new HttpError(409, 'ADDRESS_NOT_VERIFIED', 'Validasi alamat merchant melalui Google Maps terlebih dahulu');
  }
  await query('UPDATE merchants SET status = ? WHERE id = ?', [status, m.id]);
  const [row] = await query('SELECT * FROM merchants WHERE id = ?', [m.id]);
  res.json({ merchant: merchantDto(row) });
}

async function schedulerLogs(req, res) {
  const limit = int(req.query.limit, { min: 1, max: 200 }) || 30;
  const rows = await query('SELECT * FROM scheduler_logs ORDER BY id DESC LIMIT ?', [limit]);
  res.json({ items: rows.map((r) => ({ id: r.id, job: r.job, startedAt: r.started_at, finishedAt: r.finished_at, status: r.status, attempts: r.attempts, checked: r.listings_checked, updated: r.listings_updated, message: r.message })) });
}

module.exports = { listMerchants, reviewAddress, setStatus, schedulerLogs };
