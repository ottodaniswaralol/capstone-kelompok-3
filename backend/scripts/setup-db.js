'use strict';
/* Pakai: npm run db:setup   (aman, tidak menghapus data)
          npm run db:reset   (HAPUS semua tabel lalu buat ulang + data awal) */
const config = require('../src/config/env');
const { setupDb } = require('./lib/setupDb');

(async () => {
  const fresh = process.argv.includes('--fresh');
  if (fresh && config.nodeEnv === 'production') throw new Error('--fresh dilarang di produksi');
  const { seeded } = await setupDb(config.db, { fresh });
  const { recomputeAll } = require('../src/services/listing.service');
  const r = await recomputeAll();
  console.log(`Database "${config.db.database}" siap. ${seeded ? 'Data awal dimuat.' : 'Data awal tidak diubah.'} Listing diperiksa: ${r.checked}, diperbarui: ${r.updated}.`);
  await require('../src/config/db').pool.end();
})().catch((e) => { console.error('Gagal menyiapkan database:', e.message); process.exit(1); });
