const Attempt = require('../src/models/Attempt');
const { startDb, clearDb, stopDb } = require('./helpers/db');
const { createPlayer, createRoom } = require('./helpers/users');
const { startSocketServer, connect, nextEvent, collect, join } = require('./helpers/sockets');

let srv;
let alice;
let bob;
let code;
let a;
let b;

beforeAll(startDb);
afterAll(stopDb);

beforeEach(async () => {
  srv = await startSocketServer();
  alice = await createPlayer(srv.app, 'alice');
  bob = await createPlayer(srv.app, 'bob');
  code = await createRoom(srv.app, alice.auth);
  a = await connect(srv.url, alice.token);
  const snapA = nextEvent(a, 'attempt:snapshot');
  expect(await join(a, code)).toEqual({ ok: true });
  await snapA;
  b = await connect(srv.url, bob.token);
});

afterEach(async () => {
  await srv.close();
  await clearDb();
});

test('connecting without a valid token fails with AUTH_REQUIRED', async () => {
  await expect(connect(srv.url, 'bad.token')).rejects.toThrow('AUTH_REQUIRED');
  await expect(connect(srv.url, undefined)).rejects.toThrow('AUTH_REQUIRED');
});

test('creator and partner join; each gets a snapshot with both players, the partner gets lobby:update', async () => {
  const snapB = nextEvent(b, 'attempt:snapshot');
  const update = nextEvent(a, 'lobby:update');
  expect(await join(b, code.toLowerCase())).toEqual({ ok: true });
  const snap = await snapB;
  expect(snap.players.map((p) => p.name)).toEqual(['alice', 'bob']);
  expect(snap).toMatchObject({ status: 'lobby', practiceCode: code, me: { id: bob.user.id, role: null }, clue: null });
  const lobby = await update;
  expect(lobby.status).toBe('lobby');
  expect(lobby.players.every((p) => p.connected)).toBe(true);
});

test('the partner joining posts a "joined" system message to the creator', async () => {
  const msg = nextEvent(a, 'chat:message');
  await join(b, code);
  expect(await msg).toMatchObject({ kind: 'system', text: 'bob joined' });
});

test('a third player gets ROOM_FULL', async () => {
  await join(b, code);
  const cara = await createPlayer(srv.app, 'cara');
  const c = await connect(srv.url, cara.token);
  expect(await join(c, code)).toMatchObject({ error: 'ROOM_FULL' });
});

test('an unknown room code gets PRACTICE_NOT_FOUND', async () => {
  expect(await join(b, 'ZZZZZZ')).toMatchObject({ error: 'PRACTICE_NOT_FOUND' });
  expect(await b.emitWithAck('attempt:join', { practiceCode: { $ne: null } })).toMatchObject({ error: 'VALIDATION_ERROR' });
});

test('a socket cannot join a second room', async () => {
  const other = await createRoom(srv.app, bob.auth);
  await join(b, code);
  expect(await join(b, other)).toMatchObject({ error: 'ALREADY_IN_ATTEMPT' });
});

test('chat reaches the teammate as plain text, with sender, role and time', async () => {
  await join(b, code);
  const got = nextEvent(b, 'chat:message');
  expect(await a.emitWithAck('chat:send', { text: '  <script>alert(1)</script>  ' })).toEqual({ ok: true });
  const msg = await got;
  expect(msg).toMatchObject({ kind: 'user', senderName: 'alice', role: null, text: '<script>alert(1)</script>' });
  expect(Date.parse(msg.createdAt)).not.toBeNaN();
});

test.each([[''], ['   '], ['x'.repeat(301)], [5], [{ $ne: null }]])('chat text %p → VALIDATION_ERROR', async (text) => {
  expect(await a.emitWithAck('chat:send', { text })).toMatchObject({ error: 'VALIDATION_ERROR' });
  expect(await a.emitWithAck('chat:send', { text: 'still alive' })).toEqual({ ok: true });
});

test('300 characters is allowed', async () => {
  expect(await a.emitWithAck('chat:send', { text: 'x'.repeat(300) })).toEqual({ ok: true });
});

test('chat from another room never arrives (NFR-4)', async () => {
  const cara = await createPlayer(srv.app, 'cara');
  const c = await connect(srv.url, cara.token);
  await join(c, await createRoom(srv.app, cara.auth));
  const leaked = collect(c, 'chat:message', 300);
  await a.emitWithAck('chat:send', { text: 'secret plan' });
  expect(await leaked).toEqual([]);
});

test('a socket that never joined gets NOT_IN_ATTEMPT, by ack or by an error event', async () => {
  expect(await b.emitWithAck('chat:send', { text: 'hi' })).toMatchObject({ error: 'NOT_IN_ATTEMPT' });
  const err = nextEvent(b, 'error');
  b.emit('chat:send', { text: 'hi' });
  expect(await err).toMatchObject({ error: 'NOT_IN_ATTEMPT', message: expect.any(String) });
});

test('a reconnecting socket gets the chat log in its snapshot (CHAT-3)', async () => {
  await a.emitWithAck('chat:send', { text: 'remember this' });
  a.disconnect();
  const again = await connect(srv.url, alice.token);
  const snap = nextEvent(again, 'attempt:snapshot');
  await join(again, code);
  expect((await snap).chat.map((m) => m.text)).toContain('remember this');
});

test('disconnecting in the lobby sends lobby:update with connected false and a "left" message', async () => {
  const joined = nextEvent(a, 'lobby:update');
  await join(b, code);
  await joined;
  const update = nextEvent(a, 'lobby:update');
  const msg = nextEvent(a, 'chat:message');
  b.disconnect();
  expect((await update).players.find((p) => p.name === 'bob').connected).toBe(false);
  expect(await msg).toMatchObject({ kind: 'system', text: 'bob left' });
});

test('a socket already in one room cannot take a seat in another', async () => {
  const carol = await createPlayer(srv.app, 'carol');
  const dave = await createPlayer(srv.app, 'dave');
  const r2 = await createRoom(srv.app, dave.auth);
  const c = await connect(srv.url, carol.token);
  expect(await join(c, code)).toEqual({ ok: true });
  const ack = await join(c, r2);
  expect(ack.error).toBe('ALREADY_IN_ATTEMPT');
  expect((await Attempt.findOne({ practiceCode: r2 })).players).toHaveLength(1);
});
