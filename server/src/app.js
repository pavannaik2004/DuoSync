const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config/env');
const { createApiRouter } = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const AppError = require('./utils/AppError');

/**
 * Builds the Express app without listening, so tests can drive it with
 * Supertest. `options.authRateLimit` overrides the login/signup limit.
 */
function createApp(options = {}) {
  const authRateLimit = options.authRateLimit ?? config.authRateLimit;
  const app = express();

  app.set('trust proxy', 1); // behind Render's proxy: rate-limit by the real client IP
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: '20kb' }));

  app.use('/api', createApiRouter({ authRateLimit }));
  app.use('/api', (req, res, next) => next(new AppError(404, 'NOT_FOUND', 'No such endpoint')));

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
