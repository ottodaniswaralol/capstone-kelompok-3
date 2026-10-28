'use strict';
const HttpError = require('./httpError');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const isEmail = (v) => typeof v === 'string' && v.length <= 150 && EMAIL_RE.test(v);
const isTime = (v) => typeof v === 'string' && TIME_RE.test(v);
const str = (v, { min = 1, max = 255 } = {}) => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length >= min && t.length <= max ? t : null;
};
const int = (v, { min = -Infinity, max = Infinity } = {}) => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/** Kumpulkan pesan kesalahan lalu lempar sekali sebagai 400 VALIDATION_ERROR */
function fail(errors) {
  if (errors.length) throw new HttpError(400, 'VALIDATION_ERROR', errors[0], errors);
}

module.exports = { isEmail, isTime, str, int, fail, TIME_RE };
