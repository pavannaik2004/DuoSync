/**
 * All settings come from environment variables (NFR-19). dotenv is loaded by
 * server.js before this file is required; tests set variables in setupEnv.js.
 */
const nodeEnv = process.env.NODE_ENV || 'development';

if (!process.env.JWT_SECRET && nodeEnv !== 'test') {
  throw new Error('JWT_SECRET is not set. Copy server/.env.example to server/.env and fill it in.');
}

const config = {
  nodeEnv,
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI || '',
  jwtSecret: process.env.JWT_SECRET || 'test-secret',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  authRateLimit: Number(process.env.AUTH_RATE_LIMIT) || 10,
};

module.exports = config;
