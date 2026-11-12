require('dotenv').config();

const http = require('http');
const config = require('./config/env');
const { connectDb } = require('./config/db');
const { createApp } = require('./app');
const { attachSockets } = require('./sockets');
const { recoverAttempts } = require('./sockets/recovery');
const { ensureSeeded } = require('./services/themeService');

async function main() {
  await connectDb(config.mongoUri);
  const seeded = await ensureSeeded();
  if (seeded) console.log(`Seeded ${seeded} themes`);
  const server = http.createServer(createApp());
  const io = attachSockets(server, { clientOrigins: config.clientOrigins });
  server.listen(config.port, () => {
    console.log(`DuoSync API listening on port ${config.port}`);
  });
  // D71: rebuild the timers of every game that was live when the server stopped.
  const recovered = await recoverAttempts(io);
  console.log(`Recovered live attempts: ${recovered.resumed} waiting for players, ${recovered.ended} ended, ${recovered.lobby} back to lobby`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
