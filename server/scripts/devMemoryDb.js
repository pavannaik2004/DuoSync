/**
 * Local development without MongoDB Atlas: starts a throwaway in-memory MongoDB
 * and the API on it. Data is lost when the process stops.
 * Usage: npm run dev:memory
 */
require('dotenv').config();

process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret';

const { MongoMemoryServer } = require('mongodb-memory-server');

async function main() {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  console.log(`In-memory MongoDB at ${process.env.MONGODB_URI}`);
  const stop = async () => {
    await mongod.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  require('../src/server');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
