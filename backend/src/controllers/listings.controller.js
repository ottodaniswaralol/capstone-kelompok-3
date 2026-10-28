'use strict';
const listingService = require('../services/listing.service');
const discount = require('../services/discount.service');
const clock = require('../services/clock.service');
const HttpError = require('../utils/httpError');
const { isTime, str, int, fail } = require('../utils/validate');

const num = (v) => (v === undefined || v === '' ? null : Number(v));

/* ---------- publik ---------- */
async function listPublic(req, res) {
  const lat = num(req.query.lat), lng = num(req.query.lng), radius = num(req.query.radius);
  const errors = [];
  if ((lat === null) !== (lng === null)) errors.push('lat dan lng harus diisi bersamaan');
  if (lat !== null && (!(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180))) errors.push('Koordinat tidak valid');
  if (radius !== null && !(radius > 0 && radius <= 100)) errors.push('radius harus antara 0 dan 100 km');
  if (radius !== null && lat === null) errors.push('radius memerlukan lat dan lng');
  const sort = req.query.sort || 'near';
  if (!['near', 'disc', 'close'].includes(sort)) errors.push('sort harus near, disc, atau close');
  const state = req.query.state || 'all';
  if (!['all', 'live', 'upcoming'].includes(state)) errors.push('state harus all, live, atau upcoming');
  fail(errors);
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
  const items = await listingService.listPublic({ lat, lng, radius, q, sort, state });
  res.json({ items, count: items.length, serverTime: clock.timeString() });
}

async function getPublic(req, res) {
  const id = int(req.params.id, { min: 1 });
  if (!id) throw new HttpError(404, 'LISTING_NOT_FOUND', 'Listing tidak ditemukan');
  const lat = num(req.query.lat), lng = num(req.query.lng);
  res.json({ item: await listingService.getPublic(id, { lat, lng }) });
}

/* ---------- merchant ---------- */
async function listMine(req, res) {
  const items = await listingService.listByMerchant(req.merchant.id);
  res.json({ items, count: items.length, serverTime: clock.timeString(), canCreate: discount.canCreateListing(clock.minuteOfDay()) });
}

async function createMine(req, res) {
  const m = req.merchant;
  if (m.status !== 'active') throw new HttpError(403, 'MERCHANT_NOT_ACTIVE', 'Akun belum diverifikasi admin');
  const nowMin = clock.minuteOfDay();
  if (!discount.canCreateListing(nowMin)) throw new HttpError(403, 'LISTING_WINDOW_CLOSED', 'Listing baru hanya dapat dibuat pukul 19.00 sampai 00.59. Pukul 01.00 sampai 18.59 listing dikunci.');
  const b = req.body;
  const errors = [];
  const name = str(b.name, { max: 120 });
  const normalPrice = int(b.normalPrice, { min: 1000, max: 1000000 });
  const stock = int(b.stock, { min: 1, max: 999 });
  const emoji = b.emoji === undefined ? '🍱' : str(b.emoji, { max: 16 });
  const note = b.note === undefined || b.note === null || b.note === '' ? null : str(b.note, { max: 255 });
  if (!name) errors.push('Nama makanan wajib diisi (maks. 120 karakter)');
  if (normalPrice === null) errors.push('Harga normal harus bilangan bulat antara Rp1.000 dan Rp1.000.000');
  if (stock === null) errors.push('Jumlah porsi harus bilangan bulat antara 1 dan 999');
  if (emoji === null) errors.push('Ikon tidak valid');
  if (b.note && note === null) errors.push('Catatan maksimal 255 karakter');
  if (!isTime(b.closeTime)) errors.push('Jam tutup harus berformat HH:MM');
  fail(errors);
  if (clock.parseHHMM(b.closeTime) <= nowMin) throw new HttpError(400, 'CLOSE_TIME_PASSED', 'Jam tutup harus setelah waktu saat ini (' + clock.timeString() + ')');
  const item = await listingService.create(m.id, { name, emoji, note, normalPrice, stock, closeTime: b.closeTime });
  res.status(201).json({ item });
}

async function updateMine(req, res) {
  const id = int(req.params.id, { min: 1 });
  if (!id) throw new HttpError(404, 'LISTING_NOT_FOUND', 'Listing tidak ditemukan');
  const b = req.body;
  const cur = await listingService.getOwned(req.merchant.id, id);
  const patch = {};
  const errors = [];
  if (b.name !== undefined) { const v = str(b.name, { max: 120 }); v ? (patch.name = v) : errors.push('Nama makanan tidak valid'); }
  if (b.emoji !== undefined) { const v = str(b.emoji, { max: 16 }); v ? (patch.emoji = v) : errors.push('Ikon tidak valid'); }
  if (b.note !== undefined) { if (b.note === null || b.note === '') patch.note = null; else { const v = str(b.note, { max: 255 }); v ? (patch.note = v) : errors.push('Catatan maksimal 255 karakter'); } }
  if (b.normalPrice !== undefined) { const v = int(b.normalPrice, { min: 1000, max: 1000000 }); v ? (patch.normalPrice = v) : errors.push('Harga normal tidak valid'); }
  if (b.closeTime !== undefined) { isTime(b.closeTime) ? (patch.closeTime = b.closeTime) : errors.push('Jam tutup harus berformat HH:MM'); }
  if (b.isActive !== undefined) { typeof b.isActive === 'boolean' ? (patch.isActive = b.isActive) : errors.push('isActive harus true atau false'); }
  if (b.stock !== undefined) { const v = int(b.stock, { min: 0, max: 999 }); v !== null ? (patch.stock = v) : errors.push('stock harus bilangan bulat 0 sampai 999'); }
  if (b.stockDelta !== undefined) { const v = int(b.stockDelta, { min: -999, max: 999 }); v !== null ? (patch.stock = Math.min(999, Math.max(0, cur.stock + v))) : errors.push('stockDelta tidak valid'); }
  if (b.soldOut === true) patch.stock = 0;
  fail(errors);
  const item = await listingService.update(req.merchant.id, id, patch);
  res.json({ item });
}

async function removeMine(req, res) {
  const id = int(req.params.id, { min: 1 });
  if (!id) throw new HttpError(404, 'LISTING_NOT_FOUND', 'Listing tidak ditemukan');
  await listingService.remove(req.merchant.id, id);
  res.status(204).end();
}

module.exports = { listPublic, getPublic, listMine, createMine, updateMine, removeMine };
