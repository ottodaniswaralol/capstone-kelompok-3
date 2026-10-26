'use strict';
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((s) => s.trim()) }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
