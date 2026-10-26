'use strict';
const express = require('express');
const config = require('../config/env');
const { requireAuth } = require('../middleware/auth');
const { requireRole, loadMerchant } = require('../middleware/role');
const rateLimit = require('../middleware/rateLimit');
const HttpError = require('../utils/httpError');

const auth = require('../controllers/auth.controller');
const listings = require('../controllers/listings.controller');
const merchant = require('../controllers/merchant.controller');
const admin = require('../controllers/admin.controller');
const system = require('../controllers/system.controller');

// membungkus handler async agar error masuk ke middleware error
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const router = express.Router();

/* ---- publik ---- */
router.get('/health', h(system.health));
router.get('/time', system.time);
router.get('/listings', h(listings.listPublic));
router.get('/listings/:id', h(listings.getPublic));

/* ---- auth ---- */
const limiter = rateLimit({ max: 30, windowMs: 60000 });
router.post('/auth/login', limiter, h(auth.login));
router.post('/auth/register/consumer', limiter, h(auth.registerConsumer));
router.post('/auth/register/merchant', limiter, h(auth.registerMerchant));
router.get('/auth/me', requireAuth, h(auth.me));
router.patch('/auth/me', requireAuth, h(auth.updateMe));
router.post('/auth/change-password', requireAuth, limiter, h(auth.changePassword));

/* ---- merchant ---- */
const m = express.Router();
m.use(requireAuth, requireRole('merchant'), h(loadMerchant));
m.get('/listings', h(listings.listMine));
m.post('/listings', h(listings.createMine));
m.patch('/listings/:id', h(listings.updateMine));
m.delete('/listings/:id', h(listings.removeMine));
m.patch('/profile', h(merchant.updateProfile));
router.use('/merchant', m);

/* ---- admin (minimal Minggu 7) ---- */
const a = express.Router();
a.use(requireAuth, requireRole('admin'));
a.get('/merchants', h(admin.listMerchants));
a.patch('/merchants/:id/address', h(admin.reviewAddress));
a.patch('/merchants/:id/status', h(admin.setStatus));
a.get('/scheduler/logs', h(admin.schedulerLogs));
router.use('/admin', a);

/* ---- alat demo ---- */
if (config.devTools) {
  router.post('/dev/clock', h(system.devClock));
  router.post('/dev/scheduler/run', h(system.devSchedulerRun));
  router.post('/dev/reset', h(system.devReset));
}

module.exports = router;
