'use strict';
/**
 * Scheduler diskon (FR-06, FR-10) dengan logging dan retry (mitigasi risiko R-03).
 * Setiap putaran: (1) reset tengah malam bila tanggal berganti, (2) hitung ulang state dan diskon semua listing.
 */
const { query, tx } = require('../config/db');
const clock = require('../services/clock.service');
const listingService = require('../services/listing.service');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let running = false;
let timer = null;

/** Pergantian hari: stok kembali ke initial_stock, voucher aktif dan transaksi reserved menjadi expired */
async function midnightResetIfNeeded() {
  const today = clock.dateString();
  const [meta] = await query("SELECT v FROM app_meta WHERE k = 'last_reset_date'");
  if (!meta) { await query("INSERT INTO app_meta (k, v) VALUES ('last_reset_date', ?)", [today]); return null; }
  if (meta.v === today) return null;
  const startedAt = clock.dateTimeString();
  const result = await tx(async (conn) => {
    const [l] = await conn.query('UPDATE listings SET stock = initial_stock, updated_at = updated_at WHERE stock <> initial_stock');
    const [t] = await conn.query("UPDATE transactions t JOIN vouchers v ON v.id = t.voucher_id SET t.status = 'expired' WHERE t.status = 'reserved' AND v.status = 'active'");
    const [v] = await conn.query("UPDATE vouchers SET status = 'expired' WHERE status = 'active'");
    await conn.query("UPDATE app_meta SET v = ? WHERE k = 'last_reset_date'", [today]);
    return { listingsReset: l.affectedRows, vouchersExpired: v.affectedRows, transactionsExpired: t.affectedRows };
  });
  await query("INSERT INTO scheduler_logs (job, started_at, finished_at, status, listings_checked, listings_updated, message) VALUES ('midnight_reset', ?, ?, 'success', ?, ?, ?)",
    [startedAt, clock.dateTimeString(), result.listingsReset, result.vouchersExpired, 'Reset ' + today + ': stok dikembalikan, voucher aktif diakhiri']);
  return { date: today, ...result };
}

async function runDiscountJob({ maxAttempts = 3, backoffMs = 300 } = {}) {
  if (running) return { ok: false, skipped: true, message: 'Putaran sebelumnya masih berjalan' };
  running = true;
  try {
    const startedAt = clock.dateTimeString();
    const log = await query("INSERT INTO scheduler_logs (job, started_at, status) VALUES ('discount', ?, 'running')", [startedAt]);
    let lastErr = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const reset = await midnightResetIfNeeded();
        const r = await listingService.recomputeAll();
        await query("UPDATE scheduler_logs SET status = 'success', attempts = ?, finished_at = ?, listings_checked = ?, listings_updated = ?, message = ? WHERE id = ?",
          [attempt, clock.dateTimeString(), r.checked, r.updated, r.updated ? 'Diperbarui: ' + r.changes.map((c) => c.name).join(', ').slice(0, 200) : 'Tidak ada perubahan', log.insertId]);
        await query("DELETE FROM scheduler_logs WHERE started_at < ? AND status = 'success' AND listings_updated = 0 AND job = 'discount'", [clock.dateTimeString(new Date(clock.now().getTime() - 7 * 86400000))]);
        return { ok: true, attempts: attempt, checked: r.checked, updated: r.updated, changes: r.changes, reset, time: clock.timeString() };
      } catch (err) {
        lastErr = err;
        if (attempt < maxAttempts) await sleep(backoffMs * attempt);
      }
    }
    await query("UPDATE scheduler_logs SET status = 'failed', attempts = ?, finished_at = ?, message = ? WHERE id = ?",
      [maxAttempts, clock.dateTimeString(), String(lastErr && lastErr.message).slice(0, 250), log.insertId]);
    return { ok: false, attempts: maxAttempts, message: String(lastErr && lastErr.message) };
  } finally {
    running = false;
  }
}

function startScheduler(intervalMin) {
  stopScheduler();
  runDiscountJob().catch((e) => console.error('[scheduler]', e));
  timer = setInterval(() => runDiscountJob().then((r) => { if (r.ok && r.updated) console.log(`[scheduler ${r.time}] ${r.updated} listing diperbarui`); else if (!r.ok && !r.skipped) console.error('[scheduler] gagal:', r.message); }).catch((e) => console.error('[scheduler]', e)), intervalMin * 60000);
  return timer;
}
function stopScheduler() { if (timer) { clearInterval(timer); timer = null; } }

module.exports = { runDiscountJob, midnightResetIfNeeded, startScheduler, stopScheduler };
