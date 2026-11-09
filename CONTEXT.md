# CONTEXT — DuoSync progress log

The single source of truth for project progress. **Read this before starting any job. Append a log entry after finishing one.**

## Current state

- **Phase:** 1 Foundation complete. 2 Core attempt: code complete and reviewed on branch `phase-2-core-attempt`; merge and hosted gate pending.
- **Next:** merge to `main` (user's call), push so Render and Vercel redeploy, then the Phase 2 gate: two devices finish Cyber Heist at `/practice` and see the same score.
- **Hosted URLs:** API `https://duosync-api.onrender.com` (Render, free tier; sleeps when idle). Client `https://duo-sync-lovat.vercel.app` (Vercel, root `client`). Repo: `https://github.com/pavannaik2004/DuoSync`
- **Open blockers:** the *Themed Puzzle Sets* document for Phase 3 (Q4)
- **Run locally:** `npm --prefix server run dev:memory` + `npm run dev:client` (no database needed)
- **Tests:** `npm test` → 164 backend tests (REST, scoring, views, Socket.io games)
- **Deferred minors from the Phase 2 review** (do early in Phase 3): a socket already in one room can grab a seat in another (crafted client only); runtimes not dropped for attempts that end with nobody connected; a mid-game handshake failure leaves "Reconnecting…" showing; the answer flash can be skipped after a reconnect; Review Focus 2 tests cover chat only; `level:submit` before the start says ATTEMPT_OVER instead of NOT_STARTED; unused client `getPractice`

## Key documents

| File | Purpose |
| --- | --- |
| `PRD Collaborative Digital Escape Room.md` | The spec |
| `docs/superpowers/plans/2026-11-09-00-roadmap.md` | Phase list and cross-phase architecture |
| `docs/superpowers/plans/2026-11-09-01-foundation.md` | Phase 1 task plan |
| `DECISIONS.md` | Decisions made where the PRD was silent, and decisions deferred |
| `README.md` | Setup, tests, deploy, MVC map |

## Phase checklist

- [x] 1 Foundation: gate passed 2026-11-09 (two accounts formed a team on the hosted site)
- [ ] 2 Core attempt (EL Phase I): code done, hosted gate pending
- [ ] 3 Challenges + level engine
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
