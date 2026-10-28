'use strict';
const { query, tx } = require('../config/db');
const clock = require('./clock.service');
const discount = require('./discount.service');
const { HAVERSINE_SQL } = require('./geo.service');
const HttpError = require('../utils/httpError');

const hhmm = (t) => String(t).slice(0, 5);
const minutes = (t) => clock.parseHHMM(t);

/** Baris DB (listing + merchant) menjadi DTO API */
function toDto(r, nowMin = clock.minuteOfDay()) {
  const remaining = minutes(r.close_time) - nowMin;
  const price = r.discount_price != null ? r.discount_price : r.normal_price;
  return {
    id: r.id,
    merchant: r.m_id != null ? { id: r.m_id, name: r.m_name, address: r.m_address, lat: r.lat, lng: r.lng, status: r.m_status } : undefined,
    name: r.name,
    emoji: r.emoji,
    note: r.note,
    normalPrice: r.normal_price,
    price,
    discountPct: r.discount_pct,
    stock: r.stock,
    initialStock: r.initial_stock,
    closeTime: hhmm(r.close_time),
    isActive: !!r.is_active,
    state: r.state,
    remainingMinutes: remaining,
    nextDiscount: r.state === 'live' ? discount.nextDiscount(remaining) : null,
    distanceKm: r.distance_km != null ? Math.round(r.distance_km * 100) / 100 : null,
  };
}

const BASE_SELECT =
  'SELECT l.*, m.id AS m_id, m.name AS m_name, m.address AS m_address, m.lat, m.lng, m.status AS m_status';

/** Daftar publik: hanya merchant aktif; state live/upcoming. Mendukung radius (Haversine), pencarian, urutan */
async function listPublic({ lat, lng, radius, q, sort = 'near', state = 'all' }) {
  const hasGeo = lat != null && lng != null;
  const params = [];
  let sql = BASE_SELECT;
  if (hasGeo) { sql += ', ' + HAVERSINE_SQL + ' AS distance_km'; params.push(lat, lat, lng); }
  sql += ' FROM listings l JOIN merchants m ON m.id = l.merchant_id WHERE m.status = \'active\'';
  const states = state === 'live' ? ['live'] : state === 'upcoming' ? ['upcoming'] : ['live', 'upcoming'];
  sql += ' AND l.state IN (?)'; params.push(states);
  if (q) { sql += ' AND (l.name LIKE ? OR m.name LIKE ?)'; const like = '%' + q.replace(/[%_\\]/g, (c) => '\\' + c) + '%'; params.push(like, like); }
  if (hasGeo && radius != null) { sql += ' HAVING distance_km <= ?'; params.push(radius); }
  const order = { near: hasGeo ? 'distance_km ASC, l.id ASC' : 'l.id ASC', disc: 'l.discount_pct DESC, l.id ASC', close: 'l.close_time ASC, l.id ASC' }[sort] || 'l.id ASC';
  sql += ' ORDER BY ' + order;
  const rows = await query(sql, params);
  const nowMin = clock.minuteOfDay();
  return rows.map((r) => toDto(r, nowMin));
}

async function getPublic(id, { lat, lng } = {}) {
  const hasGeo = lat != null && lng != null;
  const params = [];
  let sql = BASE_SELECT;
  if (hasGeo) { sql += ', ' + HAVERSINE_SQL + ' AS distance_km'; params.push(lat, lat, lng); }
  sql += ' FROM listings l JOIN merchants m ON m.id = l.merchant_id WHERE l.id = ? AND m.status = \'active\'';
  params.push(id);
  const rows = await query(sql, params);
  if (!rows.length) throw new HttpError(404, 'LISTING_NOT_FOUND', 'Listing tidak ditemukan');
  return toDto(rows[0]);
}

const listByMerchant = async (merchantId) =>
  (await query('SELECT l.* FROM listings l WHERE l.merchant_id = ? ORDER BY l.id', [merchantId])).map((r) => toDto(r));

async function getOwned(merchantId, id) {
  const rows = await query('SELECT l.* FROM listings l WHERE l.id = ? AND l.merchant_id = ?', [id, merchantId]);
  if (!rows.length) throw new HttpError(404, 'LISTING_NOT_FOUND', 'Listing tidak ditemukan');
  return rows[0];
}

/** Hitung ulang state dan diskon satu listing (dipakai setelah create/update) */
async function recomputeOne(id, conn) {
  const run = conn ? async (s, p) => (await conn.query(s, p))[0] : query;
  const [r] = await run('SELECT * FROM listings WHERE id = ?', [id]);
  if (!r) return null;
  const c = discount.computeListing({ closeMinutes: minutes(r.close_time), nowMinutes: clock.minuteOfDay(), stock: r.stock, isActive: !!r.is_active, normalPrice: r.normal_price });
  await run('UPDATE listings SET state = ?, discount_pct = ?, discount_price = ? WHERE id = ?', [c.state, c.discountPct, c.discountPrice, id]);
  return c;
}

/** Hitung ulang SEMUA listing. Mengembalikan jumlah diperiksa, diubah, dan daftar perubahan */
async function recomputeAll() {
  const rows = await query('SELECT * FROM listings');
  const nowMin = clock.minuteOfDay();
  const changes = [];
  for (const r of rows) {
    const c = discount.computeListing({ closeMinutes: minutes(r.close_time), nowMinutes: nowMin, stock: r.stock, isActive: !!r.is_active, normalPrice: r.normal_price });
    const same = r.state === c.state && r.discount_pct === c.discountPct && r.discount_price === c.discountPrice;
    if (!same) {
      await query('UPDATE listings SET state = ?, discount_pct = ?, discount_price = ?, updated_at = updated_at WHERE id = ?', [c.state, c.discountPct, c.discountPrice, r.id]);
      changes.push({ id: r.id, name: r.name, from: { state: r.state, pct: r.discount_pct }, to: { state: c.state, pct: c.discountPct } });
    }
  }
  return { checked: rows.length, updated: changes.length, changes };
}

async function create(merchantId, d) {
  const id = await tx(async (conn) => {
    const [res] = await conn.query(
      'INSERT INTO listings (merchant_id, name, emoji, note, normal_price, stock, initial_stock, close_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [merchantId, d.name, d.emoji, d.note, d.normalPrice, d.stock, d.stock, d.closeTime + ':00'],
    );
    await recomputeOne(res.insertId, conn);
    return res.insertId;
  });
  return toDto((await query('SELECT * FROM listings WHERE id = ?', [id]))[0]);
}

async function update(merchantId, id, patch) {
  const cur = await getOwned(merchantId, id);
  const sets = [];
  const vals = [];
  const set = (col, v) => { sets.push(col + ' = ?'); vals.push(v); };
  if (patch.name !== undefined) set('name', patch.name);
  if (patch.emoji !== undefined) set('emoji', patch.emoji);
  if (patch.note !== undefined) set('note', patch.note);
  if (patch.normalPrice !== undefined) set('normal_price', patch.normalPrice);
  if (patch.closeTime !== undefined) set('close_time', patch.closeTime + ':00');
  if (patch.isActive !== undefined) set('is_active', patch.isActive ? 1 : 0);
  if (patch.stock !== undefined) {
    set('stock', patch.stock);
    if (patch.stock > cur.initial_stock) set('initial_stock', patch.stock);
  }
  if (!sets.length) throw new HttpError(400, 'VALIDATION_ERROR', 'Tidak ada field yang diubah');
  await tx(async (conn) => {
    await conn.query('UPDATE listings SET ' + sets.join(', ') + ' WHERE id = ?', [...vals, id]);
    await recomputeOne(id, conn);
  });
  return toDto((await query('SELECT * FROM listings WHERE id = ?', [id]))[0]);
}

async function remove(merchantId, id) {
  await getOwned(merchantId, id);
  try {
    await query('DELETE FROM listings WHERE id = ?', [id]);
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') throw new HttpError(409, 'LISTING_HAS_RESERVATIONS', 'Listing sudah memiliki reservasi dan tidak dapat dihapus. Jeda listing sebagai gantinya.');
    throw err;
  }
}

module.exports = { toDto, listPublic, getPublic, listByMerchant, getOwned, recomputeOne, recomputeAll, create, update, remove };
