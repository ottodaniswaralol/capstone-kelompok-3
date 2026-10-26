'use strict';
const { query } = require('../config/db');
const { isTime, str, fail } = require('../utils/validate');
const clock = require('../services/clock.service');
const { merchantDto } = require('./auth.controller');

/** Profil usaha (FR-03/FR-04). Perubahan alamat saat status Review mengembalikan validasi alamat ke pending. */
async function updateProfile(req, res) {
  const m = req.merchant, b = req.body;
  const name = str(b.name, { max: 120 }), address = str(b.address, { max: 255 });
  const openTime = b.openTime || String(m.open_time).slice(0, 5), closeTime = b.closeTime || String(m.close_time).slice(0, 5);
  const errors = [];
  if (!name) errors.push('Nama usaha wajib diisi');
  if (!address) errors.push('Alamat wajib diisi');
  if (!isTime(openTime) || !isTime(closeTime)) errors.push('Format jam harus HH:MM');
  else if (clock.parseHHMM(closeTime) <= clock.parseHHMM(openTime)) errors.push('Jam tutup harus setelah jam buka');
  fail(errors);
  const sets = ['name = ?', 'open_time = ?', 'close_time = ?'];
  const vals = [name, openTime + ':00', closeTime + ':00'];
  if (address !== m.address) {
    sets.push('address = ?', 'submitted_address = ?');
    vals.push(address, address);
    if (m.status === 'review') sets.push("address_status = 'pending'", 'map_checked = 0', 'verified_address = NULL');
  }
  await query('UPDATE merchants SET ' + sets.join(', ') + ' WHERE id = ?', [...vals, m.id]);
  const [row] = await query('SELECT * FROM merchants WHERE id = ?', [m.id]);
  res.json({ merchant: merchantDto(row) });
}

module.exports = { updateProfile };
