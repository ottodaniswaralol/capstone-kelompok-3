'use strict';
require('dotenv').config();
const e = process.env;
const nodeEnv = e.NODE_ENV || 'development';
const config = {
  nodeEnv,
  port: Number(e.PORT) || 3000,
  db: {
    host: e.DB_HOST || '127.0.0.1',
    port: Number(e.DB_PORT) || 3306,
    user: e.DB_USER || 'root',
    password: e.DB_PASSWORD || '',
    database: e.DB_NAME || 'ngewarteg',
  },
  jwtSecret: e.JWT_SECRET || 'dev-secret-ganti-di-produksi',
  jwtExpiresIn: e.JWT_EXPIRES_IN || '8h',
  schedulerIntervalMin: Number(e.SCHEDULER_INTERVAL_MIN) || 5,
  devTools: e.DEV_TOOLS ? e.DEV_TOOLS === '1' : nodeEnv !== 'production',
  corsOrigin: e.CORS_ORIGIN || '*',
};
if (nodeEnv === 'production' && (!e.JWT_SECRET || e.JWT_SECRET.length < 16)) {
  throw new Error('JWT_SECRET wajib diisi (minimal 16 karakter) di produksi');
}
module.exports = config;
