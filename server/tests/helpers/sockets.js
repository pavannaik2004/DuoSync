const http = require('http');
const { io: ioClient } = require('socket.io-client');
const { createApp } = require('../../src/app');
const { attachSockets } = require('../../src/sockets');

const openClients = new Set();

/** Starts the API and Socket.io on a free port. close() also stops every attempt timer. */
async function startSocketServer(options = {}) {
  const app = createApp({ authRateLimit: 1000 });
  const server = http.createServer(app);
  const io = attachSockets(server, { clientOrigins: ['http://localhost'], levelSetFor: (c) => c.fallbackLevels, ...options });
  await new Promise((resolve) => server.listen(0, resolve));
  const url = `http://localhost:${server.address().port}`;
  return {
    app,
    url,
    io,
    async close() {
      openClients.forEach((c) => c.disconnect());
      openClients.clear();
      io.runtimes.stopAll();
      await io.close();
    },
  };
}

/** Connects with a token; rejects with the server's connect_error message. */
function connect(url, token) {
  const socket = ioClient(url, { auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true });
  openClients.add(socket);
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err) => reject(err));
  });
}

/** Resolves with the next payload of `event`, or rejects after `ms`. */
function nextEvent(socket, event, ms = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`timed out waiting for ${event}`));
    }, ms);
    function onEvent(payload) {
      clearTimeout(timer);
      resolve(payload);
    }
    socket.once(event, onEvent);
  });
}

/** Collects every payload of `event` for `ms`. */
async function collect(socket, event, ms) {
  const got = [];
  const onEvent = (payload) => got.push(payload);
  socket.on(event, onEvent);
  await new Promise((resolve) => setTimeout(resolve, ms));
  socket.off(event, onEvent);
  return got;
}

/** Resolves with the first payload of `event` that matches `predicate`, or rejects after `ms`. */
function waitFor(socket, event, predicate, ms = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`timed out waiting for a matching ${event}`));
    }, ms);
    function onEvent(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, onEvent);
      resolve(payload);
    }
    socket.on(event, onEvent);
  });
}

const join = (socket, code) => socket.emitWithAck('attempt:join', { practiceCode: code });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
  startSocketServer, connect, nextEvent, collect, waitFor, join, wait,
};
