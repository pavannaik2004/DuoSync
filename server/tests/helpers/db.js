const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

async function startDb() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
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
