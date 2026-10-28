'use strict';
const HttpError = require('../utils/httpError');

/** Pembatas sederhana (in-memory) untuk endpoint auth: maks. `max` request per `windowMs` per IP */
function rateLimit({ max = 20, windowMs = 60000 } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test') return next();
    const now = Date.now();
    const key = req.ip;
    const rec = hits.get(key) || { n: 0, reset: now + windowMs };
    if (now > rec.reset) { rec.n = 0; rec.reset = now + windowMs; }
    rec.n += 1;
    hits.set(key, rec);
    if (rec.n > max) return next(new HttpError(429, 'TOO_MANY_REQUESTS', 'Terlalu banyak percobaan, coba lagi sebentar lagi'));
    next();
  };
}
module.exports = rateLimit;
