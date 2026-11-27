const Message = require('../src/models/Message');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { seedThemes } = require('./helpers/themes');
const { createPlayer, createRoom } = require('./helpers/users');
const { startSocketServer, connect, nextEvent, collect, join } = require('./helpers/sockets');

const LIMITED = { error: 'RATE_LIMITED', message: 'Slow down: at most 5 messages in 3 seconds' };

let srv;
let alice;
let code;
let a;
let b;

beforeAll(startDb);
beforeEach(seedThemes);
afterAll(stopDb);

async function setUp(options = {}) {
  srv = await startSocketServer(options);
  alice = await createPlayer(srv.app, 'alice');
  const bob = await createPlayer(srv.app, 'bob');
  code = await createRoom(srv.app, alice.auth);
  a = await connect(srv.url, alice.token);
  b = await connect(srv.url, bob.token);
  const snaps = Promise.all([nextEvent(a, 'attempt:snapshot'), nextEvent(b, 'attempt:snapshot')]);
  await join(a, code);
  await join(b, code);
  await snaps;
}

afterEach(async () => {
  await srv.close();
  await clearDb();
});

const send = (socket, i) => socket.emitWithAck('chat:send', { text: `msg ${i}` });

test('CHAT-6: the 6th message within 3 s → RATE_LIMITED, and the teammate gets only 5', async () => {
  await setUp();
  const got = collect(b, 'chat:message', 400);
  for (let i = 1; i <= 5; i += 1) expect(await send(a, i)).toEqual({ ok: true });
  expect(await send(a, 6)).toEqual(LIMITED);
  const user = (await got).filter((m) => m.kind === 'user');
  expect(user.map((m) => m.text)).toEqual(['msg 1', 'msg 2', 'msg 3', 'msg 4', 'msg 5']);
});

test('CHAT-6: the limit is per player across two sockets', async () => {
  await setUp();
  const a2 = await connect(srv.url, alice.token);
  const snap = nextEvent(a2, 'attempt:snapshot');
  await join(a2, code);
  await snap;
  for (let i = 1; i <= 3; i += 1) expect(await send(a, i)).toEqual({ ok: true });
  for (let i = 4; i <= 5; i += 1) expect(await send(a2, i)).toEqual({ ok: true });
  expect(await send(a2, 6)).toEqual(LIMITED);
});

test('CHAT-6: after the window passes, sending works again', async () => {
  await setUp({ chatWindowMs: 300 });
  for (let i = 1; i <= 5; i += 1) await send(a, i);
  expect(await send(a, 6)).toMatchObject({ error: 'RATE_LIMITED' });
  await new Promise((r) => setTimeout(r, 350));
  expect(await send(a, 7)).toEqual({ ok: true });
});

test('CHAT-6: a refused message is not saved, and the teammate is not limited', async () => {
  await setUp();
  for (let i = 1; i <= 6; i += 1) await send(a, i);
  expect(await send(b, 'b')).toEqual({ ok: true });
  expect(await Message.countDocuments({ kind: 'user' })).toBe(6);
  expect(await Message.countDocuments({ kind: 'user', text: 'msg 6' })).toBe(0);
});
