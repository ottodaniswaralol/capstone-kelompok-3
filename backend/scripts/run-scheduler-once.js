'use strict';
const { runDiscountJob } = require('../src/jobs/discount.job');
(async () => {
  const r = await runDiscountJob();
  console.log(JSON.stringify(r, null, 2));
  await require('../src/config/db').pool.end();
  process.exit(r.ok ? 0 : 1);
})();
