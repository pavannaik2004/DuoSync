/**
 * All settings come from environment variables (NFR-19). dotenv is loaded by
 * server.js before this file is required; tests set variables in setupEnv.js.
 */
const nodeEnv = process.env.NODE_ENV || 'development';

if (!process.env.JWT_SECRET && nodeEnv !== 'test') {
  throw new Error('JWT_SECRET is not set. Copy server/.env.example to server/.env and fill it in.');
}

/**
 * CLIENT_ORIGIN may list several origins separated by commas (e.g. production
 * plus a Vercel preview). Spaces and trailing slashes are dropped, because the
 * browser's Origin header never has one and a mismatch fails silently.
 */
function parseOrigins(value) {
  return String(value || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

const config = {
  nodeEnv,
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI || '',
  jwtSecret: process.env.JWT_SECRET || 'test-secret',
  clientOrigins: parseOrigins(process.env.CLIENT_ORIGIN || 'http://localhost:5173'),
  authRateLimit: Number(process.env.AUTH_RATE_LIMIT) || 10,
};

module.exports = config;
module.exports.parseOrigins = parseOrigins;
