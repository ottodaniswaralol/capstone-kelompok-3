'use strict';
/** Membuat database, menerapkan schema.sql, dan memuat seed.sql (bila tabel users kosong). */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const DB_DIR = path.resolve(__dirname, '../../../database');
const TABLES = ['ratings', 'transactions', 'vouchers', 'reservations', 'activity_logs', 'scheduler_logs', 'app_meta', 'listings', 'merchants', 'users'];

async function setupDb(cfg, { fresh = false, seed = true } = {}) {
  const { host, port, user, password, database } = cfg;
  const root = await mysql.createConnection({ host, port, user, password });
  await root.query('CREATE DATABASE IF NOT EXISTS `' + database + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  await root.end();
  const conn = await mysql.createConnection({ host, port, user, password, database, multipleStatements: true });
  try {
    await conn.query("SET time_zone = '+07:00'");
    if (fresh) {
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');
      for (const t of TABLES) await conn.query('DROP TABLE IF EXISTS `' + t + '`');
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    }
    await conn.query(fs.readFileSync(path.join(DB_DIR, 'schema.sql'), 'utf8'));
    const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM users');
    let seeded = false;
    if (seed && n === 0) {
      await conn.query(fs.readFileSync(path.join(DB_DIR, 'seed.sql'), 'utf8'));
      seeded = true;
    }
    return { seeded };
  } finally {
    await conn.end();
  }
}

module.exports = { setupDb, TABLES };
