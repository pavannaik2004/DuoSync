# Phase 4 — Competition and Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Challenges get a live, correctly ranked leaderboard with in-progress teams, a creator's team view, final results and solutions after closing, and player/team profiles with history. A teammate's disconnect pauses the attempt, within a 60-second grace period and a 3-minute pause budget, and a refresh or a server restart restores the game (PRD §11 Phase 4, EL Phase II).

**Architecture:** Pause rules are pure functions in `services/clock.js` (active time, remaining time, folding a pause into `endsAt`). `services/pauseService.js` writes them with atomic conditional updates. The socket layer arms grace and budget timers on the existing `AttemptRuntime`, and `sockets/recovery.js` rebuilds every live runtime at boot. Leaderboards are aggregation queries on `attempts` (`services/leaderboardService.js`, never stored, §9.1). A `leaderboard:<challengeId>` socket room receives coalesced `leaderboard:update` broadcasts. Profiles and history are REST queries over final challenge attempts.

**Tech Stack:** The Phase 3 stack (Node 22, Express 5, Mongoose 9, Socket.io, React 19, Vite). No new dependencies.

**Spec:** `PRD Collaborative Digital Escape Room.md` (§5.3 CHAL-5/10, §5.7 TIME, §5.8 SCORE, §5.1 AUTH-6, §5.2 TEAM-3/6, §7.1–7.3, §7.6–7.7, §9.2–9.3). Cross-phase rules are in `docs/superpowers/plans/2026-11-09-00-roadmap.md`. Before starting, read those, `DECISIONS.md` (D1–D66, plus D67–D81 added by this plan) and `CONTEXT.md`.

**PRD requirements covered:** TIME-3, 4, 5, 6; §7.3 *t* excluding paused time; §7.5 hint delay excluding paused time; §7.6 (pause, grace, budget); §7.7 `paused` transitions; CHAT-2 pause and resume messages; SCORE-2 (current rank), 3, 4, 5, 7; CHAL-5 (leaderboard on the challenge page), CHAL-10; AUTH-6; TEAM-3 (challenge record), TEAM-6; NFR-8, NFR-11; the boot-time runtime rebuild from the roadmap; DECISIONS Q3 and Q5; the Phase 3 parked race (team-change writes outside the queue).
**Not in this phase:** SCORE-6 and AUTH-7, both C priority, move to Phase 6 (D78). The public challenges list and filters (CHAL-4), admin, organizer granting and practice expiry are Phase 5. Theming, audio and accessibility polish are Phase 6.

## Decisions this plan adds (write them into DECISIONS.md in Task 13)

| # | Decision |
| --- | --- |
| D67 | **Pause model.** Each player has `awaySince` (Date or null). A player is away when their last socket drops during `in_progress` or `paused`. The clock stops (`status: paused`, `pausedAt`) only while pause budget remains. If the budget runs out mid-pause, the clock restarts (`in_progress`) but the grace countdown continues. If any away player's 60 s grace passes, the attempt ends `ended_early` |
| D68 | Paused time is kept per level in `levels.<i>.pausedMs`. A level's active time = `now − unlockedAt − pausedMs − (now − pausedAt, if paused)`. It drives the §7.3 points and the 90 s hint delay (replaces D59) |
| D69 | While the clock is stopped, `level:submit` and `hint:reveal` get 409 `ATTEMPT_PAUSED` at no cost. Chat stays open |
| D70 | `timeUsedMs = min(end, endsAt) − startedAt − pauseUsedMs`. Folding a pause is capped at the remaining budget, so `pauseUsedMs` never exceeds 180 000 |
| D71 | **Boot recovery** (resolves Q5). At boot, a `countdown` returns to `lobby`. Each `in_progress`/`paused` attempt gets a runtime. It ends `timed_out` if its time has run out, or `ended_early` if a player's grace already passed. Otherwise every player not yet away is marked away from the boot time (a new pause if budget remains), and the old `awaySince` values are kept. Downtime before the boot is not refunded |
| D72 | **Leaderboard.** Only final attempts are ranked, by the §7.3 order (points ↓, levels ↓, time used ↑, `finishedAt` ↑). Teams equal on all four share a rank (1, 1, 3). `playing` lists `countdown`/`in_progress`/`paused` teams with the level reached. `waiting` lists `entered`/`lobby` teams, labelled "did not start" once the window has closed. `provisional` is true until the challenge status is `closed` |
| D73 | **Live leaderboard.** `leaderboard:watch { challengeId }` (players only) joins `leaderboard:<id>` and returns the board in the ack. After a start, solve, end, pause or resume, the server recomputes the board at most once per `leaderboardDelayMs` (500 ms) per challenge and emits `leaderboard:update` with the full board |
| D74 | `rankOf(attempt)` = 1 + the number of final attempts in the same challenge that are strictly ahead by §7.3 (a `$or` comparison query, Lab 7). Results, history and profile show it as `{ position, outOf, provisional }`. Practice has no rank |
| D75 | SCORE-5 (resolves Q3): `GET /challenges/:id/teams` is open to the creator and to any organizer or admin. It shows team, members, status, level reached and points, which is nothing the leaderboard doesn't show except the names of teams that haven't started. So a creator who also plays may see it |
| D76 | Solutions (CHAL-10) are served only when the challenge status is `closed`, otherwise 409 `NOT_CLOSED`. They are built by `solutionsView` in `challengeView.js` |
| D77 | History lists only final challenge attempts (never practice), 10 per page, newest `finishedAt` first. A page past the end is empty; `page` < 1 or not an integer → 400. TEAM-3's record is `{ played, totalPoints }` per team |
| D78 | SCORE-6 (per-theme overall ranking) and AUTH-7 (edit profile), both C priority, move to Phase 6 |
| D79 | `Attempt` uses Mongoose `optimisticConcurrency`. Team-change writes to attempts (`syncEntries`, `addToEntries`) `$inc` `__v`. The lobby service retries a `VersionError` up to 3 times. This closes the Phase 3 parked race |
| D80 | `GET /api/attempts/:id/result` is open to the attempt's players (by token subject, so practice guests too). It returns the result with rank and the chat log, or 409 `NOT_FINISHED` |
| D81 | `attempt:tick` keeps running while the clock is stopped. Its `remainingMs` stays frozen, and it carries `paused` plus `away: [{ id, graceMs }]`, so the reconnect countdown is also server-owned (§7.2) |

## Global Constraints

- **Workflow:** read `CONTEXT.md` before each task. Afterwards, append a dated log entry to it and record decisions in `DECISIONS.md`. Work on branch `phase-4-competition` (from `main`).
- **Commits:** no `Co-Authored-By` trailer and no mention of Claude (D20).
- JavaScript only (CommonJS on the server, `.jsx` for React), no TypeScript, no CSS framework, no new npm dependencies.
- **NFR-1:** attempt payloads are still built only in `services/attemptView.js`, challenge payloads only in `services/challengeView.js`, and leaderboard payloads only in `services/leaderboardService.js` (`boardView`). Answers and explanations leave the server only through `solutionsView` once the challenge is `closed`.
- **NFR-4:** `leaderboard:<id>` receives only `leaderboard:update`. It never receives chat, clues, `level:*`, `board:*` or `attempt:*` events.
- **Values pinned by the PRD:** a 60 s reconnect grace (§7.6); a pause budget of **3 minutes** per attempt; timer warnings at 5 min, 1 min and 10 s (TIME-2); hint at **90 s** of active time; history **10 per page**, newest first (SCORE-7); ranking order points → levels cleared → less time used → earlier finish (§7.3); a 100-team leaderboard loads in **< 1 s** (NFR-11); a reload shows the server state within **2 s** (NFR-8).
- **Socket option defaults** (tests override them): `graceMs: 60000`, `pauseBudgetMs: 180000`, `leaderboardDelayMs: 500`. Socket tests that disconnect a player mid-game and expect the old behaviour pass `pauseBudgetMs: 0` and a short `graceMs`.
- Errors use `{ error: CODE, message }` (D5), and socket replies use acks (D39). Guests get 403 `GUEST_NOT_ALLOWED` on every challenge, leaderboard, user and team route and on `leaderboard:watch`.
- 360 px with no horizontal scroll; touch targets ≥ 44 px; the pause banner and ranks are text, not colour alone (NFR-15, NFR-16).

## Review Focus

1. **A player with two tabs closes one.** No pause and no "left" message: a player is away only when their last socket drops. Test in Task 4.
2. **The budget runs out in the middle of a pause.** The clock restarts with `endsAt` extended by exactly the stopped time, capped at the budget. `pauseUsedMs` ends at exactly `pauseBudgetMs`. The partner still sees the grace countdown, and the attempt ends `ended_early` when it expires. Test in Task 3 (service) and Task 4 (events).
3. **A disconnect races the final solve or the timeout.** The attempt ends once, with one status, and no `attempt:paused` follows `attempt:ended`. Test in Task 4.
4. **Exact ties.** Two teams equal on points, levels, time and `finishedAt` share a rank. A team that ended early with 0 points ranks below every team with points. REST and socket give the same order. Test in Task 6.
5. **The server restarts during a pause.** The grace deadline is still counted from the original `awaySince`, not reset by the restart, and an expired one ends the attempt at boot. Test in Task 5.

---

## Part A — Resilience

### Task 1: Atomic team-change writes and logged background failures

**Files:**
- Modify: `server/src/models/Attempt.js` (schema option), `server/src/services/teamService.js` (`syncEntries`, `addToEntries`), `server/src/services/lobbyService.js`, `server/src/sockets/flow.js` (the `.catch(() => {})` calls, `failStart`)
- Test: `server/tests/lobbyRace.test.js` (new)

**Interfaces:**
- Produces: `withVersionRetry(fn, tries = 3)` in `lobbyService.js`, which re-runs `fn` on `mongoose.Error.VersionError`. `claimRole`, `releaseRole`, `setReady`, `unready`, `startAttempt` and `resetCountdown` are wrapped in it. `logFailure(label)` in `flow.js` returns `(err) => console.error(...)` for queued background jobs.

- [ ] **Step 1: Write the failing tests**

```js
test('a partner pulled from the entry between load and save does not corrupt the lobby write', async () => {
  // attempt in lobby with alice (players[0]) and bob (players[1]); load it as lobbyService does,
  // then Attempt.updateMany via syncEntries pulls alice; then save bob's role change on the stale doc
  // through lobbyService.claimRole(attemptId, bob.id, 'B') with the pull injected between load and save
  const after = await Attempt.findById(attemptId);
  expect(after.players).toHaveLength(1);
  expect(after.players[0]).toMatchObject({ id: bob.id, role: 'B' });
});
test('a VersionError on every try surfaces after 3 attempts', async () => {
  const fn = jest.fn().mockRejectedValue(new mongoose.Error.VersionError({ _id: 1 }, 0, []));
  await expect(withVersionRetry(fn)).rejects.toBeInstanceOf(mongoose.Error.VersionError);
  expect(fn).toHaveBeenCalledTimes(3);
});
```

To inject the pull, `jest.spyOn(Attempt, 'findById')` resolves the real document and then runs `syncEntries` once.

- [ ] **Step 2: Run them.** `npm test -- lobbyRace` (from `server/`). Expected: FAIL (bob's role is written to the wrong player, or `withVersionRetry` is undefined).
- [ ] **Step 3: Implement.** Add `optimisticConcurrency: true` to `attemptSchema`'s options. Add `$inc: { __v: 1 }` to the three entry updates in `syncEntries` and to the `$push` and rollback `$pull` in `addToEntries`. Add `withVersionRetry` and wrap the lobby mutators, each reloading the attempt on every try. In `flow.js`, replace each `.catch(() => {})` with `.catch(logFailure('<what>'))`. Wrap `failStart`'s own DB calls in `try/catch` that logs, so a failed reset cannot reject the queue silently.
- [ ] **Step 4: Run all server tests.** `npm test`. Expected: all pass (483 + 2).
- [ ] **Step 5: Commit.** `git commit -m "fix: version-checked lobby writes against team changes; log background failures"`

### Task 2: Clock rules — active time, frozen remaining time, folding a pause

**Files:**
- Create: `server/src/services/clock.js`
- Modify: `server/src/models/levelFields.js` (`pausedMs`), `server/src/models/Attempt.js` (`players[].awaySince`), `server/src/services/gameService.js`, `server/src/services/attemptView.js` (`clueFor`, `toPlayerView.remainingMs`)
- Test: `server/tests/clock.test.js` (new), `server/tests/scoring.test.js`

**Interfaces:**
- Produces, all pure (no DB, `now` in ms):
  - `GRACE_MS = 60000`, `PAUSE_BUDGET_MS = 180000`
  - `activeMsOf(level, attempt, now) → number`: `now − unlockedAt − (level.pausedMs || 0) − (attempt.status === 'paused' ? now − pausedAt : 0)`, never below 0
  - `remainingMsOf(attempt, now) → number | null`: `endsAt − (paused ? pausedAt : now)`, never below 0; null before the start
  - `budgetLeftMs(attempt, now, budgetMs) → number`: `budgetMs − pauseUsedMs − (paused ? now − pausedAt : 0)`, never below 0
  - `foldPause(attempt, now, budgetMs) → { stoppedMs, endsAt: Date, levelIndex }`: `stoppedMs = min(now − pausedAt, budgetMs − pauseUsedMs)`; `levelIndex` is the first unsolved level (−1 if none)
  - `graceLeftMs(player, now, graceMs) → number | null`: null when the player is not away
- `levelFields.progressLevelFields.pausedMs: { type: Number, default: 0 }`; `playerSchema.awaySince: { type: Date, default: null }`.
- `endAttempt(attemptId, status, now, { pauseBudgetMs = PAUSE_BUDGET_MS } = {})`: a `paused` attempt is folded first (`endsAt`, `pauseUsedMs`, the level's `pausedMs`). `timeUsedMs` then follows D70. `endAttempt` now also accepts `paused` attempts.

- [ ] **Step 1: Write the failing tests**

```js
// clock.test.js — attempt started at 0, endsAt 900 000, level 1 unlocked at 0
test('active time excludes a finished pause and the current one', () => {
  const level = { unlockedAt: new Date(0), pausedMs: 30000 };
  expect(activeMsOf(level, { status: 'in_progress' }, 120000)).toBe(90000);
  expect(activeMsOf(level, { status: 'paused', pausedAt: new Date(100000) }, 120000)).toBe(70000);
});
test('remaining time is frozen while paused', () => {
  const a = { status: 'paused', pausedAt: new Date(100000), endsAt: new Date(900000), startedAt: new Date(0) };
  expect(remainingMsOf(a, 100000)).toBe(800000);
  expect(remainingMsOf(a, 150000)).toBe(800000);
});
test('folding a pause is capped at the remaining budget', () => {
  const a = { status: 'paused', pausedAt: new Date(100000), pauseUsedMs: 170000, endsAt: new Date(900000), levels: [{ solvedAt: null }] };
  expect(foldPause(a, 160000, 180000)).toEqual({ stoppedMs: 10000, endsAt: new Date(910000), levelIndex: 0 });
});
test('budget left never goes below 0', () => { /* pauseUsedMs 175 000, paused 20 s → 0 */ });
// scoring.test.js
test('§7.3 t excludes paused time: 180 s on the level with a 60 s pause scores as 120 s', async () => {
  // attempt in_progress, level 1 unlocked at T, levels.0.pausedMs = 60000; submitAnswer correct at T + 180 s
  expect(outcome.points).toBe(90); // 100 − ⌊(120 − 60) / 6⌋
});
test('endAttempt on a paused attempt folds the pause and excludes it from time used', async () => {
  // started 0, paused at 200 s with pauseUsedMs 0, ended_early at 260 s
  expect(ended.timeUsedMs).toBe(200000);
  expect(ended.pauseUsedMs).toBe(60000);
});
```

- [ ] **Step 2: Run them.** `npm test -- clock scoring`. Expected: FAIL (`clock.js` missing).
- [ ] **Step 3: Implement** `clock.js` and the two schema fields. In `gameService`, `submitAnswer` uses `activeMsOf` for `activeMs` and `revealHint` uses it for the 90 s check. `clueFor`'s `ready` uses `activeMsOf`, and `toPlayerView.remainingMs` uses `remainingMsOf`. Make `endAttempt` fold a paused attempt.
- [ ] **Step 4: Run all server tests.** `npm test`. Expected: all pass. Existing scores are unchanged, because with no pauses `pausedMs` is 0.
- [ ] **Step 5: Commit.** `git commit -m "feat: clock rules for paused time in points, hints and time used"`

### Task 3: Pause service

**Files:**
- Create: `server/src/services/pauseService.js`
- Test: `server/tests/pauseService.test.js` (new, DB only, no sockets)

**Interfaces:**
- Consumes: `clock.js` (Task 2).
- Produces. Each function is one or two atomic conditional `findOneAndUpdate` calls, and each returns null when nothing applied:
  - `markAway(attemptId, playerId, now, { budgetMs }) → { attempt, clockStopped } | null`: sets `players.$.awaySince` (filter `status ∈ {in_progress, paused}` and that player's `awaySince: null`). If the status is `in_progress` and `budgetLeftMs > 0`, it then sets `status: 'paused', pausedAt`.
  - `markBack(attemptId, playerId, now, { budgetMs }) → { attempt, resumed } | null`: clears `awaySince`. If the attempt is `paused` and no other player is away, it calls `resumeClock`.
  - `resumeClock(attemptId, now, { budgetMs }) → attempt | null`: applies `foldPause`. It sets `status: 'in_progress', pausedAt: null, endsAt` and `$inc`s `pauseUsedMs` and `levels.<i>.pausedMs`, filtered on `status: 'paused'` and the same `pausedAt`, so a fold happens once.
  - `awayPlayers(attempt) → [{ id, name, role, awaySince }]`.

- [ ] **Step 1: Write the failing tests**

```js
test('the first away player stops the clock; the second does not stop it again', async () => {
  const first = await markAway(id, 'A', t0, { budgetMs: 180000 });
  expect(first.clockStopped).toBe(true);
  expect(first.attempt.status).toBe('paused');
  const second = await markAway(id, 'B', t0 + 5000, { budgetMs: 180000 });
  expect(second.clockStopped).toBe(false);
  expect(second.attempt.pausedAt).toEqual(new Date(t0));
});
test('markBack resumes only when nobody else is away, extending endsAt by the stopped time', async () => {
  // A and B away from t0; B back at t0 + 10 s → still paused; A back at t0 + 20 s → in_progress
  expect(resumed.attempt.endsAt.getTime()).toBe(endsAt + 20000);
  expect(resumed.attempt.pauseUsedMs).toBe(20000);
  expect(resumed.attempt.levels[0].pausedMs).toBe(20000);
});
test('with no budget left, a disconnect marks the player away but keeps the clock running', async () => {
  // pauseUsedMs 180 000
  expect(r.clockStopped).toBe(false);
  expect(r.attempt.status).toBe('in_progress');
  expect(r.attempt.players[0].awaySince).toEqual(new Date(t0));
});
test('Review Focus 2: resumeClock after the budget runs out folds exactly the budget', async () => {
  // pauseUsedMs 170 000, paused at t0, resumeClock at t0 + 25 s
  expect(r.pauseUsedMs).toBe(180000);
  expect(r.endsAt.getTime()).toBe(endsAt + 10000);
});
test('two resumeClock calls for one pause fold it once', async () => { /* Promise.all → one non-null */ });
test('markAway on a finished attempt returns null', async () => { /* status finished */ });
```

- [ ] **Step 2: Run them.** `npm test -- pauseService`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `pauseService.js`.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat: pause service with grace bookkeeping and a capped budget"`

### Task 4: Disconnect, pause and resync over sockets

**Files:**
- Modify: `server/src/sockets/index.js` (defaults), `server/src/sockets/runtime.js` (clock state, grace timers), `server/src/sockets/flow.js` (ticking, pause/resume, hint schedule), `server/src/sockets/handlers.js` (`disconnect`, `attempt:join`, `level:submit`, `hint:reveal`), `server/src/services/gameService.js` (`ATTEMPT_PAUSED`), `server/src/services/attemptView.js` (`pause` in the snapshot)
- Modify: the tests that disconnect a player after the start (`socketGame.test.js` lines ~161 and ~189–190; check `socketJoin.test.js` ~112/125). Each now passes options that keep its old meaning, e.g. `pauseBudgetMs: 0` so the timer still runs out. Lobby-time disconnects in `socketLobby.test.js` are unaffected
- Test: `server/tests/socketPause.test.js` (new)

**Interfaces:**
- Consumes: `pauseService` (Task 3), `clock` (Task 2).
- Produces:
  - Defaults: `graceMs: GRACE_MS`, `pauseBudgetMs: PAUSE_BUDGET_MS`.
  - `runtime.clock = { endsAt: ms, pausedAt: ms | null }` and `runtime.graceTimers: Map<playerId, timer>`, plus `runtime.budgetTimer`.
  - `flow.startTicking(runtime)`: no `endsAt` argument; it reads `runtime.clock`. Each tick emits `attempt:tick { remainingMs, paused, away: [{ id, graceMs }] }` (D81). Warnings fire only while not paused.
  - `flow.playerAway(runtime, player)` and `flow.playerBack(runtime, player)`, run inside the queue.
  - Events: `attempt:paused { who: { id, name, role }, graceMs, clockStopped }`; `attempt:resumed { who: { id, name, role } | null, reason: 'RETURNED' | 'PAUSE_BUDGET_USED', remainingMs, endsAt }`.
  - System messages (CHAT-2): `"<Role> lost connection. Waiting 60 seconds for them to return."`, with `" The pause budget is used up, so the clock keeps running."` added when `clockStopped` is false; `"<Role> is back. Play resumed."`; `"The pause budget is used up. The clock is running again."`; `"<Role> did not return within 60 seconds."` before `Attempt ended`. `<Role>` is the theme's role name, else the player's name. Seconds come from `graceMs`.
  - Snapshot field `pause: { clockStopped, away: [{ id, name, role, graceMs }], budgetLeftMs }`. `toPlayerView` takes `graceMs` and `pauseBudgetMs` in its options.
  - `submitAnswer` and `revealHint` throw 409 `ATTEMPT_PAUSED` when the status is `paused` (D69).

- [ ] **Step 1: Write the failing tests** (`startedRoom({ graceMs: 400, pauseBudgetMs: 2000 })` unless stated)

```js
test('TIME-3: a disconnect pauses, the partner gets attempt:paused and frozen ticks', async () => {
  const paused = nextEvent(a, 'attempt:paused');
  b.disconnect();
  expect(await paused).toMatchObject({ who: { id: bob.user.id, role: 'B' }, graceMs: 400, clockStopped: true });
  const ticks = await collect(a, 'attempt:tick', 350);
  expect(new Set(ticks.map((t) => t.remainingMs)).size).toBe(1);
  expect(ticks[0]).toMatchObject({ paused: true, away: [{ id: bob.user.id }] });
});
test('TIME-4/TIME-6: reconnecting within the grace resumes and restores the full state', async () => {
  // b submits a wrong answer and a chat line first; then b.disconnect(); a new socket b2 for bob joins by code
  expect(resumed).toMatchObject({ who: { id: bob.user.id }, reason: 'RETURNED' });
  expect(snap.clue).toEqual(snapB.clue);
  expect(snap.chat.map((m) => m.text)).toEqual(expect.arrayContaining(['hello']));
  expect(snap.levels[0].wrongCount).toBe(1);
  expect(snap.pause).toEqual({ clockStopped: false, away: [], budgetLeftMs: expect.any(Number) });
  expect(Date.now() - reconnectStartedAt).toBeLessThan(2000); // NFR-8
  expect(new Date(resumed.endsAt).getTime()).toBeGreaterThan(new Date(snapB.endsAt).getTime());
});
test('TIME-5: no return within the grace ends the attempt early, points kept', async () => {
  // a solves level 1, then b.disconnect()
  const ended = await nextEvent(a, 'attempt:ended', 3000);
  expect(ended.status).toBe('ended_early');
  expect(ended.result.levels[0].solved).toBe(true);
});
test('both players gone for the grace ends the attempt with nobody connected', async () => { /* status ended_early, runtimes.size() 0 */ });
test('D69: submit and hint while paused get ATTEMPT_PAUSED at no cost', async () => {
  expect((await submit(a, 1, 'WRONG')).error).toBe('ATTEMPT_PAUSED');
  expect((await Attempt.findById(attemptId)).levels[0].wrongCount).toBe(0);
});
test('Review Focus 1: closing one of two tabs does not pause', async () => {
  // bob opens b2 and joins; b.disconnect(); collect a's attempt:paused for 300 ms → []
});
test('Review Focus 2: the budget runs out mid-pause; the clock restarts, the grace still ends it', async () => {
  // startedRoom({ graceMs: 800, pauseBudgetMs: 300 }); b.disconnect()
  expect(await nextEvent(a, 'attempt:resumed')).toMatchObject({ who: null, reason: 'PAUSE_BUDGET_USED' });
  expect((await nextEvent(a, 'attempt:ended', 2000)).status).toBe('ended_early');
  expect((await Attempt.findById(attemptId)).pauseUsedMs).toBe(300);
});
test('with the budget used up, a disconnect reports clockStopped: false and ticks keep counting', async () => { /* pauseBudgetMs: 0 */ });
test('Review Focus 3: a disconnect racing the final solve ends the attempt once, as finished', async () => {
  // play to level 5; send a's final submit and b.disconnect() in the same tick
  // collect a's events for 600 ms: exactly one attempt:ended (finished) and no attempt:paused after it
});
test('§7.5: the hint delay excludes paused time', async () => {
  // startedRoom({ hintDelayMs: 300, graceMs: 2000 }); disconnect b at ~100 ms, rejoin at ~500 ms
  // hint:available arrives no earlier than 300 ms of active time (≥ ~700 ms wall time after the start)
});
```

- [ ] **Step 2: Run them.** `npm test -- socketPause`. Expected: FAIL (no `attempt:paused`).
- [ ] **Step 3: Implement.** In `handlers.js`: on the last socket of a player in `in_progress`/`paused` → `flow.playerAway`. On `attempt:join` by an away player → `flow.playerBack` before the snapshot. `playerAway` clears the hint timer when the clock stops, arms the grace timer (`graceMs` from now), arms the budget timer at `budgetLeftMs` while paused, emits, and posts the message. The grace timer re-reads the attempt inside the queue and ends it only if that player is still away and `graceLeftMs ≤ 0`. `playerBack` clears that player's grace timer. On resume it updates `runtime.clock`, clears the budget timer and calls `scheduleHint`, whose wait becomes `hintDelayMs − activeMsOf(...)`. `finish` clears every grace and budget timer. Update the listed existing tests.
- [ ] **Step 4: Run all server tests.** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit.** `git commit -m "feat: pause on disconnect with a 60 s grace, pause budget and full resync"`

### Task 5: Boot-time recovery of live attempts

**Files:**
- Create: `server/src/sockets/recovery.js`
- Modify: `server/src/server.js` (call it after `listen`), `server/src/sockets/flow.js` (`resume` delegates to `recoverOne`), `server/src/sockets/handlers.js` (lazy path unchanged in shape)
- Test: `server/tests/recovery.test.js` (new)

**Interfaces:**
- Consumes: Tasks 3–4.
- Produces: `recoverAttempts(io, now = Date.now()) → { lobby, resumed, ended }` and `recoverOne(runtime, attempt, now)` (D71). `recoverOne` sets `runtime.resumed = true` and `runtime.challengeId`. It ends the attempt (`timed_out` or `ended_early`), or marks the not-yet-away players away and arms ticking plus a grace timer per away player (from each one's own `awaySince`) and the budget timer. `server.js` logs `Recovered N live attempts`.

- [ ] **Step 1: Write the failing tests.** Each test writes the attempt state into the DB, starts a fresh `startSocketServer`, and calls `recoverAttempts(srv.io, now)`.

```js
test('Q5: a countdown goes back to the lobby with everyone unready', async () => { /* status lobby, ready false */ });
test('an in_progress attempt whose time ran out ends timed_out at boot', async () => {});
test('an in_progress attempt is paused at boot and resumes when both players rejoin', async () => {
  expect(r.resumed).toBe(1);
  expect((await Attempt.findById(id)).status).toBe('paused');
  // both players join by code → attempt:resumed, status in_progress
});
test('Review Focus 5: a grace that started before the restart is not reset', async () => {
  // players[1].awaySince = now − 59 500 with graceMs 60 000; recover; ended_early within ~1 s
});
test('a grace that already passed ends the attempt at boot, keeping its points', async () => { /* ended_early, totalPoints kept */ });
```

- [ ] **Step 2: Run them.** `npm test -- recovery`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `recovery.js`, wire `server.js`, and make `flow.resume` call `recoverOne`.
- [ ] **Step 4: Run all server tests.** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit.** `git commit -m "feat: rebuild live attempt runtimes at boot"`

## Part B — Competition

### Task 6: Ranking, leaderboard query and REST

**Files:**
- Modify: `server/src/services/scoring.js` (`rankCompare`, D41), `server/src/models/Attempt.js` (index `{ challengeId: 1, status: 1 }`), `server/src/routes/challengeRoutes.js`, `server/src/controllers/challengeController.js`
- Create: `server/src/services/leaderboardService.js`
- Test: `server/tests/leaderboard.test.js` (new), `server/tests/scoring.test.js`, `server/tests/helpers/leaks.js` (add `expectNoAnswers(payload, levels)`)

**Interfaces:**
- Produces:
  - `rankCompare(a, b)` over `{ totalPoints, levelsCleared, timeUsedMs, finishedAt }`: negative when `a` ranks first, 0 on an exact tie.
  - `leaderboardFor(challengeId, now) → Board`, one `$match` → `$lookup` (teams) → `$facet` aggregation (Lab 8): `Board = { challengeId, status, provisional, ranked: [{ rank, teamId, teamName, points, levelsCleared, timeUsedMs, stars, status, finishedAt }], playing: [{ teamId, teamName, levelReached, paused }], waiting: [{ teamId, teamName, didNotStart }] }` (D72). `levelReached = levelsCleared + 1`, capped at 5.
  - `rankOf(attempt) → { position, outOf, provisional } | null`, which is null for practice or a non-final attempt (D74). `provisional` needs the challenge status, so `rankOf` loads the challenge and calls `statusOf`.
  - `GET /api/challenges/:id/leaderboard` → `Board` (404 `CHALLENGE_NOT_FOUND`; `requirePlayer`).

- [ ] **Step 1: Write the failing tests**

```js
test('rankCompare follows §7.3: points, then levels, then less time, then earlier finish', () => {
  const base = { totalPoints: 300, levelsCleared: 5, timeUsedMs: 600000, finishedAt: new Date(1000) };
  expect(rankCompare({ ...base, totalPoints: 301 }, base)).toBeLessThan(0);
  expect(rankCompare({ ...base, levelsCleared: 4, totalPoints: 300 }, base)).toBeGreaterThan(0);
  expect(rankCompare({ ...base, timeUsedMs: 500000 }, base)).toBeLessThan(0);
  expect(rankCompare({ ...base, finishedAt: new Date(900) }, base)).toBeLessThan(0);
  expect(rankCompare(base, { ...base })).toBe(0);
});
test('the leaderboard ranks final attempts, lists playing and waiting teams, and is provisional while open', async () => {
  // insert attempts for 6 teams: 3 final (different points), 1 in_progress with levelsCleared 2, 1 paused, 1 entered
  expect(board.ranked.map((r) => r.teamName)).toEqual(['High', 'Mid', 'Low']);
  expect(board.playing).toEqual(expect.arrayContaining([expect.objectContaining({ teamName: 'Busy', levelReached: 3, paused: false })]));
  expect(board.waiting).toEqual([expect.objectContaining({ teamName: 'Idle', didNotStart: false })]);
  expect(board.provisional).toBe(true);
});
test('Review Focus 4: exact ties share a rank; 0 points ranks last', async () => {
  expect(board.ranked.map((r) => r.rank)).toEqual([1, 1, 3]);
  expect(rankOf(tieB)).resolves.toEqual({ position: 1, outOf: 3, provisional: true });
});
test('after the window and every attempt end, waiting teams did not start and the board is final', async () => {});
test('the payload carries only leaderboard fields (NFR-1, NFR-4)', async () => {
  expect(Object.keys(board.ranked[0]).sort()).toEqual(['finishedAt', 'levelsCleared', 'points', 'rank', 'stars', 'status', 'teamId', 'teamName', 'timeUsedMs']);
  expectNoAnswers(board, challenge.levels); // new in tests/helpers/leaks.js: no answer, acceptedAnswers entry or explanation in the JSON
});
test('NFR-11: a 100-team leaderboard loads in under 1 second', async () => {
  // insertMany 100 teams and 100 final attempts; time GET /api/challenges/:id/leaderboard
  expect(elapsed).toBeLessThan(1000);
});
test('GET /leaderboard refuses guests and unknown ids', async () => { /* 403 GUEST_NOT_ALLOWED, 404 CHALLENGE_NOT_FOUND */ });
```

- [ ] **Step 2: Run them.** `npm test -- leaderboard scoring`. Expected: FAIL.
- [ ] **Step 3: Implement.** The aggregation sorts `ranked` with `{ totalPoints: -1, levelsCleared: -1, timeUsedMs: 1, finishedAt: 1, _id: 1 }`, and ranks are assigned in one pass using `rankCompare` (equal → same rank). `rankOf` counts with `$or` of the four "strictly ahead" conditions.
- [ ] **Step 4: Run them.** Expected: PASS. Then `npm test`: all pass.
- [ ] **Step 5: Commit.** `git commit -m "feat: challenge leaderboard query, rankCompare and rankOf"`

### Task 7: Live leaderboard and rank on results

**Files:**
- Create: `server/src/sockets/leaderboard.js`
- Modify: `server/src/sockets/index.js` (hub + `leaderboardDelayMs` default), `server/src/sockets/runtime.js` (`runtime.leaderboards`, `runtime.challengeId`), `server/src/sockets/flow.js` and `handlers.js` (notify after start, solve, finish, pause, resume; rank in `attempt:ended` and snapshots), `server/src/services/attemptView.js` (`resultView(attempt, { rank })`)
- Test: `server/tests/socketLeaderboard.test.js` (new), `server/tests/helpers/sockets.js` (add `waitFor(socket, event, predicate, ms = 3000)`, which resolves with the first payload that matches)

**Interfaces:**
- Consumes: `leaderboardFor`, `rankOf` (Task 6).
- Produces: `createLeaderboardHub(io, { delayMs }) → { watch(socket, challengeId) → Board, changed(challengeId) }`. `changed` coalesces calls per challenge into one recompute after `delayMs`. Socket event `leaderboard:watch { challengeId }` (players only; 404 `CHALLENGE_NOT_FOUND`) acks `{ ok: true, board }`. A socket watches at most one challenge, so a new watch leaves the old room. `resultView(attempt, { rank })` adds `rank: { position, outOf, provisional } | null`. `flow.sendSnapshot` and `flow.finish` compute it with `rankOf`.

- [ ] **Step 1: Write the failing tests** (`startSocketServer({ leaderboardDelayMs: 50, ... })`)

```js
test('Gate: 3 teams finish one challenge and the live board ranks them by §7.3', async () => {
  // watcher (a 4th player) watches; teams play the same challenge: one with 0 wrong, one with 2 wrong, one quits after level 3
  const final = await waitFor(watcher, 'leaderboard:update', (b) => b.ranked.length === 3);
  expect(final.ranked.map((r) => r.teamName)).toEqual([clean, twoWrong, quitter]);
  const sorted = [...attempts].sort(rankCompare);
  expect(final.ranked.map((r) => r.points)).toEqual(sorted.map((x) => x.totalPoints));
});
test('SCORE-4: a team that starts or solves appears in playing with its level', async () => {});
test('updates are coalesced: 3 quick changes give 1 leaderboard:update', async () => {});
test('NFR-4: the leaderboard room never gets chat, clue or game events', async () => {
  // watcher collects every event (socket.onAny) during another team's full game
  expect(new Set(seen)).toEqual(new Set(['leaderboard:update']));
});
test('SCORE-2: attempt:ended carries the current rank, and a later snapshot recomputes it', async () => {
  expect(ended.result.rank).toEqual({ position: 1, outOf: 1, provisional: true });
});
test('practice results have rank null', async () => {});
test('leaderboard:watch refuses guests and unknown challenges', async () => {});
```

- [ ] **Step 2: Run them.** `npm test -- socketLeaderboard`. Expected: FAIL.
- [ ] **Step 3: Implement** the hub, the `changed` calls, and rank in the results.
- [ ] **Step 4: Run all server tests.** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit.** `git commit -m "feat: live challenge leaderboard and rank on results"`

### Task 8: Creator's team view, solutions after closing, attempt result REST

**Files:**
- Modify: `server/src/services/challengeService.js` (`teamStatuses`, `solutions`), `server/src/services/challengeView.js` (`solutionsView`, `canSeeTeams` in `challengeView`), `server/src/routes/challengeRoutes.js`, `server/src/controllers/challengeController.js`, `server/src/routes/index.js`
- Create: `server/src/services/resultService.js`, `server/src/controllers/attemptController.js`, `server/src/routes/attemptRoutes.js`
- Test: `server/tests/challengeResults.test.js` (new)

**Interfaces:**
- Produces:
  - `GET /api/challenges/:id/teams` → `{ teams: [{ teamId, teamName, members: [username], status, levelReached, points }] }`. `status` ∈ `not_started | did_not_start | in_progress | paused | finished | timed_out | ended_early`. Creator, organizer or admin; others get 403 `NOT_CREATOR` (D75).
  - `GET /api/challenges/:id/solutions` → `{ levels: [{ order, title, answer, explanation }] }`, or 409 `NOT_CLOSED` (D76).
  - `challengeView` gains `canSeeTeams: boolean`.
  - `GET /api/attempts/:id/result` (`requireAuth`) → `{ attemptId, challenge: { id, code, name } | null, theme: { name, roles }, result, chat }`. Errors: 404 `ATTEMPT_NOT_FOUND`, 403 `NOT_IN_ATTEMPT`, 409 `NOT_FINISHED` (D80).

- [ ] **Step 1: Write the failing tests**

```js
test('SCORE-5: the creator sees every team status; an organizer too; a plain player gets 403', async () => {});
test('Q3: a creator who also plays may open the team view', async () => {});
test('CHAL-10: solutions are 409 NOT_CLOSED while open and while an attempt is still running after endsAt', async () => {});
test('CHAL-10: once closed, solutions list every level answer and explanation', async () => {
  expect(res.body.levels).toHaveLength(5);
  expect(res.body.levels[0]).toEqual({ order: 1, title: expect.any(String), answer: levels[0].answer, explanation: levels[0].explanation });
});
test('GET /attempts/:id/result: members get result, rank and chat; others 403; a running attempt 409', async () => {});
test('a practice guest can read their own practice result', async () => {});
```

- [ ] **Step 2: Run them.** `npm test -- challengeResults`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run all server tests.** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit.** `git commit -m "feat: creator team view, solutions after closing and attempt results"`

### Task 9: Profiles and history

**Files:**
- Create: `server/src/services/historyService.js`, `server/src/services/profileService.js`, `server/src/controllers/userController.js`, `server/src/routes/userRoutes.js`
- Modify: `server/src/routes/index.js` (`/users`), `server/src/routes/teamRoutes.js` + `controllers/teamController.js` (`GET /:id/history`), `server/src/services/teamService.js` (`listMine` adds `record`)
- Test: `server/tests/history.test.js` (new)

**Interfaces:**
- Produces:
  - `history(filter, page) → { items, page, pageSize: 10, total, pages }`, where `filter` is `{ memberId }` or `{ teamId }`. Only final challenge attempts, newest `finishedAt` first. Each item is `{ attemptId, challenge: { code, name }, theme: { name }, team: { id, name }, points, levelsCleared, stars, status, rank, finishedAt }`, with `rank` from `rankOf`.
  - `GET /api/users/me` → `{ id, username, avatarColor, joinedAt, teams: [{ id, name, archived }], challengesPlayed, totalPoints, bestRank }` (AUTH-6). `bestRank` is the lowest `position` or null.
  - `GET /api/users/me/history?page=` and `GET /api/teams/:id/history?page=` (the team route is open to any player, D12). A `page` that is not an integer ≥ 1 gets 400 `VALIDATION_ERROR`.
  - `listMine` items gain `record: { played, totalPoints }` (TEAM-3).

- [ ] **Step 1: Write the failing tests**

```js
test('SCORE-7: history is 10 per page, newest first, final challenge attempts only', async () => {
  // 12 final attempts for alice across 12 challenges + 1 practice + 1 in_progress
  expect(p1.body).toMatchObject({ page: 1, pageSize: 10, total: 12, pages: 2 });
  expect(p1.body.items[0].finishedAt > p1.body.items[1].finishedAt).toBe(true);
  expect(p2.body.items).toHaveLength(2);
});
test('a page past the end is empty; page=0 or page=x is 400', async () => {});
test('AUTH-6: the profile shows teams, challenges played, total points and best rank', async () => {});
test('TEAM-6: team history lists that team only, and survives the team being archived', async () => {});
test('TEAM-3: my teams carry a record of played and total points', async () => {});
test('guests get 403 on /users/me', async () => {});
```

- [ ] **Step 2: Run them.** `npm test -- history`. Expected: FAIL.
- [ ] **Step 3: Implement.** `history` is one aggregation (`$match` with `$in` on `status` → `$sort` → `$facet { items: [$skip, $limit, $lookup challenges, $lookup teams], total: [$count] }`), followed by `rankOf` per item. Profile totals come from one `$group`.
- [ ] **Step 4: Run all server tests.** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit.** `git commit -m "feat: player profile, history and team records"`

## Part C — Client

There is no client test runner. Each client task ends with `npm --prefix client run lint`, `npm --prefix client run build` (JS < 300 KB gzip, NFR-12) and a headless-browser walk-through, as in earlier phases, recorded in `CONTEXT.md`, not committed.

### Task 10: Pause banner, resync and rank on results

**Files:**
- Modify: `client/src/hooks/useAttempt.js` (`attempt:paused`, `attempt:resumed`), `client/src/game/attemptReducer.js` (`paused`, `resumed`, `tick` with `away`/`paused`), `client/src/components/game/GameScreen.jsx`, `AnswerBox.jsx`, `HintPanel.jsx`, `TimerDisplay.jsx`, `Results.jsx`, `AttemptScreen.jsx`, `gameShapes.js`, `client/src/pages/ChallengePlay.jsx`, `client/src/styles/game.css`
- Create: `client/src/components/game/PauseBanner.jsx`

**Interfaces:**
- Consumes: the events and the snapshot `pause` field from Task 4, and `result.rank` from Task 7.
- Produces: `state.pause = { clockStopped, away: [{ id, name, role, graceMs }], budgetLeftMs }`, kept up to date by `paused`/`resumed`/`tick`. `<PauseBanner pause roles />` renders `role="status"` text: "Waiting for Navigator to reconnect — 0:42", plus "Clock paused" or "Pause budget used up — the clock is running". `Results` takes `{ result, theme, chat, actions }` (no `state`) and shows "Rank 2 of 5 (provisional)" when `result.rank` is set. `AttemptScreen` takes a `resultActions` node: practice → "New practice room", challenge → "Back to the challenge".
- [ ] **Step 1:** Add the reducer cases and the hook events. Disable `AnswerBox` and `HintPanel` with the note "Paused while your teammate reconnects" while `pause.clockStopped`. `TimerDisplay` shows "Paused" beside the frozen time.
- [ ] **Step 2:** Add `PauseBanner` and the `Results` refactor, with rank and actions.
- [ ] **Step 3: Verify.** Lint and build pass. In a two-session browser walk-through at 360 px: close B's tab, and A shows the banner counting down from 0:60 by server ticks, with answers disabled. Reopen B within the grace: both resume, and B's clue, board, chat, score and timer match before the close (within 2 s). A challenge result shows its rank.
- [ ] **Step 4: Commit.** `git commit -m "feat(client): pause banner, resync and rank on results"`

### Task 11: Challenge page — live leaderboard, team view, solutions

**Files:**
- Create: `client/src/hooks/useLeaderboard.js`, `client/src/components/Leaderboard.jsx`, `client/src/components/TeamStatusTable.jsx`, `client/src/components/Solutions.jsx`
- Modify: `client/src/api/challenges.js` (`getLeaderboard`, `getChallengeTeams`, `getSolutions`), `client/src/pages/ChallengePage.jsx`, `client/src/styles/base.css`

**Interfaces:**
- Consumes: Tasks 6–8.
- Produces: `useLeaderboard(challengeId) → { board, live, error, reload }`. It opens its own socket and sends `leaderboard:watch`. It takes the ack's board, then each `leaderboard:update`. If the socket fails, it falls back to `getLeaderboard` with a Retry button (UI-4). `<Leaderboard board />` is a table (rank, team, points, levels, time used, stars as text) with a "Provisional" badge, a "Playing now" list (team · level N · paused) and a waiting / "Did not start" list. `TeamStatusTable` appears when `challenge.canSeeTeams`; it refetches when the board changes. `Solutions` appears when `challenge.status === 'closed'`. When the challenge countdown passes `endsAt`, the page reloads the challenge.
- [ ] **Step 1:** Add the API functions and the hook.
- [ ] **Step 2:** Add the components and wire them into `ChallengeDetails`.
- [ ] **Step 3: Verify.** Lint and build pass. In the browser: a watcher's table changes within about 1 s when another team solves a level. At 360 px the table scrolls inside its container with no page scroll. The creator sees team statuses, and a non-creator does not. After closing, the solutions show.
- [ ] **Step 4: Commit.** `git commit -m "feat(client): live leaderboard, creator team view and solutions"`

### Task 12: Profile, history and result pages

**Files:**
- Create: `client/src/api/users.js`, `client/src/pages/Profile.jsx`, `client/src/pages/AttemptResult.jsx`, `client/src/components/HistoryList.jsx`
- Modify: `client/src/api/teams.js` (`teamHistory`), `client/src/api/attempts.js` (new: `getResult`), `client/src/pages/TeamPage.jsx`, `client/src/pages/MyTeams.jsx` (record), `client/src/components/Layout.jsx` (Profile link for players), `client/src/App.jsx` (`/profile`, `/results/:attemptId`)

**Interfaces:**
- Consumes: Tasks 8–9.
- Produces: `<HistoryList load={(page) => Promise} />`, which reads and writes `?page=` with `useSearchParams` (Unit V query strings). Its rows show challenge (link to `/challenge/:code`), theme, team, points, rank, stars and local date, plus a "Results" link to `/results/:attemptId`. It has Previous/Next buttons and loading, empty and error states. `AttemptResult` renders `Results` from `getResult`.
- [ ] **Step 1:** Add the API modules, `HistoryList` and `Profile` (stats plus history).
- [ ] **Step 2:** Add the team page history section, the My Teams record, the nav link, the routes and `AttemptResult`.
- [ ] **Step 3: Verify.** Lint and build pass. In the browser: `/profile?page=2` works, as do Back/Forward between pages and the results link. A guest who opens `/profile` is sent away by `ProtectedRoute`.
- [ ] **Step 4: Commit.** `git commit -m "feat(client): profile, history and result pages"`

### Task 13: Docs, deploy and the Phase 4 gate

**Files:**
- Modify: `README.md` (status, REST rows for leaderboard/teams/solutions/result/users/history, socket events `leaderboard:*`, `attempt:paused/resumed`, the tick payload, the recovery note, a CO1 trace for the leaderboard), `DECISIONS.md` (D67–D81; Q3 and Q5 resolved; Q7's "must settle by" moved to Phase 5), `docs/superpowers/plans/2026-11-09-00-roadmap.md` (Phase 4 row), `CONTEXT.md`

- [ ] **Step 1:** Write the docs.
- [ ] **Step 2: Verify.** `npm test` passes in full; client lint is clean; build size recorded.
- [ ] **Step 3: Commit.** `git commit -m "docs: phase 4 README, decisions and gate log"`
- [ ] **Step 4: Gate (needs the user).** Push, let Render and Vercel redeploy, then on the hosted URL: (a) 3 teams on different networks finish one challenge, and the leaderboard ranks them by §7.3 on every viewer's screen; (b) a refresh mid-attempt restores clue, board, chat, score and timer within 2 s; (c) closing one tab for more than 60 s ends the attempt early with points kept. The Phase 2 and 3 hosted gates can run in the same session. Record the results in `CONTEXT.md`.
