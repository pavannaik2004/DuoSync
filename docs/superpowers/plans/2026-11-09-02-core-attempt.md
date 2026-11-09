# Phase 2 — Core Attempt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two players on two devices open a practice room, claim roles, ready up, play Cyber Heist (fixed values) with team chat and a server-owned timer, and both see the same score on the results screen (PRD §11 Phase 2, EL Phase I).

**Architecture:** Socket.io runs on the same HTTP server as Express. A practice room is an `Attempt` document (`challengeId: null`, `practiceCode` set). Persistent state lives in MongoDB. Each live attempt has an in-process `AttemptRuntime` that holds presence, the countdown, the 1-second tick and a promise queue, which runs every mutating event one at a time. All attempt data a client sees is built by `services/attemptView.js`. Rules live in services (lobby, game, chat, scoring, answers); socket handlers only validate, enqueue, call a service and emit.

**Tech Stack:** Phase 1 stack, plus `socket.io` 4 (server) and `socket.io-client` 4 (client, and a dev dependency of the server for tests).

**Spec:** `PRD Collaborative Digital Escape Room.md`. Cross-phase decisions are in `docs/superpowers/plans/2026-11-09-00-roadmap.md`. Choices the PRD leaves open are in `DECISIONS.md` (this phase adds D32–D41). Read all three, plus `CONTEXT.md`, before starting.

**PRD requirements covered:** LOBBY-1..5; GAME-1..7, 8 (board), 9, 11, 12; CHAT-1..5; TIME-1, 2 (warnings in chat), 4 and 6 (a reconnect gets a full snapshot; there is no pause yet); SCORE-1, 2 (no rank, because practice is unranked); PRAC-1..3 (Cyber Heist only); NFR-1, 3, 4, 9, 10; UI-1 pages practice, lobby, attempt and results; UI-3 attempt tabs.
**Not in this phase (see D35–D38, D41):** extra hints (GAME-10, Phase 3); pause, reconnect grace and pause budget (TIME-3, TIME-5, Phase 4); generated values (Phase 3); the result REST endpoint and rank (Phase 4); practice expiry (Phase 5); chat rate limit CHAT-6 (Phase 6).

## Global Constraints

- **Workflow:** read `CONTEXT.md` before each task. Afterwards, append a dated log entry to it (what was done, files touched, test result) and record new or deferred decisions in `DECISIONS.md`.
- **Commits:** no `Co-Authored-By` trailer and no mention of Claude in commit messages or PR bodies. Work on branch `phase-2-core-attempt`.
- JavaScript only (CommonJS on the server, `.jsx` for React), no TypeScript, no CSS framework.
- **NFR-1 / GAME-2:** a client only ever receives its own role's clue half, and never an `answer`, `acceptedAnswers`, `explanation` or unrevealed `hint`. Every attempt payload is built by a function in `services/attemptView.js`.
- **NFR-3:** the socket handshake verifies the JWT with `verifyToken`. Every event checks that the socket has joined an attempt and that its identity is one of that attempt's players.
- **NFR-4:** attempt events go only to room `attempt:<attemptId>`, or to one player's own sockets.
- **NFR-9 / GAME-7:** every mutating event for an attempt runs inside `runtime.enqueue()`. A solve is also an atomic conditional update on `levels.<i>.solvedAt: null`.
- **Values pinned by the PRD:** lobby countdown **5 s** (LOBBY-3); tick every **1 s** (TIME-1); warnings at **5 min, 1 min and 10 s** (TIME-2); one submission per player every **2 s**, and a rejected one costs nothing (§7.4); wrong answer **−10**; level points `max(30, 100 − floor(max(0, t − 60) / 6) − 10w − 25h)` with t in whole seconds (§7.3); completion bonus `floor(remainingMs / 5000)` only when all 5 levels are cleared; stars at 5 cleared / ≥350 / ≥450 (§7.8); chat **1–300** characters after trimming (CHAT-1); practice code **6** characters from the D6 alphabet with an uppercasing setter; Cyber Heist timer **15 min**.
- Socket errors use the REST shape `{ error: CODE, message }` (D5).
- Chat and names render as plain text. Never use `dangerouslySetInnerHTML` (CHAT-5).
- 360 px with no horizontal scroll; touch targets ≥ 44 px; correct and wrong shown by icon and text, not colour alone; reduced motion respected (NFR-15, NFR-16).

## Review Focus

1. **Both teammates submit the correct answer at the same moment.** There is exactly one solve and one points award, and the second submission is ignored. Test in Task 7.
2. **A socket that is not a player in the attempt** (a third person, or a socket that never joined) sends lobby, chat or submit events and gets `NOT_IN_ATTEMPT`. One room's chat never reaches another room. Test in Task 5.
3. **A submission after the timer ran out or after the attempt ended** gets `ATTEMPT_OVER`, and the totals don't change. Test in Task 7.
4. **A player refreshes mid-attempt.** The new socket receives a snapshot with that player's own clue half for the current level, the same score and the chat log. Test in Task 7.
5. **Malformed payloads** (an answer that is an object, a 5000-character chat message, `order: "1"`, chat containing `<script>`) get a `VALIDATION_ERROR` ack and the server keeps running. A script tag is stored and sent as plain text. Tests in Task 5 (chat) and Task 7 (submit).

---

### Task 1: Phase 1 follow-ups (the five deferred minors)

**Files:**
- Modify: `server/src/services/teamService.js` (`renameTeam`), `server/tests/teams.test.js`, `server/tests/teamJoin.test.js`
- Modify: `client/src/pages/TeamPage.jsx` (`MemberList`), `client/src/components/ProtectedRoute.jsx`, `client/src/api/client.js`, `client/src/components/StatusMessage.jsx`, `client/src/styles/base.css`

**Interfaces:**
- Produces: `api()` aborts after **60 s** with `ApiError(0, 'TIMEOUT', 'The server took too long to answer. Try again.')`. `StatusMessage kind="loading"` adds the line "The server may be waking up. This can take up to a minute." once it has been showing for **5 s**.

- [ ] **Step 1: Write the failing server tests**

```js
// teams.test.js
test('a former captain cannot rename an archived team (404)', async () => {
  // alice creates, leaves (team archived), then PATCHes the name
  expect(res.status).toBe(404);
  expect(res.body.error).toBe('TEAM_NOT_FOUND');
});
// teamJoin.test.js: extend the race test
expect(loser.body.error).toBe('TEAM_FULL');
const ids = (await Team.findById(team.id)).memberIds.map(String);
expect(ids).toEqual(expect.arrayContaining([alice.user.id, winner.user.id]));
expect(ids).not.toContain(loser.user.id);
```

- [ ] **Step 2: Run them and confirm the rename test fails**

Run: `npm test -- teams teamJoin` (from `server/`). Expected: the rename test FAILS with 200 instead of 404. The race test may already pass, because it only adds assertions.

- [ ] **Step 3: Implement.** `renameTeam` throws `notFound()` when `team.archived`, as `regenerateInvite` does.

- [ ] **Step 4: Run them and confirm they pass**

Run: `npm test`. Expected: all pass (66).

- [ ] **Step 5: Client fixes (no frontend tests, per the PRD; check by hand)**
  - `MemberList` receives `archived` and hides the open-seat row when it is true.
  - `ProtectedRoute`'s "Create an account" link goes to `/signup?next=<encoded current path + search>`, and adds a "Log in" link with the same `next`.
  - `api()` passes `signal: AbortSignal.timeout(60000)`. A `TimeoutError` maps to `TIMEOUT`; other fetch failures stay `NETWORK_ERROR`.
  - `StatusMessage` shows the slow-server line after 5 s, using one `setTimeout` in an effect that is cleared on unmount.

Manual check: `npm --prefix client run lint` is clean. Open an archived team page: no "Open seat" row. As a guest, open `/teams/join/ABCDEFGH`, click "Create an account": the URL carries `next`.

- [ ] **Step 6: Commit**

```bash
git add server client
git commit -m "fix: phase 1 follow-ups (archived rename, open seat row, guest next link, fetch timeout, cold start hint)"
```

---

### Task 2: Answer normalization and scoring

**Files:**
- Create: `server/src/services/answers.js`, `server/src/services/scoring.js` (`rankCompare` waits for Phase 4 leaderboards, D41)
- Test: `server/tests/answers.test.js`, `server/tests/scoring.test.js`

**Interfaces:**
- Produces:
  - `normalizeAnswer(text: string, kind: 'word'|'code'|'list') → string`. For word and code: uppercase, then drop every character outside `A-Z0-9`. For list: uppercase, replace each run of characters outside `A-Z0-9` with one `-`, then trim `-` from both ends.
  - `isCorrect(level: { answer, acceptedAnswers, answerKind }, text: string) → boolean`. Compares against `answer` and every accepted answer, all normalized. An empty normalized input is never correct.
  - `levelPoints({ activeMs, wrongCount, hintUsed }) → number`
  - `completionBonus(remainingMs) → number`, which is never negative
  - `starsFor({ total, levelsCleared }) → 0|1|2|3`
  - `summarize(levels: Array<{ points, wrongCount, solvedAt }>, { remainingMs }) → { levelPoints, levelsCleared, wrongAnswers, bonus, total, stars }`, with `bonus = 0` unless all 5 levels are solved.

- [ ] **Step 1: Write the failing tests**

```js
// answers.test.js
test.each([
  ['11:25', 'code', '1125'], ['1125', 'code', '1125'], [' fire-wall ', 'word', 'FIREWALL'],
  ['3, 7, 9', 'list', '3-7-9'], ['3 7 9', 'list', '3-7-9'], ['3-7-9', 'list', '3-7-9'], [' 23--12 ,4 ', 'list', '23-12-4'],
])('normalizeAnswer(%p, %p) → %p', (text, kind, out) => expect(normalizeAnswer(text, kind)).toBe(out));
test('a list typed without separators is not accepted', () => {
  expect(isCorrect({ answer: '3-7-9', acceptedAnswers: [], answerKind: 'list' }, '379')).toBe(false);
});
test('accepted alternatives match', () => {
  expect(isCorrect({ answer: 'NODE', acceptedAnswers: ['NODES'], answerKind: 'word' }, 'nodes')).toBe(true);
});
test('punctuation-only input is never correct', () => {
  expect(isCorrect({ answer: 'X', acceptedAnswers: [], answerKind: 'word' }, ' -- ')).toBe(false);
});

// scoring.test.js
test('§7.3 worked example: 180 s, 1 wrong, no hint → 70', () =>
  expect(levelPoints({ activeMs: 180000, wrongCount: 1, hintUsed: false })).toBe(70));
test('first 60 s are free; 65.9 s still 100', () =>
  expect(levelPoints({ activeMs: 65900, wrongCount: 0, hintUsed: false })).toBe(100));
test('66 s → 99', () => expect(levelPoints({ activeMs: 66000, wrongCount: 0, hintUsed: false })).toBe(99));
test('hint costs 25', () => expect(levelPoints({ activeMs: 0, wrongCount: 0, hintUsed: true })).toBe(75));
test('floor of 30', () => expect(levelPoints({ activeMs: 3600000, wrongCount: 9, hintUsed: true })).toBe(30));
test('bonus: 1 point per full 5 s left', () => {
  expect(completionBonus(12999)).toBe(2); expect(completionBonus(-5)).toBe(0);
});
test.each([[4, 999, 0], [5, 349, 1], [5, 350, 2], [5, 449, 2], [5, 450, 3]])(
  'stars(%p cleared, %p points) → %p', (levelsCleared, total, s) => expect(starsFor({ total, levelsCleared })).toBe(s));
test('summarize adds the bonus only when all 5 are solved', () => {
  const solved = (points, wrongCount = 0) => ({ points, wrongCount, solvedAt: new Date() });
  const four = [solved(100), solved(70, 1), solved(90), solved(80), { points: 0, wrongCount: 2, solvedAt: null }];
  expect(summarize(four, { remainingMs: 60000 })).toEqual(
    { levelPoints: 340, levelsCleared: 4, wrongAnswers: 3, bonus: 0, total: 340, stars: 0 });
  const five = [...four.slice(0, 4), solved(100)];
  expect(summarize(five, { remainingMs: 60000 })).toEqual(
    { levelPoints: 440, levelsCleared: 5, wrongAnswers: 1, bonus: 12, total: 452, stars: 3 });
});
```

- [ ] **Step 2: Run them and confirm they fail.** Run: `npm test -- answers scoring`. Expected: FAIL with `Cannot find module`.
- [ ] **Step 3: Implement both modules as pure functions with no I/O.** In `levelPoints`, t = `Math.floor(activeMs / 1000)`.
- [ ] **Step 4: Run them and confirm they pass.** Run: `npm test -- answers scoring`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: answer normalization and scoring rules`

---

### Task 3: Cyber Heist content, Attempt and Message models, player views

**Files:**
- Create: `server/src/content/cyberHeist.js`, `server/src/models/Attempt.js`, `server/src/models/Message.js`, `server/src/services/attemptView.js`
- Test: `server/tests/cyberHeist.test.js`, `server/tests/attemptView.test.js`

**Interfaces:**
- Consumes: `normalizeAnswer`, `summarize` (Task 2).
- Produces:
  - `cyberHeist = { theme, levels }`. `theme` is `{ slug: 'cyber-heist', name, story, timerMinutes: 15, roles: { A: { name, description }, B: { name, description } }, revealText, failText }`. `levels` holds 5 objects of the form `{ order, title, clueA, clueB, answer, acceptedAnswers, answerKind, reward, hint, explanation }`, and a clue is `{ type, data }`.
  - **Clue data shapes** (the client renders these in Task 9):
    - `text { paragraphs: string[] }`
    - `tokens { caption, tokens: [{ label, color, value? }] }`
    - `table { caption, columns: string[], rows: string[][] }`
    - `strip { caption, shift, direction: 'back'|'forward' }`
    - `symbols { caption, symbols: [{ shape, label? }] }`, where shape is one of `triangle circle star square hexagon diamond`
  - `Attempt` model:
    - `challengeId` (ObjectId, default null), `teamId` (default null)
    - `practiceCode`: String, uppercasing setter, unique partial index where the field exists
    - `themeSlug`, `timerMinutes`
    - `players: [{ id: String, kind: 'user'|'guest', name, role: 'A'|'B'|null, ready: Boolean }]` (at most 2, enforced by a validator)
    - `status`: enum `entered lobby countdown in_progress paused finished timed_out ended_early`, default `'entered'`
    - `levels: [{ order, title, clueA, clueB (Mixed), answer, acceptedAnswers, answerKind, reward, hint, explanation, unlockedAt, solvedAt, solvedBy, activeMs, wrongCount (default 0), points (default 0) }]`
    - `board: [{ order, title, reward }]`
    - `countdownEndsAt, startedAt, endsAt, pausedAt` (Dates); `pauseUsedMs` (default 0)
    - `totalPoints, levelsCleared, timeUsedMs, bonus, stars` (all default 0); `finishedAt`; timestamps
  - Static `Attempt.FINAL = ['finished','timed_out','ended_early']`.
  - `Message` model: `{ attemptId (indexed), kind: 'user'|'system', senderName, role: 'A'|'B'|null, text (maxlength 300) }`, with timestamps.
  - In `attemptView.js`:
    - `levelBar(attempt) → [{ order, title, state: 'solved'|'current'|'locked', points, wrongCount }]`. Current is the first unsolved level while the attempt is `in_progress`. The result is `[]` before the start.
    - `lobbyView(attempt, connectedIds: string[]) → { status, countdownEndsAt, players: [{ id, name, role, ready, connected }] }`
    - `messageView(msg) → { id, kind, senderName, role, text, createdAt }`
    - `clueFor(attempt, playerId) → { order, title, clue: { type, data } } | null`, where `clue` is the player's own role's half of the current level
    - `resultView(attempt) → null | { status, levels: [{ order, title, solved, points, wrongCount }], levelPoints, bonus, total, stars, levelsCleared, wrongAnswers, timeUsedMs, text }`. It returns null until the attempt is final. `text` is `revealText` when finished and `failText` otherwise.
    - `toPlayerView(attempt, playerId, { connectedIds = [], messages = [], now = Date.now() }) → { id, practiceCode, status, theme: { slug, name, story, timerMinutes, roles }, me: { id, role }, players, countdownEndsAt, startedAt, endsAt, remainingMs, levels: levelBar, clue: clueFor, board, score, chat: messages.map(messageView), result: resultView }`. `remainingMs` is `max(0, endsAt − now)`, or null before the start. `score` is the sum of level points.

- [ ] **Step 1: Write the content test, which states the level rules from §6.1 step 4**

```js
// cyberHeist.test.js
test('5 levels in order with the §6.5 Cyber Heist titles', () =>
  expect(cyberHeist.levels.map((l) => l.title))
    .toEqual(['Access PIN', 'Firewall', 'Server Reboot', 'Glyph Keypad', 'Vault Finale']));
test.each(cyberHeist.levels.map((l) => [l.title, l]))('%s: answer within limits and not shown by one half', (_, l) => {
  const ans = normalizeAnswer(l.answer, l.answerKind);
  if (l.answerKind === 'word') expect(ans).toMatch(/^[A-Z]{1,8}$/);
  if (l.answerKind === 'code') expect(ans).toMatch(/^\d{1,4}$/);
  for (const half of [l.clueA, l.clueB]) {
    expect(normalizeAnswer(JSON.stringify(half.data), l.answerKind)).not.toContain(ans);
  }
});
test('finale answer spells the rewards in the order clue A gives', () => {
  expect(cyberHeist.levels.slice(0, 4).map((l) => l.reward).sort()).toEqual(['D', 'E', 'N', 'O']);
  expect(cyberHeist.levels[4].answer).toBe('NODE');
});
```

These are the fixed Cyber Heist values (D33; Phase 3 makes them the templates' `fallback`):

```js
// content/cyberHeist.js (levels; write the theme text in the same voice)
// roles: A = Hacker ("inside the network; sees the raw signals"),
//        B = Decoder ("holds the manuals that make sense of them")
[
  { order: 1, title: 'Access PIN', answerKind: 'code', answer: '9742', acceptedAnswers: [], reward: 'D',
    clueA: { type: 'tokens', data: { caption: 'The keypad shows four lit keys.', tokens: [
      { label: 'RED', color: 'red', value: '7' }, { label: 'BLUE', color: 'blue', value: '2' },
      { label: 'GREEN', color: 'green', value: '9' }, { label: 'YELLOW', color: 'yellow', value: '4' }] } },
    clueB: { type: 'tokens', data: { caption: 'Key the colours in this order.', tokens: [
      { label: 'GREEN', color: 'green' }, { label: 'RED', color: 'red' },
      { label: 'YELLOW', color: 'yellow' }, { label: 'BLUE', color: 'blue' }] } },
    hint: 'Read each colour in the Decoder\'s order and take its digit from the Hacker\'s keypad.',
    explanation: 'GREEN 9, RED 7, YELLOW 4, BLUE 2 gives 9742.' },
  { order: 2, title: 'Firewall', answerKind: 'word', answer: 'FIREWALL', acceptedAnswers: [], reward: 'N',
    clueA: { type: 'text', data: { paragraphs: ['Intercepted password from the security gateway:', 'ILUHZDOO'] } },
    clueB: { type: 'strip', data: { caption: 'Shift every letter back by 3 places.', shift: 3, direction: 'back' } },
    hint: 'I moves back 3 places to F.', explanation: 'ILUHZDOO shifted back by 3 is FIREWALL.' },
  { order: 3, title: 'Server Reboot', answerKind: 'list', answer: '23-12-4', acceptedAnswers: [], reward: 'E',
    clueA: { type: 'table', data: { caption: 'Server rack status', columns: ['ID', 'Light', 'Fan'], rows: [
      ['4', 'RED', 'OFF'], ['9', 'GREEN', 'OFF'], ['12', 'AMBER', 'OFF'],
      ['17', 'RED', 'ON'], ['23', 'RED', 'OFF'], ['28', 'GREEN', 'ON']] } },
    clueB: { type: 'text', data: { paragraphs: [
      'A server is offline when its fan is OFF and its light is not GREEN.',
      'Reboot the offline servers from the highest ID to the lowest. Enter the IDs separated by dashes, like 9-5-1.'] } },
    hint: 'Three servers are offline.', explanation: 'Servers 4, 12 and 23 are offline: 23-12-4.' },
  { order: 4, title: 'Glyph Keypad', answerKind: 'code', answer: '8315', acceptedAnswers: [], reward: 'O',
    clueA: { type: 'symbols', data: { caption: 'The door panel shows these glyphs, left to right.', symbols: [
      { shape: 'triangle' }, { shape: 'circle' }, { shape: 'star' }, { shape: 'square' }] } },
    clueB: { type: 'symbols', data: { caption: 'Glyph legend from the manual.', symbols: [
      { shape: 'circle', label: '3' }, { shape: 'diamond', label: '2' }, { shape: 'square', label: '5' },
      { shape: 'hexagon', label: '6' }, { shape: 'triangle', label: '8' }, { shape: 'star', label: '1' }] } },
    hint: 'Two glyphs in the legend are not on the panel.', explanation: 'Triangle 8, circle 3, star 1, square 5 gives 8315.' },
  { order: 5, title: 'Vault Finale', answerKind: 'word', answer: 'NODE', acceptedAnswers: [], reward: null,
    clueA: { type: 'text', data: { paragraphs: [
      'The vault opens with the four fragments, read in this order:', 'Firewall, Glyph Keypad, Access PIN, Server Reboot.'] } },
    clueB: { type: 'text', data: { paragraphs: [
      'Fragments recovered so far:', 'Access PIN gave D. Firewall gave N. Server Reboot gave E. Glyph Keypad gave O.'] } },
    hint: 'The fragments are also on your team board.', explanation: 'N, O, D, E in that order spells NODE.' },
]
```

- [ ] **Step 2: Write the NFR-1 view test**

```js
// attemptView.test.js — build an in-progress Attempt (new Attempt({...}), not saved) with
// players Ann (A) and Ben (B), levels copied from cyberHeist, level 1 solved and level 2 current.
test('player A sees only their own half and no answers', () => {
  const json = JSON.stringify(toPlayerView(attempt, 'ann', { now }));
  for (const banned of ['"answer"', 'acceptedAnswers', 'explanation', '"hint"', 'clueA', 'clueB']) {
    expect(json).not.toContain(banned);
  }
  for (const l of cyberHeist.levels) {
    expect(json).not.toContain(normalizeAnswer(l.answer, l.answerKind));
  }
  expect(json).not.toContain('Shift every letter back'); // B's half of level 2
  expect(toPlayerView(attempt, 'ann', { now }).clue).toEqual({ order: 2, title: 'Firewall', clue: cyberHeist.levels[1].clueA });
  expect(toPlayerView(attempt, 'ben', { now }).clue.clue).toEqual(cyberHeist.levels[1].clueB);
});
test('level bar, board and score after one solve', () => { /* levels[0] solved (state 'solved', points 100), levels[1] 'current', 2..4 'locked'; board [{order:1,title:'Access PIN',reward:'D'}]; score 100 */ });
test('before the start: no levels, no clue, remainingMs null', () => { /* status lobby */ });
test('a player who has not claimed a role gets clue null', () => {});
test('resultView is null until final, then carries the summary and revealText or failText', () => {});
```

- [ ] **Step 3: Run them and confirm they fail.** Run: `npm test -- cyberHeist attemptView`. Expected: FAIL with `Cannot find module`.
- [ ] **Step 4: Implement the content, the two models and `attemptView.js`.** The views use explicit whitelists: copy named fields and never spread a level.
- [ ] **Step 5: Run them and confirm they pass.** Run: `npm test`. Expected: all pass.
- [ ] **Step 6: Commit** `feat: cyber heist content, attempt and message models, player views`

---

### Task 4: Practice rooms over REST

**Files:**
- Create: `server/src/services/identityService.js`, `server/src/services/practiceService.js`, `server/src/controllers/practiceController.js`, `server/src/routes/practiceRoutes.js`
- Modify: `server/src/routes/index.js` (mount `/practice`), `server/src/utils/patterns.js` (add `PRACTICE_CODE`)
- Test: `server/tests/practice.test.js`, plus `createRoom(app, auth)` in `server/tests/helpers/users.js`

**Interfaces:**
- Consumes: `requireAuth` (sets `req.auth = { kind, id, nickname? }`), `generateCode(6)`, `Attempt`, `cyberHeist`.
- Produces:
  - `resolveIdentity({ kind, id, nickname }) → { id, kind, name }`. For a user it loads the user, uses the username and throws 401 `AUTH_REQUIRED` if the user no longer exists. For a guest the name is the nickname.
  - `patterns.PRACTICE_CODE = /^[A-HJ-NP-Z2-9]{6}$/i`
  - `createPractice(identity) → { code }`. It creates an Attempt with `practiceCode`, `themeSlug: 'cyber-heist'`, `timerMinutes: 15`, `status: 'lobby'` and the creator as the only player (role null, not ready), and retries on a code collision as `withFreshCode` does.
  - `findPractice(code) → Attempt` (404 `PRACTICE_NOT_FOUND`)
  - `getPracticePreview(code, identity) → { code, status, theme: { slug, name, story, timerMinutes, roles }, players: [{ name, role }], isMember, full }`
  - `joinPractice(code, identity) → Attempt`. It is one atomic `findOneAndUpdate` filtered on `{ practiceCode, status: 'lobby', 'players.id': { $ne: id }, 'players.1': { $exists: false } }`, with `$push` of the player. An existing member gets the attempt back unchanged. Otherwise it throws `ROOM_FULL` (409) or `ALREADY_STARTED` (409), or `PRACTICE_NOT_FOUND`. Task 5's socket handler uses it.
  - `POST /api/practice` (any token) → 201 `{ code }`. `GET /api/practice/:code` (any token) → 200 preview. A malformed code → 404.

- [ ] **Step 1: Write the failing tests**

```js
test('a player creates a room; the code is 6 characters from the alphabet', /* 201, /^[A-HJ-NP-Z2-9]{6}$/ */);
test('a guest can create and preview a room (D32)', /* createGuest → 201, preview players[0].name === guest nickname */);
test('preview: theme Cyber Heist, 15 min, roles Hacker/Decoder, isMember true for the creator, false for others', );
test('preview with lower-case code works', );
test('unknown or malformed code → 404 PRACTICE_NOT_FOUND', /* 'ZZZZZZ' and 'abc' */);
test('no token → 401', );
test('joinPractice: two people race for the second seat → exactly one joins', async () => {
  const results = await Promise.allSettled([joinPractice(code, bob), joinPractice(code, cara)]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(results.find((r) => r.status === 'rejected').reason.code).toBe('ROOM_FULL');
  expect((await Attempt.findOne({ practiceCode: code })).players).toHaveLength(2);
});
test('joinPractice: a member re-joining is a no-op; after start → ALREADY_STARTED for newcomers', );
```

- [ ] **Step 2: Run them and confirm they fail.** Run: `npm test -- practice`. Expected: FAIL with 404 on `POST /api/practice`.
- [ ] **Step 3: Implement.** Validate `:code` with `PRACTICE_CODE` before querying (NFR-5).
- [ ] **Step 4: Run them and confirm they pass.** Run: `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `feat: practice rooms (create, preview, atomic join)`

---

### Task 5: Socket.io server, room join, presence and chat

**Files:**
- Create: `server/src/sockets/index.js`, `server/src/sockets/runtime.js`, `server/src/sockets/handlers.js`, `server/src/sockets/validate.js`, `server/src/services/chatService.js`
- Modify: `server/src/server.js` (attach sockets), `server/package.json` (add `socket.io`; dev dependency `socket.io-client`)
- Test: `server/tests/helpers/sockets.js`, `server/tests/socketJoin.test.js`

**Interfaces:**
- Consumes: `verifyToken`, `resolveIdentity`, `joinPractice`, `toPlayerView`, `lobbyView`, `messageView`, `Message`.
- Produces:
  - `attachSockets(httpServer, { clientOrigins, countdownMs = 5000, tickMs = 1000, submitGapMs = 2000, timerMs = null }) → io`. `timerMs` overrides the theme timer and exists for tests only. Socket.io `cors: { origin: clientOrigins }`. The handshake reads `socket.handshake.auth.token`, then sets `socket.data.identity = { id, kind, name }`. A bad token fails the connection with `connect_error` message `AUTH_REQUIRED`.
  - `runtime.js`:
    - `getRuntime(attemptId) → AttemptRuntime`, created lazily. When it is created for an `in_progress` attempt it starts ticking; a `countdown` found on creation (for example after a restart) goes back to `lobby`.
    - `dropRuntime(attemptId)`; `stopAllRuntimes()`, which clears every timer and is used by tests and shutdown.
    - The `AttemptRuntime` class:
      - `enqueue(fn) → Promise`: serialized, and one failing job doesn't block the next
      - `addSocket(playerId, socket)`; `removeSocket(playerId, socket) → boolean`, which returns true when that player now has no sockets
      - `connectedIds() → string[]`
      - `emitToRoom(event, payload)`; `emitToPlayer(playerId, event, payload)`
      - `options`, the attach options
  - `chatService`: `postMessage(attemptId, { kind, senderName, role, text }) → messageView`; `recentMessages(attemptId) → messageView[]`, oldest first, at most 500.
  - `validate.js`: `str(v, { field, min, max })` (trims first), `int(v, { field, min, max })` (rejects strings) and `oneOf(v, list, field)`. Each throws `AppError(400, 'VALIDATION_ERROR', message)`.
  - Handler wrapper: every client event takes `(payload, ack)`. On success it calls `ack({ ok: true, ...extra })`. On an `AppError` it calls `ack({ error, message })` if an ack was given, and otherwise emits `error` with that body. Any other error is logged and answered with `INTERNAL_ERROR`.
  - Events in this task:
    - `attempt:join { practiceCode }`: calls `joinPractice`, joins room `attempt:<id>`, sets `socket.data.attemptId`, acks, then emits `attempt:snapshot` (`toPlayerView` with `connectedIds` and `recentMessages`) to this socket. When the player's first socket arrives, the room gets `lobby:update` and a system message "<name> joined". If the socket already joined a different attempt, the reply is `ALREADY_IN_ATTEMPT`.
    - `chat:send { text }`: 1–300 characters after trimming. Stores and broadcasts `chat:message` with the sender's name and current role.
    - On disconnect, when the player's last socket goes: in the lobby, a `lobby:update` and the system message "<name> left". During a countdown, the countdown is cancelled (Task 6). In progress, nothing happens, because pausing arrives in Phase 4.
    - Every event other than `attempt:join` requires `socket.data.attemptId`, and that the identity is in `attempt.players`. Otherwise the reply is `NOT_IN_ATTEMPT` (403).
- Test helpers: `startSocketServer(options) → { url, io, close }`, which listens on port 0 and whose `close()` also calls `stopAllRuntimes()`; `connect(url, token) → Promise<socket>`; `nextEvent(socket, event, ms = 2000) → Promise<payload>`; `join(socket, code) → socket.emitWithAck('attempt:join', { practiceCode: code })`.

- [ ] **Step 1: Write the failing tests**

```js
test('connecting without a valid token fails with AUTH_REQUIRED', /* await expect(connect(url, 'bad')).rejects.toThrow('AUTH_REQUIRED') */);
test('creator and partner join; each gets a snapshot with both players, the partner gets lobby:update', async () => {
  const snapB = nextEvent(b, 'attempt:snapshot');
  const update = nextEvent(a, 'lobby:update');
  expect(await join(b, code)).toEqual({ ok: true });
  expect((await snapB).players.map((p) => p.name)).toEqual(['alice', 'bob']);
  expect((await update).players.every((p) => p.connected)).toBe(true);
});
test('a third player gets ROOM_FULL', );
test('chat reaches the teammate as plain text, with sender and time', async () => {
  const got = nextEvent(b, 'chat:message');
  await a.emitWithAck('chat:send', { text: '  <script>alert(1)</script>  ' });
  expect(await got).toMatchObject({ kind: 'user', senderName: 'alice', text: '<script>alert(1)</script>' });
});
test('chat validation: empty, 301 characters, or a non-string → VALIDATION_ERROR', );
test('chat from another room never arrives (NFR-4)', /* a second room's socket listens for chat:message for 300 ms → nothing */);
test('a socket that never joined gets NOT_IN_ATTEMPT for chat:send', );
test('a reconnecting socket gets the chat log in its snapshot (CHAT-3)', );
test('disconnecting in the lobby sends lobby:update with connected false and a "left" system message', );
```

- [ ] **Step 2: Run them and confirm they fail.** Run: `npm test -- socketJoin`. Expected: FAIL with `Cannot find module '../src/sockets'`.
- [ ] **Step 3: Install and implement.** Run `npm i socket.io` and `npm i -D socket.io-client` in `server/`. In `server.js`, `attachSockets(server, { clientOrigins: config.clientOrigins })` runs before `listen`.
- [ ] **Step 4: Run them and confirm they pass.** Run: `npm test`. Expected: all pass, and Jest exits with no open-handle warning.
- [ ] **Step 5: Commit** `feat: socket.io server with room join, presence and team chat`

---

### Task 6: Lobby roles, ready, countdown, start and server timer

**Files:**
- Create: `server/src/services/lobbyService.js`
- Modify: `server/src/sockets/handlers.js`, `server/src/sockets/runtime.js`
- Test: `server/tests/socketLobby.test.js`

**Interfaces:**
- Consumes: Task 5 runtime, handler wrapper and helpers; `cyberHeist.levels`; `lobbyView`, `toPlayerView`; `postMessage`.
- Produces:
  - `lobbyService` functions, each of which loads, changes and saves the Attempt and returns it:
    - `claimRole(attemptId, playerId, role)`: allowed only in `lobby`. A role the partner holds → `ROLE_TAKEN` (409). Claiming the other role swaps it, and claiming clears the player's ready flag.
    - `releaseRole(attemptId, playerId)`: clears role and ready.
    - `setReady(attemptId, playerId, { connectedIds, now, countdownMs })`: requires a role (`ROLE_REQUIRED`). It sets ready, and when both players are present and connected, hold A and B, and are ready, it sets `status: 'countdown'` with `countdownEndsAt = now + countdownMs`.
    - `unready(attemptId, playerId)` (the `lobby:cancel` event): clears this player's ready flag. During a countdown it also returns to `lobby` and clears `countdownEndsAt`.
    - `startAttempt(attemptId, { now, timerMs })`: only from `countdown`. It copies `cyberHeist.levels` into `attempt.levels` (GAME-1), sets level 1 `unlockedAt = now`, `startedAt = now`, `endsAt = now + timerMs` and `status: 'in_progress'`.
  - Runtime:
    - `startCountdown()`: a `setTimeout(countdownMs)` that enqueues `startAttempt`, then emits `attempt:snapshot` to each player and the system message "Attempt started".
    - `cancelCountdown()`
    - `startTicking()`: a `setInterval(tickMs)` that emits `attempt:tick { remainingMs }` to the room. As `remainingMs` crosses 300000, 60000 and 10000 it posts one system message each ("5 minutes left", "1 minute left", "10 seconds left"). At ≤ 0 it enqueues `endAttempt(id, 'timed_out')`, which comes from Task 7. Until Task 7 lands, Step 3 adds a minimal `endAttempt` that sets status and `finishedAt` and emits `attempt:ended`.
    - `stopTicking()`
  - Events: `lobby:claimRole { role }`, `lobby:releaseRole`, `lobby:ready` and `lobby:cancel`. Each broadcasts `lobby:update` after its change. A player leaving during a countdown runs `unready` for that player.

- [ ] **Step 1: Write the failing tests** (server started with `countdownMs: 200, tickMs: 100`)

```js
test('claiming a role locks it for the partner (ROLE_TAKEN)', );
test('ready without a role → ROLE_REQUIRED', );
test('both ready → countdown → snapshot with level 1 and each player\'s own half', async () => {
  // a claims A, b claims B, both ready
  const [snapA, snapB] = await Promise.all([nextEvent(a, 'attempt:snapshot'), nextEvent(b, 'attempt:snapshot')]);
  expect(snapA.status).toBe('in_progress');
  expect(snapA.clue.clue).toEqual(cyberHeist.levels[0].clueA);
  expect(snapB.clue.clue).toEqual(cyberHeist.levels[0].clueB);
  expect(snapA.remainingMs).toBeGreaterThan(14 * 60 * 1000);
});
test('cancel during the countdown returns to lobby and nothing starts', /* wait 400 ms: status lobby, no snapshot */);
test('ready does not start a countdown while the partner is offline', );
test('the partner disconnecting during the countdown cancels it', );
test('ticks arrive about every tickMs and remainingMs decreases', );
test('the timer running out ends the attempt as timed_out', /* server started with timerMs: 600 → attempt:ended status timed_out within 2 s */);
test('role changes after the start are rejected (NOT_IN_LOBBY)', );
```

- [ ] **Step 2: Run them and confirm they fail.** Run: `npm test -- socketLobby`. Expected: FAIL, because the lobby events are not handled.
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run them and confirm they pass.** Run: `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `feat: lobby roles, ready countdown, attempt start and server timer`

---

### Task 7: Answer submission, solves, board, finish and quit

**Files:**
- Create: `server/src/services/gameService.js`
- Modify: `server/src/sockets/handlers.js`, `server/src/sockets/runtime.js`
- Test: `server/tests/socketGame.test.js`

**Interfaces:**
- Consumes: `isCorrect`, `levelPoints`, `summarize`; `levelBar`, `clueFor`, `resultView`; `postMessage`; runtime.
- Produces:
  - `submitAnswer(attemptId, player: { id, name, role }, { order, answer }, now) → outcome`. Each outcome has one of these shapes:
    - `{ kind: 'ignored' }` when `order` is not the current level (GAME-7)
    - `{ kind: 'wrong', order, wrongCount }`
    - `{ kind: 'solved', order, points, finished: boolean }`
  - Rules:
    - The status must be `in_progress` and `now < endsAt`, otherwise `ATTEMPT_OVER` (409).
    - On a correct answer, one `Attempt.findOneAndUpdate` filters on `{ _id, status: 'in_progress', ['levels.<i>.solvedAt']: null }`. It sets `solvedAt`, `solvedBy` (player id), `activeMs = now − unlockedAt` and `points`. It also sets the next level's `unlockedAt = now` (unless this was level 5), pushes `{ order, title, reward }` onto `board` (only when `reward` is not null), and updates `levelsCleared` and `totalPoints` as running values. A null result → `ignored`.
    - On a wrong answer, `$inc` the level's `wrongCount`.
  - `endAttempt(attemptId, status, now) → Attempt | null`. It is a no-op (null) when the attempt is already final. Otherwise it sets the status, `finishedAt = now` and `timeUsedMs = min(now, endsAt) − startedAt`, and the `summarize` fields, with `remainingMs = endsAt − now`, which only counts for `finished`. It replaces Task 6's minimal version.
  - Runtime: `lastSubmitAt: Map<playerId, ms>`. A submission sooner than `submitGapMs` after the same player's last one → `RATE_LIMITED` (429), and it costs nothing.
  - Events:
    - `level:submit { order: int 1–5, answer: string 1–40 }` (after rate limiting and validation) → ack `{ ok: true }` or `{ ok: true, ignored: true }`.
      - Wrong: broadcast `level:result { order, correct: false, submittedBy: { id, name, role }, text: <answer as typed, trimmed>, deduction: 10, wrongCount }` and the system message `Wrong answer "<text>" from <role name> (−10)`.
      - Solved: broadcast `level:result { order, correct: true, submittedBy, text, points }`, then `board:update { board, score, levels: levelBar }`, the system message "<title> solved: +<points>", and `level:unlocked { order, title, clue }` per player from `clueFor`, unless it was level 5.
      - Level 5 solved → `endAttempt(…, 'finished')`.
    - `attempt:quit` → `endAttempt(…, 'ended_early')` (GAME-12).
    - Every end (finished, timed out or quit) broadcasts `attempt:ended { status, result: resultView }` and the system message "Attempt ended", then stops ticking. The runtime is dropped once no sockets remain.

- [ ] **Step 1: Write the failing tests** (server with `countdownMs: 50, tickMs: 100, submitGapMs: 0` unless a test says otherwise. A helper `startedRoom()` returns `{ a, b, attemptId }` already in progress.)

```js
const ANSWERS = ['9742', 'FIREWALL', '23-12-4', '8315', 'NODE'];
test('full run: both players see the same results', async () => {
  for (const [i, ans] of ANSWERS.entries()) await (i % 2 ? b : a).emitWithAck('level:submit', { order: i + 1, answer: ans });
  const [endA, endB] = [await nextEvent(a, 'attempt:ended'), await nextEvent(b, 'attempt:ended')];
  expect(endA).toEqual(endB);
  expect(endA.status).toBe('finished');
  expect(endA.result).toMatchObject({ levelsCleared: 5, levelPoints: 500, stars: 3 });
  expect(endA.result.total).toBe(500 + endA.result.bonus);
  expect(endA.result.bonus).toBeGreaterThan(170); // ~14:59 left → 179
});
test('wrong answer: both see the text and −10, the level stays open, points later reflect it', /* wrong then right on level 1 → points 90 */);
test('answers are normalized: "23, 12, 4" solves Server Reboot', );
test('simultaneous correct answers produce one solve and one award', async () => {
  const results = [];
  a.on('level:result', (r) => results.push(r));
  const acks = await Promise.all([a.emitWithAck('level:submit', { order: 1, answer: '9742' }),
                                  b.emitWithAck('level:submit', { order: 1, answer: '9742' })]);
  await new Promise((r) => setTimeout(r, 300));
  expect(results.filter((r) => r.correct)).toHaveLength(1);
  expect(acks.filter((x) => x.ignored)).toHaveLength(1);
  expect((await Attempt.findById(attemptId)).levels[0].points).toBe(100);
});
test('an answer for an already solved level is ignored', );
test('level:unlocked gives each player only their own half', /* a gets clueA of level 2, b gets clueB; JSON of a's payload lacks 'Shift every letter back' */);
test('board:update carries the reward fragment and the running score', );
test('rate limit: a second submission within 2 s → RATE_LIMITED and no wrong count', /* server with submitGapMs: 2000 */);
test('submit validation: answer as an object, a 41-character answer, or order "1" → VALIDATION_ERROR', );
test('after quit: ended_early keeps earned points; a later submit → ATTEMPT_OVER', );
test('after the timer runs out a submit → ATTEMPT_OVER and totals do not change', /* timerMs: 400 */);
test('a reconnect mid-attempt gets the snapshot: same role, own current clue, score and chat', async () => {
  // solve level 1, a.disconnect(), connect a new socket for alice, join → snapshot
  expect(snap).toMatchObject({ status: 'in_progress', me: { role: 'A' }, score: 100 });
  expect(snap.clue).toEqual({ order: 2, title: 'Firewall', clue: cyberHeist.levels[1].clueA });
  expect(snap.chat.some((m) => m.text.includes('Access PIN solved'))).toBe(true);
});
```

- [ ] **Step 2: Run them and confirm they fail.** Run: `npm test -- socketGame`. Expected: FAIL, because `level:submit` is not handled.
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run them and confirm they pass.** Run: `npm test`. Expected: all pass, with no open handles.
- [ ] **Step 5: Commit** `feat: answer checking, solves, team board, finish and quit`

---

### Task 8: Client socket, practice pages and lobby

**Files:**
- Create: `client/src/api/practice.js`, `client/src/api/socket.js`, `client/src/game/attemptReducer.js`, `client/src/hooks/useAttempt.js`, `client/src/pages/PracticeHome.jsx`, `client/src/pages/PlayPage.jsx`, `client/src/components/game/Lobby.jsx`, `client/src/components/game/RoleCard.jsx`, `client/src/components/game/ChatPanel.jsx`, `client/src/styles/game.css`
- Modify: `client/package.json` (`socket.io-client`), `client/src/api/client.js` (export `API_BASE`), `client/src/App.jsx` (routes `practice` and `play/:code` for `['user', 'guest']`), `client/src/pages/Dashboard.jsx` (a Practice tile for players; guests get a "Start a practice room" button), `client/src/utils/validators.js` (`PRACTICE_CODE`, the same regex as the server's), `client/src/main.jsx` (import `game.css`)

**Interfaces:**
- Consumes: the REST endpoints from Task 4 and the socket events from Tasks 5–7, with exactly the payloads given there.
- Produces:
  - `createPractice() → { code }`; `getPractice(code) → preview`
  - `connectSocket() → Socket`, which is `io(API_BASE || undefined, { auth: { token: getToken() } })`
  - `attemptReducer(state, { type, payload })` with these types:
    - `snapshot`: replaces the state
    - `lobby`: merges `status`, `countdownEndsAt` and `players`
    - `tick`: sets `remainingMs`
    - `result`: keeps the last `level:result` as `lastResult`, and updates `levels[order-1].wrongCount` on a wrong answer
    - `unlocked`: sets `clue`
    - `board`: sets `board`, `score` and `levels`
    - `chat`: appends to `chat`
    - `ended`: sets `status` and `result`
  - `useAttempt(code) → { state, connection: 'connecting'|'online'|'offline', error, actions: { claimRole(role), releaseRole(), ready(), cancel(), sendChat(text), submit(order, answer), quit() } }`. Every action returns the ack. The hook emits `attempt:join` on every `connect`, so a reconnect gets a fresh snapshot (TIME-6). It disconnects on unmount. `connect_error` with `AUTH_REQUIRED` sets `error`.
  - `ChatPanel({ messages, onSend, myRole, roles })`: a log with sender role name and time, system messages styled differently, a 300-character input with a counter, and text rendered as plain text. It is reused on the results screen in read-only mode.
  - `Lobby({ state, actions })`, which shows:
    - the theme name and story, plus room code and copy-link `/play/<code>` while a seat is open
    - two `RoleCard`s with the role name, description, holder, online dot, and Claim/Release
    - a Ready/Not ready toggle, enabled once I hold a role
    - the countdown "Starting in N" with Cancel
    - timer length and a scoring summary ("100 points per level, −10 per wrong answer, time after the first minute costs points")
    - the LOBBY-4 warning "You get one attempt. Leaving the page does not stop the timer."
- `PracticeHome` (`/practice`): a "Create a practice room" button that leads to `/play/<code>`, and a join form that checks `PRACTICE_CODE`, uppercases the code and leads to `/play/<code>`.
- `PlayPage` (`/play/:code`): handles loading, error (unknown room or room full, with a link back to `/practice`) and offline ("Reconnecting…" banner) states. It renders `Lobby` for `lobby` and `countdown`; Task 9 adds the game and results screens.

- [ ] **Step 1: Install and implement.** Run `npm --prefix client i socket.io-client`.
- [ ] **Step 2: Verify.** Run: `npm --prefix client run lint` and `npm --prefix client run build`. Expected: lint clean; build OK with gzip JS under 300 KB (NFR-12).
- [ ] **Step 3: Manual check.** Run `npm --prefix server run dev:memory` and `npm run dev:client`. Use two browsers: one logged in, one guest. Create a room and join it by link. Both see each other online. Claim roles, and the other card locks. Chat both ways, and `<b>x</b>` shows as text. Ready on both shows the countdown; Cancel stops it. At 360 px there is no horizontal scroll.
- [ ] **Step 4: Commit** `feat: practice pages, socket hook and team lobby`

---

### Task 9: Attempt screen, clue renderers and results

**Files:**
- Create: `client/src/components/clues/ClueView.jsx`, `TextClue.jsx`, `TokensClue.jsx`, `TableClue.jsx`, `StripClue.jsx`, `SymbolsClue.jsx`, `Glyph.jsx`; `client/src/components/game/GameScreen.jsx`, `LevelBar.jsx`, `AnswerBox.jsx`, `Board.jsx`, `TimerDisplay.jsx`, `ResultFlash.jsx`, `Results.jsx`
- Modify: `client/src/pages/PlayPage.jsx`, `client/src/styles/game.css`

**Interfaces:**
- Consumes: the `useAttempt` state and actions (Task 8); the clue data shapes (Task 3).
- Produces:
  - `ClueView({ clue })` picks a renderer by `clue.type`; an unknown type shows "This clue type is not supported yet". It is composed by display type (Unit II).
  - The renderers:
    - `TokensClue`: chips with the colour, label and value. The label is always printed (NFR-16).
    - `StripClue`: the A–Z row with the shifted row under it, plus arrows that follow `direction`.
    - `TableClue`: a real `<table>` with `<th>` headers that scrolls horizontally inside its own box on phones.
    - `SymbolsClue`: `Glyph`s, with captions when `label` is set.
    - `Glyph({ shape, size = 48 })`: inline SVG for the 6 shapes, with `role="img"` and `aria-label={shape}`.
  - `TimerDisplay`: a **class component** (Unit II) taking `remainingMs`. It renders `m:ss`, adds a warning style under 60 s, and has `aria-live="off"`.
  - `LevelBar({ levels, score })`: 5 steps marked solved (✓ and points), current or locked (a lock icon), plus the running score.
  - `AnswerBox({ order, onSubmit })`: a controlled input of at most 40 characters that calls `onSubmit(answer)` (child to parent) and shows the ack error (`RATE_LIMITED` → "Wait 2 seconds between answers"). It clears on success.
  - `ResultFlash({ result })`: "✓ Correct: +N" or "✗ Wrong: −10 (<text>)" for about 3 s, with a short animation that is skipped under reduced motion.
  - `Board({ board })`: the fragments from solved levels, or "Solve a level to collect its fragment" when there are none.
  - `GameScreen({ state, actions })`:
    - Header: theme name, `TimerDisplay`, score, and an "End attempt" `ConfirmButton` that calls `quit()`.
    - Then `LevelBar` and three panels: Clue (own role name and `ClueView` + `AnswerBox`), Board, and Chat (`ChatPanel`).
    - At ≥ 900 px the panels sit side by side. Below that, a tab bar (Clue / Board / Chat) shows one panel at a time, and the Chat tab shows an unread badge (UI-3).
  - `Results({ state })`:
    - A headline per status: Finished, Time's up, or Ended early.
    - The result text and stars, written as ★ plus "3 of 3 stars".
    - A per-level table (points, wrong answers, solved ✓/✗), then level points, bonus, total, wrong answers and time used (m:ss).
    - The read-only chat log (CHAT-4), and a "New practice room" link to `/practice`.
  - `PlayPage` renders `GameScreen` for `in_progress` and `Results` for any final status.

- [ ] **Step 1: Implement**
- [ ] **Step 2: Verify.** Run: `npm --prefix client run lint` and `npm --prefix client run build`. Expected: clean, with gzip JS under 300 KB.
- [ ] **Step 3: Manual check.** Use two browsers in one room and play all 5 levels:
  - one wrong answer: both see ✗ with the text
  - a double submit: one solve
  - refresh one tab mid-level: the same clue, score and chat come back
  - finish: both results screens show identical totals
  - at 360 px the tabs work and there is no horizontal scroll
  - in DevTools (Network → WS frames, plus React state), no answer or partner half appears (NFR-1)
- [ ] **Step 4: Commit** `feat: attempt screen, clue renderers and results`

---

### Task 10: Docs, deploy and the Phase 2 gate

**Files:**
- Modify: `README.md`: a Real-time section with the socket event table and the room rule, and the CO1 trace of **submitting an answer** (AnswerBox → `useAttempt.submit` → socket `level:submit` → `handlers.js` → `runtime.enqueue` → `gameService.submitAnswer` → `Attempt` atomic update → `level:result`/`board:update` emits). Also update the test count.
- Modify: `CONTEXT.md`, `DECISIONS.md`, `docs/superpowers/plans/2026-11-09-00-roadmap.md` (phase statuses)

- [ ] **Step 1: Write the docs.** Then run `npm test`; expected: all pass. Run `npm --prefix client run lint`; expected: clean.
- [ ] **Step 2: Commit** `docs: real-time section, answer-submission trace, phase 2 log`
- [ ] **Step 3: Deploy.** This needs the user, so ask before merging or pushing. Merge to `main` and push. Render and Vercel redeploy from `main`, and no new environment variables are needed: sockets use the same `VITE_API_URL` and `CLIENT_ORIGIN`.
- [ ] **Step 4: Gate (§11 Phase 2).** On two devices on different networks: open `https://duo-sync-lovat.vercel.app/practice`, create and join a room, play Cyber Heist to the end, and confirm both results screens show the same total. Log the result in `CONTEXT.md`.
