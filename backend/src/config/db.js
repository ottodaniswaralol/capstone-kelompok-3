'use strict';
const mysql = require('mysql2/promise');
const config = require('./env');

// dateStrings: DATETIME/TIME dibaca sebagai string WIB, tanpa konversi zona waktu oleh driver
const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
  decimalNumbers: true,
  charset: 'utf8mb4',
});
pool.pool.on('connection', (conn) => conn.query("SET time_zone = '+07:00'"));

const query = async (sql, params) => (await pool.query(sql, params))[0];

async function tx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, query, tx };
