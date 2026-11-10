# CONTEXT — DuoSync progress log

The single source of truth for project progress. **Read this before starting any job. Append a log entry after finishing one.**

## Current state

- **Phase:** 1 Foundation complete. 2 Core attempt merged into `main`; hosted gate pending. 3 Challenges + level engine merged into `main` (2026-11-10, after a whole-branch review and one fix wave); not pushed, not deployed, hosted gate pending.
- **Next (needs the user):** (1) push `main` so Render and Vercel redeploy; (2) set `SEED_ADMIN_*` on Render and run `npm run seed` once from the Render shell (or rely on `ensureSeeded`, which seeds themes but no admin); check `GET /api/themes` returns 8; (3) run the Phase 2 gate (two devices finish Cyber Heist at `/practice`) and the Phase 3 gate: two teams on two networks play the same challenge and their clue halves match level by level, and a second challenge of the same theme shows different values; record both results here.
- **Hosted URLs:** API `https://duosync-api.onrender.com` (Render, free tier; sleeps when idle). Client `https://duo-sync-lovat.vercel.app` (Vercel, root `client`). Repo: `https://github.com/pavannaik2004/DuoSync`
- **Open blockers:** none for the code. The Phase 2 and Phase 3 hosted gates need the user's deploy.
- **Run locally:** `npm --prefix server run dev:memory` + `npm run dev:client` (no database needed)
- **Tests:** `npm test` → 483 backend tests (REST, scoring, views, generators, challenges, Socket.io games, theme content). Client lint clean; build 116.5 KB gzip JS.
- **Deferred minors** (none blocks the gate; grouped from the Phase 3 task and final reviews):
  - *Races and atomicity (low odds):* team changes (`teamService.syncEntries`) write to attempts outside the per-attempt queue, so a captain leaving during a partner's lobby save could in theory corrupt a positional `players.<i>` write (not reproduced; parked for Phase 4: route these writes through the runtime queue or make lobby writes atomic by `players.id`); `ensureSeeded` check-then-insert can double-insert if two instances boot together and does not repair a partial seed; the TEAM-7 check and the `maxTeams` check are not atomic with their writes (D61); `addToEntries` re-check and `syncEntries` are separate reads/writes; `failStart` has no guard around its own DB calls.
  - *Silent failures:* a `.catch(() => {})` remains after a successful `startAttempt` (system message, snapshots, ticking); after a restart the quiet `scheduleHint` never emits `hint:available` if the delay already passed (the snapshot still shows ready).
  - *Generator guards:* `pick([])`, `int(min>max)`, `distinctInts` on a too-small range and the ordering 50-try loop have no guards; `pickAnswer`'s avoid-substring can over-filter a pool; weapon register uniqueness checks only the chosen mark; time helpers duplicated in `arithmetic.js` and `ruleFilter.js`; `levelSet` reads `error.message` without checking for non-Errors.
  - *Validation:* `attemptId` longer than 64 characters says VALIDATION_ERROR, not ATTEMPT_NOT_FOUND; a team in the lobby when a window closes still sits through the countdown before being refused; `seed.js` hardcodes bcrypt cost and `seedAdmin` is untested; `seedThemes` overwrite never removes extra templates (Phase 5).
  - *Test gaps:* several tests are weak or fragile (fixed `wait(700)`, vacuous `leaks` on empty payloads, no proof of the retry-key advance, no CHAL-7 ticking-after-window test, TEAM-7 in countdown/paused untested, validator rejection cases only check non-empty errors).
  - *Client polish:* `GridClue` keys collide on duplicate labels; grid cells with mark and label announce only the mark, empty cells are `role=img`, `.grid-label` is 11 px below 480 px; `PracticeHome` has no retry when `listThemes` fails; `ChallengePlay` effect re-runs every second and `ChallengePage` runs two 1 s intervals; max-teams validator duplicated; delete button shown when teams have entered; Dashboard "Open a challenge" tile is a div; a join-ack error can replace the "Reconnecting…" text.

## Key documents

| File | Purpose |
| --- | --- |
| `PRD Collaborative Digital Escape Room.md` | The spec |
| `docs/superpowers/plans/2026-11-09-00-roadmap.md` | Phase list and cross-phase architecture |
| `docs/superpowers/plans/2026-11-09-01-foundation.md` | Phase 1 task plan |
| `docs/superpowers/plans/2026-11-10-03-challenges-engine.md` | Phase 3 task plan (13 tasks) |
| `docs/themed-puzzle-sets.md` | The 8 themes: stories, roles, styles, level designs, pools, fallback values |
| `DECISIONS.md` | Decisions made where the PRD was silent, and decisions deferred |
| `README.md` | Setup, tests, deploy, MVC map |

## Phase checklist

- [x] 1 Foundation: gate passed 2026-11-09 (two accounts formed a team on the hosted site)
- [ ] 2 Core attempt (EL Phase I): code done, hosted gate pending
- [ ] 3 Challenges + level engine (EL Phase I scope): code done, hosted gate pending
- [ ] 4 Competition + resilience (EL Phase II)
- [ ] 5 Admin + organizers
- [ ] 6 Polish + hardening

## Log

Newest entry last. Format: `### YYYY-MM-DD — <title>`, then what was done, the files touched, and the test or verify result.

### 2026-11-09 — Planning

- Read the PRD. Wrote the roadmap (6 phases, cross-phase architecture) and the detailed Phase 1 plan (10 tasks).
- Created `CONTEXT.md` and `DECISIONS.md`.
- No code yet. The repo was not git-initialized; that happened at the start of Phase 1.

### 2026-11-09 — Phase 1 Foundation built (Tasks 1–9; Task 10 docs)

- Git: `main` holds the planning docs (b4cccf6); all work is on branch `phase-1-foundation`.
- **T1** Server skeleton: `createApp()`, central error handler (`{ error, message }`), `/api/health`, Jest harness with mongodb-memory-server.
- **T2** Signup and login: User model (case-insensitive unique username, lowercased email), bcrypt cost 10, JWT 7d, express-validator rejecting non-strings (NoSQL injection), 10/min auth rate limit.
- **T3** Guest tokens (24h), `requireAuth` / `requirePlayer` / `requireRole` (roles read from the DB on each request), `GET /api/auth/me`.
- **T4** Team model with 8-character invite codes (uppercasing setter), create, my teams, view (invite code visible to members only), 404 for malformed ids.
- **T5** Join by code as one atomic update (two players racing for the last seat → exactly one wins), rename, new invite code.
- **T6** Remove partner, leave, captain hand-over, archive when the last member leaves.
- **T7** Client shell: Vite + React Router, AuthContext, API wrapper, ProtectedRoute with `?next=`, landing page with the split-wordmark design, 404.
- **T8** Login, signup and guest pages with regex validation (identical to the server's patterns) and `safeNext` (blocks open redirects).
- **T9** My Teams, team page (invite link with copy, captain tools, leave), join page.
- **T10** README (setup, tests, deploy, MVC trace), `render.yaml`, `client/vercel.json`. **Deployment not done**: it needs the user's accounts.
- Verify: `npm test` → 61/61 pass. Client lint clean, build 89.6 KB gzip JS. A headless-Edge walk-through of the real UI passed 21/21 checks, including 360 px with no horizontal scroll and the invite link from a logged-out browser.
- Problems fixed along the way: mongodb driver 7.8 inside Jest (D21); Mongoose 9 deprecation of `{ new: true }` (now `returnDocument: 'after'`); the landing hero overlapping its tagline.
- Decisions D21–D27 and question Q7 added to DECISIONS.md.

### 2026-11-09 — Phase 1 final review and fixes

- An independent review of the whole branch found 0 Critical and 3 Important issues, plus 6 Minor ones (one upgraded to Important).
- Fixed, each reproduced first and then verified: (1) a crafted `?next=` with a tab or newline blanked the page → stricter `safeNext` + `ErrorBoundary`; (2) the `dev:memory` script was missing from `server/package.json`; (3) a 200 HTML reply (wrong `VITE_API_URL`) left an endless spinner → `BAD_RESPONSE` error; (4) CORS now accepts an origin list and ignores trailing slashes.
- Verify: `npm test` 64/64; client lint clean; browser walk-through 21/21.
- Five minors deferred; they are listed under Current state. Decisions D28–D30 added.

### 2026-11-09 — Phase 1 merged into main

- At the user's request, `phase-1-foundation` was merged into `main` locally (fast-forward to 27b0713), and the branch was deleted. No remote is configured yet.
- Verify on the merged `main`: `npm test` → 64/64 pass.

### 2026-11-09 — Deployed; Phase 1 gate passed

- The user pushed to GitHub (`pavannaik2004/DuoSync`) and deployed: MongoDB Atlas, the API on Render (`https://duosync-api.onrender.com`) and the client on Vercel.
- Checked: `/api/health` → 200 `{"status":"ok"}`; an unknown `/api/*` path → 404 JSON. The bare root shows Express's `Cannot GET /`, which is expected because the API serves only `/api`.
- The user tested the whole flow on the hosted site and confirmed it works, so the Phase 1 gate has passed. DECISIONS Q2 is resolved.

### 2026-11-09 — Phase 2 plan written

- Recorded the Vercel URL. Wrote `docs/superpowers/plans/2026-11-09-02-core-attempt.md`: 10 tasks covering the Phase 1 follow-ups, answers and scoring, Cyber Heist content with models and player views, practice REST, Socket.io join and chat, lobby and timer, gameplay, the client lobby, the client game and results screens, and the docs and gate.
- Decisions D32–D41 added (guests in practice, fixed Cyber Heist values, no pause until Phase 4, lazy runtimes, socket acks, 5 clue types now). Roadmap statuses updated.
- No code yet.

### 2026-11-09 — Phase 2 Core attempt built (Tasks 1–10)

- Branch `phase-2-core-attempt` (from `main` d7ff67f).
- **T1** Phase 1 follow-ups: an archived team can't be renamed; the archived team page has no open-seat row; a guest's signup/login links keep `?next=`; fetch timeout (60 s) and a "server waking up" hint after 5 s.
- **T2** `answers.js` (normalization per §6.4) and `scoring.js` (§7.3 formula, bonus, stars, summary).
- **T3** Cyber Heist fixed values (`server/src/content/`), `Attempt` and `Message` models, `attemptView.js` (the only path for attempt data; NFR-1 test).
- **T4** Practice rooms: `POST /api/practice`, `GET /api/practice/:code`, atomic second-seat join. Guests allowed (D32).
- **T5** Socket.io: JWT handshake, per-attempt rooms and runtime (queue, presence), team chat, join/leave system messages.
- **T6** Lobby: claim/release roles, ready, 5 s countdown with cancel, start (levels copied in), 1 s tick, timer warnings, timeout, restart resume (D37).
- **T7** Gameplay: answer checking with a 2 s per-player limit, atomic solve, board, level unlocks with own halves only, finish, quit.
- **T8** Client: `/practice`, `/play/:code`, `useAttempt` + reducer, lobby with role cards and chat.
- **T9** Client: attempt screen (timer as a class component, level bar, clue renderers for text/tokens/table/strip/symbols, answer box, board, phone tabs), results screen.
- **T10** README: real-time section, event table, the CO1 answer-submission trace.
- Verify: `npm test` 161/161; client lint clean; build 110 KB gzip JS. Browser checks (headless Edge, two isolated sessions, one at 360 px): lobby 13/13, full game 21/21, including a double submit that scored once, a refresh mid-level that restored the state, and 97 WebSocket frames with no answer or partner half.
- Rulings are in the plan's ledger and summarized for the user at hand-off; no new DECISIONS entries beyond D32–D41.

### 2026-11-09 — Phase 2 final review and fixes

- An independent review (Opus) of the whole branch found 0 Critical, 3 Important and 8 Minor issues.
- Fixed, each reproduced by a failing test first: (1) a socket that dropped while its join was queued stayed "online" forever, so a countdown could start with a player offline; (2) a second tab joining just as the countdown fired cancelled the start; (3) a player who left the lobby stayed "ready", so both could be ready and nothing started.
- Verify: `npm test` 164/164; browser checks lobby 13/13 and full game 21/21.
- Seven minors deferred (listed under Current state).

### 2026-11-09 — Phase 2 merged into main

- At the user's request, `phase-2-core-attempt` was merged into `main` locally (fast-forward), and the branch was deleted.
- Verify on the merged `main`: `npm test` → 164/164.
- Not pushed yet. Pushing `main` redeploys Render and Vercel; then run the Phase 2 gate.

### 2026-11-10 — Themed Puzzle Sets written (pre-Phase 3)

- Branch `phase-3-puzzle-sets` (from `main` 0714c7d). Resolves the open blocker Q4.
- With the user's approval: the 4 PRD themes plus 4 new ones in other genres: Haunted Asylum (horror), Tomb of the Sun King (ancient myth), Alchemist's Tower (fantasy), Polar Expedition (survival). All 8 use only the 11 existing mechanics; each mechanic appears in at least 2 themes.
- `docs/themed-puzzle-sets.md`: stories, roles, reveal and fail text, UI-2 styles (palette, fonts, texture, timer), level tables (randomized params, value-free hints, rewards, fallbacks), Detective consistency rules, Pirate first-letter finale, pool rules, and what Phase 3 must add (grid renderer, 10 glyphs, 2 colours, numbered strip).
- Code: `server/src/content/catalog.js` (mechanics, clue types, 16 glyphs, 6 colours, style keys, Morse); `content/themes/*.js` × 8 (`{ theme, templates, pools }`); `content/index.js` (registry, `listThemes`, `fillText`). `cyberHeist.js` moved into `themes/` with the same values; only the Firewall hint changed (it named instance values). `attemptView` fills `{answer.N}` in the reveal text.
- Tests: `tests/themedPuzzleSets.test.js` replaces `cyberHeist.test.js`. It solves every fallback from its own clue data (a solver per mechanic plus one per prose rule) and checks every pool rule, including that every Pirate finale word can be spelled. A deliberate mutation (2 wrong values) made exactly 2 tests fail.
- Verify: `npm test` → 309/309 (164 − 9 old Cyber Heist content tests + 154 new).
- Decisions D42–D49 added; D33 updated; Q4 removed from Deferred.

### 2026-11-10 — Themed Puzzle Sets merged into main

- At the user's request, `phase-3-puzzle-sets` was merged into `main` locally (fast-forward to b4d63de), and the branch was deleted.
- Verify on the merged `main`: `npm test` → 309/309.
- Not pushed yet.

### 2026-11-10 — Phase 3 plan written

- Wrote `docs/superpowers/plans/2026-11-10-03-challenges-engine.md`: 13 tasks in 3 parts. Part A, the level engine: Phase 2 deferred minors, RNG and validator with per-mechanic solvers, the 11 generators, finale planning and `generateLevelSet`, themes in MongoDB with seeding and fresh practice values. Part B, challenges: model and REST, entries with TEAM-7 and CHAL-6, socket play with window checks, extra hints. Part C, the client: grid and glyph renderers, hints, theme picker, challenge pages. Then docs and the gate.
- Proposes decisions D50–D61 (written into DECISIONS.md in Task 13).
- No code yet.

### 2026-11-10 — Phase 3 Task 2: RNG, level validator and the 11 solvers

- Added `server/src/generators/`: `rng.js` (mulberry32 seeded by FNV-1a), `validate.js` (`validateClue`, `revealsAnswer`, `validateLevel`), `util.js`, one module per mechanic exporting `solve`, and `index.js` (`GENERATORS`).
- Fallbacks now carry a server-only `solution` (Cyber 3; Detective 1–3; Space 1; Pirate 4; Haunted 2, 4; Tomb 3; Alchemist 1, 3; Polar 3, 4). `content/index.js` already leaves it out of `levels`. Detective 4 clue A is now the pool's DAGGER wound; Detective 5 `carryOver.shiftFrom` is the number 3.
- `themedPuzzleSets.test.js` uses the production validator instead of test-local solvers. New `rng.test.js`, `validate.test.js`. Verify: `npm test` → 299/299 (317 − 40 old solver tests + 22 new).

### 2026-11-10 — Phase 3 Task 3: generators for decode-key, caesar, morse, riddles, grids and ordering

- Added `generate` to `decodeKey`, `caesar`, `morse`, `splitRiddle`, `gridLookup`, `gridNavigation` and `ordering`, plus `generators/pick.js` (`pickAnswer`, `rewardFor`, `fill`, `fixedText`, `spells`, `buildLevel`, `distinctInts`).
- `pickAnswer` takes an optional 5th argument, the level's fixed text, and skips pool entries that the captions or intros would spell out (D49). Example: the Morse chart's "Signal" column rules out SIGNAL as an answer.
- Added `params.copy` (and `unit`, `mark`, `labels`, `directionWords`) to 19 templates in all 8 themes. Strip captions may use `{places}` ("place"/"places"). Detective 5 `carryOver` gained `suspectsFrom: 2` (the level whose uncleared suspects supply the killer).
- Tests: `server/tests/generators/basic.test.js` (200 seeds per template). `npm test` → 330/330.

### 2026-11-10 — Phase 3 Task 4: rule-filter, describe-match and arithmetic generators with theme variants

- Added `generate` to `ruleFilter` (7 variants), `describeMatch` (3) and `arithmetic` (3), selected by `params.variant`. Added `variant` and `copy` (plus `colours`/`kinds`, `values`, `weightLimits`/`weightRange`) to 14 templates; fallbacks unchanged. Detective 1, 3 and 4 gained `copy.reward` (`Murder at {time}`, `Shoe size {answer}`, `Weapon: {answer}`); `rewardFor`/`buildLevel` take extra reward values.
- `pick.js` gained `attempt(label, build, tries = 50)` (bounded retry that throws) and `leaks(template, answer, kind, ...clues)` (the validator's D49 check, so builders re-roll instead of emitting a clue that names the answer, e.g. the ANCHOR glyph in ANCHOR, or `5-1` inside the example `9-5-1`).
- `arithmetic.solve` now finds the correction only as a standalone number, so a delta of 10 is not matched inside the example `1050`. Tomb 3 accepts the answer without its leading zero (`515`).
- Detective 5 carry-over (done in Task 3) verified and tested over 300 seeds with a per-seed chain of levels 1-5. The whole-set test is `test.todo` until `generateLevelSet` (Task 5).
- Tests: `server/tests/generators/variants.test.js`, `detective.test.js`. `npm test` -> 382 pass, 1 todo.

### 2026-11-10 — Phase 3 Task 5: finale plan and generateLevelSet

- `fragmentFinale.js` gained `plan` (letters, distinct digits, Pirate first letters checked against the level pools; words that a clue or a level answer would show are skipped) and `generate`. New `generators/levelSet.js`: `generateLevelSet(content, seed)` plans with `${seed}:plan`, retries each level 20 times with `${seed}:${order}:${retry}`, validates, and falls back to the whole fixed set with a `console.warn` (D54). `index.js` does not export it (validate.js requires index, so that would be circular); require `generators/levelSet` directly.
- Finale templates in 7 themes gained `params.copy` (`introA`, `introB`, `entry`). `rewardFor` now throws for a missing planned letter/digit reward.
- Pools grew so two seeds differ in 4 of 5 levels: more Morse words (Space, Haunted, Polar), riddles (Pirate +10, Haunted +12); Detective Footprint wording has 3x3 variants (`introA`/`measureA` are lists).
- Detective whole-set test enabled. `npm test` -> 416 pass.

### 2026-11-10 — Phase 3 Task 7: Challenge model and REST

- New `models/Challenge.js` (uppercasing `code` setter, theme snapshot, window, `maxTeams`, `seed`, generated `levels`, `usedFallback`) and `models/levelFields.js` (generated fields shared with `Attempt`, which adds the progress fields). `generators/levelSet.js` now exports `newSeed()`, also used by `lobbyService`.
- `challengeService` (create with a once-generated level set and 5-try code retry, view by code, edit before `startsAt` per D61, delete unless entered, `statusOf` per D57) and `challengeView.js` (the only challenge payload builder; no levels/seed). Routes `/api/challenges` (POST, GET /:code, PATCH /:id, DELETE /:id), all `requirePlayer`.
- `CHALLENGE_NAME` and `CHALLENGE_CODE` added to `patterns.js` and the client `validators.js`. `npm test` -> 445 pass.

### 2026-11-10 — Phase 3 Task 8: Challenge entries, TEAM-7, partner replacement

- `Attempt.memberIds` plus unique partial indexes `{challengeId,teamId}` and `{challengeId,memberIds}` (NFR-7); `startDb()` runs `Attempt.syncIndexes()`. `POST /api/challenges/:id/entries` -> `enterChallenge` (11000 -> ALREADY_ENTERED or MEMBER_IN_CHALLENGE).
- `removeMember` refuses with TEAM_IN_ATTEMPT while the team is playing and syncs entered/lobby attempts (pull, or delete on archive); `joinTeam` adds the new partner with a PARTNER_IN_CHALLENGE pre-check and rollback; `startAttempt` requires players with roles A and B. `npm test` -> 458 pass.

### 2026-11-10 — Phase 3 Task 9: challenge attempts over sockets

- New `services/challengeAttemptService.openAttempt(attemptId, identity, now)`: guest -> GUEST_NOT_ALLOWED, bad/unknown id -> ATTEMPT_NOT_FOUND, non-member -> NOT_IN_ATTEMPT, `entered` -> NOT_OPEN (ISO start in the message) / CHALLENGE_CLOSED / atomic move to `lobby`; other statuses returned as is.
- `attempt:join` takes exactly one of `{ practiceCode }` / `{ attemptId }` (else VALIDATION_ERROR). `lobbyService.startAttempt` copies `challenge.levels` for challenge attempts and returns `{ refused: 'CHALLENGE_CLOSED' }` (back to lobby, unready) outside the window; `flow.startCountdown` posts the closed-window system message and broadcasts the lobby. The timer is the full theme timer, so it may run past `endsAt` (CHAL-7).
- Test helpers: `startedChallengeAttempt`, `createOpenChallenge`, `enterTeam` in `tests/helpers/rooms.js`. `socketChallenge.test.js` (8 tests, incl. the Gate and Task 8 Review Focus 4). `npm test` -> 471 pass.

### 2026-11-10 — Phase 3 Task 12: challenge pages

- New `api/challenges.js`, `utils/time.js` (toUtcIso, toLocalInput, formatLocal, formatCountdown, windowProblem), `utils/challengeErrors.js` (error code -> friendly text; `NOT_OPEN` -> "Opens at <local>"), `hooks/useNow.js`. Pages `CreateChallenge`, `ChallengePage`, `ChallengePlay`; routes `/challenges/new`, `/challenge/:code`, `/challenge/:code/play` (players only). Dashboard has "Create a challenge" and an "Open a challenge" code form.
- `components/game/AttemptScreen.jsx` holds the lobby/game/results/removed switch; `PlayPage` and `ChallengePlay` both use it.
- Fix found in the smoke test: `Lobby` crashed for a challenge attempt with one player left (`practiceCode` is null, so the invite box did `null.split`). It now shows "Challenge lobby" and no invite box for challenges.
- Verified with headless Chrome over CDP at 360 px (not committed). Lint clean; JS 116.5 KB gzip.

### 2026-11-10 — Phase 3 Challenges + level engine built (Tasks 1–12; Task 13 docs)

- Branch `phase-3-challenges-engine` (from `main` 3914b07). Per-task entries above give the details of Tasks 2–5, 7–9 and 12; this entry sums up the phase.
- **T1** All seven Phase 2 deferred minors fixed (commit 16633f6): a socket in one room can no longer grab a seat in another; idle runtimes are dropped for attempts that end with nobody connected; a mid-game handshake failure shows an error banner with Retry/Log in instead of "Reconnecting…"; the answer flash survives a reconnect (the reducer keeps `lastResult` across a snapshot); the socketLobby `test.each` now covers `lobby:claimRole`, `lobby:ready`, `lobby:cancel`, `level:submit` and `attempt:quit` (NOT_IN_ATTEMPT), not just chat; `level:submit` before the start answers `NOT_STARTED`; the unused client `getPractice` is removed.
- **T2–T5** The level engine in `server/src/generators/`: seeded RNG, validator, per-mechanic solvers, generators for all 11 mechanics with theme variants, finale planning and `generateLevelSet` (20 retries per level, whole-fallback on failure).
- **T6** Themes and level templates in MongoDB (`Theme`, `LevelTemplate`), theme snapshots, `ensureSeeded()` at boot, `seed.js` (themes plus admin from `SEED_ADMIN_*`), fresh practice values and the practice theme picker's API (`GET /api/themes`). A failed start returns the room to the lobby (D63).
- **T7** `Challenge` model and REST (create, view by code, edit before `startsAt`, delete).
- **T8** Entries: one attempt per team and per member (unique partial indexes), TEAM-7 (`TEAM_IN_ATTEMPT`), partner replacement with rollback (D64), and removed-partner eviction from the attempt room (D62).
- **T9** Challenge attempts over sockets (`attempt:join { attemptId }`) with window checks (CHAL-7: the timer may run past `endsAt`).
- **T10** Extra team hints: `hint:reveal`, ready 90 s after a level opens, one-time -25 points, hint text never sent before a reveal (tested). **T11** Client: grid clues, all 16 glyphs and 6 colours, numbered strip, hint panel, practice theme picker. **T12** Client: create challenge, challenge page, challenge play.
- **T13 (docs part only)** README (status, REST table, socket events, seeding, MVC map with `generators/`, CO1 trace for creating a challenge), DECISIONS D50–D66, roadmap status, `themed-puzzle-sets.md` synced with the theme modules (pool sizes, `params.copy`, `{places}`, `params.variant`; §6 marked delivered).
- Decisions: D50–D61 from the plan; D62–D66 made during the build (eviction event, failed-start recovery, TEAM_CHANGED, `levelSet.js` location, hint cost display). Q1 (admin seeding) resolved by D50.
- Verify: `npm test` → 28 suites, 479/479 pass. `npm --prefix client run lint` clean. `npm --prefix client run build` → JS 116.54 KB gzip, CSS 4.97 KB gzip. `seed.js` run against a throwaway in-memory MongoDB with `SEED_ADMIN_*` set: "Themes: 8 created, 0 updated", "Created admin admin".
- **Not done (needs the user):** merge/push, deploy, `GET /api/themes` check on the hosted API, and the hosted Phase 3 gate. Nothing was pushed or seeded on Render, Vercel or Atlas.

### 2026-11-10 — Phase 3 final review, fixes and merge into main

- Whole-branch review (most capable model): no Critical issues; 1 Important — `myEntry` was looked up through the viewer's current teams, so a player who left after finishing lost the link to their result. Its own DB check: generating from the seeded database for 8 themes × 100 seeds gave 0 fallbacks, identical to the content modules.
- One fix wave (46b05d6): `myEntry` found via `Attempt.findOne({ challengeId, memberIds })`; `attempt:join` re-checks membership inside the queue before joining the room; entering re-reads the team and returns 409 TEAM_CHANGED if a member was removed meanwhile; `startsAt`/`endsAt` must carry `Z` or an offset; eviction errors are logged; the challenge page button says "View results" for finished entries and explains a closed window; the challenge lobby explains a missing partner; the hint panel resets per level. Re-review clean.
- Parked for Phase 4: team-change writes to attempts run outside the per-attempt queue (see Deferred minors).
- At the user's request, `phase-3-challenges-engine` was merged into `main` locally (fast-forward to 46b05d6) and the branch deleted. Verify on the merged `main`: `npm test` → 483/483. Not pushed.
