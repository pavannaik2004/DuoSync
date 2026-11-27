/**
 * NFR-10 / NFR-13 load check (D107). Against a running server it opens `--rooms` practice rooms
 * (default 25, so 50 players), starts every game, then has each player send `--messages` chats
 * and measures how long each takes to reach the teammate, plus how far apart the two teammates
 * receive the same timer tick. Passes when p95 delivery < 500 ms and max tick skew <= 1000 ms.
 *
 *   npm run load -- --url http://localhost:4000 [--rooms 25] [--messages 10]
 *
 * Run by hand, not in `npm test`. It creates guests and practice rooms; idle rooms expire (PRAC-4).
 */
const { io } = require('socket.io-client');

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, all) => {
  if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1]]);
  return pairs;
}, []));
const URL = (args.url || 'http://localhost:4000').replace(/\/$/, '');
const ROOMS = Number(args.rooms || 25);
const MESSAGES = Number(args.messages || 10);
const CHAT_GAP_MS = 700; // stays under CHAT-6 (5 per 3 s)
const LIMITS = { p95: 500, skew: 1000 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(path, body, token) {
  const res = await fetch(`${URL}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path} → ${res.status} ${json.error}: ${json.message}`);
  return json;
}

function connect(token) {
  const socket = io(URL, { auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true });
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function waitFor(socket, event, test = () => true, ms = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), ms);
    const on = (payload) => {
      if (!test(payload)) return;
      clearTimeout(timer);
      socket.off(event, on);
      resolve(payload);
    };
    socket.on(event, on);
  });
}

async function ack(socket, event, payload) {
  const reply = await socket.timeout(10000).emitWithAck(event, payload);
  if (reply.error) throw new Error(`${event} → ${reply.error}: ${reply.message}`);
  return reply;
}

/** Two guests, one room, both joined with roles, game started. */
async function startRoom(n) {
  const [ga, gb] = await Promise.all([post('/auth/guest', { nickname: `load_${n}_a` }), post('/auth/guest', { nickname: `load_${n}_b` })]);
  const { code } = await post('/practice', {}, ga.token);
  const [a, b] = await Promise.all([connect(ga.token), connect(gb.token)]);
  await ack(a, 'attempt:join', { practiceCode: code });
  await ack(b, 'attempt:join', { practiceCode: code });
  await ack(a, 'lobby:claimRole', { role: 'A' });
  await ack(b, 'lobby:claimRole', { role: 'B' });
  const started = Promise.all([a, b].map((s) => waitFor(s, 'attempt:snapshot', (snap) => snap.status === 'in_progress')));
  await ack(a, 'lobby:ready');
  await ack(b, 'lobby:ready');
  await started;
  return { n, a, b };
}

/** Records when each player receives each tick value, keyed by remainingMs. */
function trackTicks(room) {
  room.ticks = { a: new Map(), b: new Map() };
  room.a.on('attempt:tick', (t) => room.ticks.a.set(t.remainingMs, Date.now()));
  room.b.on('attempt:tick', (t) => room.ticks.b.set(t.remainingMs, Date.now()));
}

/** Each player sends MESSAGES chats; each teammate records the delivery latency. */
async function chatRound(room, latencies) {
  const sent = new Map();
  // Each message also echoes to its sender; only the teammate's receipt counts.
  const listen = (socket, side) => socket.on('chat:message', (m) => {
    const at = sent.get(m.text);
    if (at !== undefined && !m.text.startsWith(`load ${room.n}${side} `)) latencies.push(Date.now() - at);
  });
  listen(room.a, 'a');
  listen(room.b, 'b');
  const run = async (socket, side) => {
    for (let i = 0; i < MESSAGES; i += 1) {
      const text = `load ${room.n}${side} ${i}`;
      sent.set(text, Date.now());
      await ack(socket, 'chat:send', { text });
      await sleep(CHAT_GAP_MS);
    }
  };
  await Promise.all([run(room.a, 'a'), run(room.b, 'b')]);
}

function percentile(sorted, p) {
  if (sorted.length === 0) return NaN;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

async function main() {
  console.log(`Load check against ${URL}: ${ROOMS} rooms, ${ROOMS * 2} players, ${MESSAGES} messages each`);
  const t0 = Date.now();
  const rooms = await Promise.all(Array.from({ length: ROOMS }, (_, i) => startRoom(i + 1)));
  console.log(`Started ${rooms.length} games in ${Date.now() - t0} ms`);

  rooms.forEach(trackTicks);
  const latencies = [];
  await Promise.all(rooms.map((room) => chatRound(room, latencies)));
  await sleep(1500);

  let skew = 0;
  for (const room of rooms) {
    for (const [remaining, atA] of room.ticks.a) {
      const atB = room.ticks.b.get(remaining);
      if (atB !== undefined) skew = Math.max(skew, Math.abs(atA - atB));
    }
  }
  rooms.forEach((r) => { r.a.disconnect(); r.b.disconnect(); });

  const sorted = [...latencies].sort((x, y) => x - y);
  const expected = ROOMS * 2 * MESSAGES;
  const p95 = percentile(sorted, 95);
  const ok = sorted.length === expected && p95 < LIMITS.p95 && skew <= LIMITS.skew;
  console.log(`Messages delivered: ${sorted.length}/${expected}`);
  console.log(`Delivery latency ms: p50 ${percentile(sorted, 50)}, p95 ${p95}, max ${sorted[sorted.length - 1]}`);
  console.log(`Max tick skew between teammates: ${skew} ms`);
  console.log(ok ? 'PASS' : `FAIL (needs all delivered, p95 < ${LIMITS.p95} ms, skew <= ${LIMITS.skew} ms)`);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error('Load check failed to run:', err.message);
  process.exit(1);
});
