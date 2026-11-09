require('dotenv').config();

const http = require('http');
const config = require('./config/env');
const { connectDb } = require('./config/db');
const { createApp } = require('./app');
const { attachSockets } = require('./sockets');

async function main() {
  await connectDb(config.mongoUri);
  const server = http.createServer(createApp());
  attachSockets(server, { clientOrigins: config.clientOrigins });
  server.listen(config.port, () => {
    console.log(`DuoSync API listening on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
