'use strict';
const config = require('../config/env');
const clock = require('../services/clock.service');
const discount = require('../services/discount.service');
const { query } = require('../config/db');
const { runDiscountJob } = require('../jobs/discount.job');
const { setupDb } = require('../../scripts/lib/setupDb');
const HttpError = require('../utils/httpError');
const { isTime, int, fail } = require('../utils/validate');

function timeInfo() {
  const m = clock.minuteOfDay();
  return { iso: clock.now().toISOString(), date: clock.dateString(), time: clock.timeString(), minuteOfDay: m, listingWindowOpen: discount.canCreateListing(m), devTools: config.devTools, offsetMinutes: clock.getOffsetMinutes() };
}

async function health(req, res) {
  let db = 'ok';
  try { await query('SELECT 1'); } catch { db = 'down'; }
  res.status(db === 'ok' ? 200 : 503).json({ status: db === 'ok' ? 'ok' : 'degraded', db, version: '0.7.0', time: timeInfo() });
}
const time = (req, res) => res.json(timeInfo());

/* ---------- alat demo (DEV_TOOLS=1) ---------- */
async function devClock(req, res) {
  const { advanceMinutes, setTime, reset } = req.body;
  const errors = [];
  if (advanceMinutes !== undefined && int(advanceMinutes, { min: 1, max: 1440 }) === null) errors.push('advanceMinutes harus 1 sampai 1440');
  if (setTime !== undefined && !isTime(setTime)) errors.push('setTime harus berformat HH:MM');
  if (advanceMinutes === undefined && setTime === undefined && reset !== true) errors.push('Isi advanceMinutes, setTime, atau reset');
  fail(errors);
  if (reset === true) clock.resetOffset();
  if (setTime !== undefined) clock.setTimeOfDay(setTime);
  if (advanceMinutes !== undefined) clock.advance(int(advanceMinutes));
  const scheduler = await runDiscountJob();
  res.json({ time: timeInfo(), scheduler });
}
async function devSchedulerRun(req, res) { res.json({ time: timeInfo(), scheduler: await runDiscountJob() }); }
async function devReset(req, res) {
  if (config.nodeEnv === 'production') throw new HttpError(403, 'FORBIDDEN', 'Dilarang di produksi');
  clock.resetOffset();
  await setupDb(config.db, { fresh: true });
  res.json({ ok: true, scheduler: await runDiscountJob(), time: timeInfo() });
}

module.exports = { health, time, devClock, devSchedulerRun, devReset, timeInfo };
