'use strict';
process.env.TZ = process.env.TZ || 'Asia/Jakarta';
const config = require('./config/env');
const { createApp } = require('./app');
const { startScheduler } = require('./jobs/discount.job');

const app = createApp();
app.listen(config.port, () => {
  console.log(`ngeWARteg API berjalan di http://localhost:${config.port}/api (env: ${config.nodeEnv}, devTools: ${config.devTools})`);
  startScheduler(config.schedulerIntervalMin);
  console.log(`Scheduler diskon aktif, interval ${config.schedulerIntervalMin} menit`);
});
