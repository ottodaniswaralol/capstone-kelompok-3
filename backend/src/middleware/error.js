'use strict';
const HttpError = require('../utils/httpError');

const notFound = (req, res, next) => next(new HttpError(404, 'NOT_FOUND', 'Endpoint tidak ditemukan: ' + req.method + ' ' + req.path));

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Body request bukan JSON yang valid' } });
  }
  if (process.env.NODE_ENV !== 'test') console.error('[error]', err);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan pada server' } });
}

module.exports = { notFound, errorHandler };
