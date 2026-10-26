'use strict';
// Harus dijalankan sebelum modul aplikasi dimuat
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'ngewarteg_test';
process.env.JWT_SECRET = 'test-secret-1234567890';

const request = require('supertest');
const config = require('../../src/config/env');
const { createApp } = require('../../src/app');
const clock = require('../../src/services/clock.service');
const { setupDb } = require('../../scripts/lib/setupDb');
const { runDiscountJob, stopScheduler } = require('../../src/jobs/discount.job');
const db = require('../../src/config/db');

const app = createApp();
const api = () => request(app);
const PASSWORD = '12345678';

/** Database uji dibuat ulang (schema + seed), jam dikunci, scheduler dijalankan sekali */
async function resetDb(iso = '2026-10-22T19:45:00+07:00') {
  stopScheduler();
  await setupDb(config.db, { fresh: true });
  clock.pin(iso);
  await runDiscountJob();
}

async function login(email, password = PASSWORD) {
  const r = await api().post('/api/auth/login').send({ email, password });
  if (r.status !== 200) throw new Error('login gagal ' + email + ': ' + JSON.stringify(r.body));
  return r.body.token;
}
const bearer = (t) => ({ Authorization: 'Bearer ' + t });

async function close() { stopScheduler(); clock.unpin(); await db.pool.end(); }

module.exports = { app, api, resetDb, login, bearer, close, db, clock, config, PASSWORD };
