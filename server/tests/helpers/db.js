const os = require('os');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

async function startDb() {
  mongod = await MongoMemoryServer.create();
  // mongodb driver 7 loads `os` with a dynamic import(), which Jest's CommonJS
  // sandbox cannot run; the driver then sends an empty handshake. Hand it `os`.
  await mongoose.connect(mongod.getUri(), { runtimeAdapters: { os } });
  // Build unique indexes before tests rely on them.
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
}

async function clearDb() {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

async function stopDb() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

module.exports = { startDb, clearDb, stopDb };
