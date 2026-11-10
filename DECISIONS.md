# DECISIONS — DuoSync

These are decisions made where the PRD was silent or open, and decisions deferred for later. The PRD remains the spec; this file never overrides it. If a decision conflicts with the PRD, raise it with the user.

Status: **Decided** · **Deferred** (open, with the phase by which it must be settled) · **Superseded**

## Decided

| # | Date | Decision | Why | Status |
| --- | --- | --- | --- | --- |
| D1 | 2026-11-09 | Split the work into one plan per PRD phase (§11); write each plan once the previous gate passes | Each plan is written against real code; matches the solo, demo-per-phase constraint | Decided |
| D2 | 2026-11-09 | Server uses CommonJS, Express 5, Node 22 LTS | Syllabus Unit I names CommonJS; Express 5 forwards async errors natively, so no asyncHandler wrapper is needed | Decided |
| D3 | 2026-11-09 | Use `bcryptjs` (pure-JS bcrypt), cost 10 | Same algorithm as the PRD's bcrypt, with no native build on Windows or Render | Decided |
| D4 | 2026-11-09 | JWT carries only `{ sub, kind, nickname? }`; roles are loaded from the DB on each request | A role grant (ADMIN-6) applies without re-login | Decided |
| D5 | 2026-11-09 | Error body `{ error: CODE, message, details? }`; the client switches on `CODE` | NFR-20; stable contract | Decided |
| D6 | 2026-11-09 | Code alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no I, O, 0, 1) | Codes are read aloud and typed; avoids look-alike characters | Decided |
| D7 | 2026-11-09 | Usernames and team names are unique case-insensitively (collation index); emails are stored lowercased | "Alice" and "alice" as different users would confuse chat and leaderboards | Decided |
| D8 | 2026-11-09 | Team name pattern: letters, digits, `_`, `-`, single inner spaces, 3–24 characters | The PRD gives only the length; this blocks markup and padding tricks | Decided |
| D9 | 2026-11-09 | Guest nickname uses the same pattern as username (3–20, letters, digits, underscore) | The PRD gives no rule; reuses one regex | Decided |
| D10 | 2026-11-09 | If the captain leaves while the partner stays, the partner becomes captain. If the last member leaves, the team is archived and its invite code removed | The PRD covers only the last-member case (TEAM-5) | Decided |
| D11 | 2026-11-09 | Archived teams keep their name reserved | Past leaderboard rows keep pointing to a unique name | Decided |
| D12 | 2026-11-09 | Any player can view a team page; only members see the invite code | TEAM-6 is a profile; the code grants membership | Decided |
| D13 | 2026-11-09 | Joining a team is a single atomic conditional update | Two simultaneous joins must never make a team of 3 | Decided |
| D14 | 2026-11-09 | Practice rooms and challenge attempts share the `Attempt` model (`challengeId` null for practice). A minimal practice room lands in Phase 2 | §11 Phase 2 plays "through a practice room" before challenges exist | Decided |
| D15 | 2026-11-09 | Live attempts run in process (a Map of runtimes with a per-attempt queue) on a single server instance, rebuilt from the DB on boot | Render free tier runs one instance; this satisfies NFR-9 without Redis | Decided |
| D16 | 2026-11-09 | All attempt data sent to a client goes through one function, `toPlayerView(attempt, role)` | One place to audit for NFR-1 | Decided |
| D17 | 2026-11-09 | Seeded PRNG (mulberry32) keyed by `seed:order:retry` | Lets a level set be regenerated from its saved seed (§6.1) | Decided |
| D18 | 2026-11-09 | `react-router-dom` package, declarative routes | Matches the syllabus/lab naming (Lab 10) | Decided |
| D19 | 2026-11-09 | The login `?next=` parameter is accepted only for same-site paths (`/…`, not `//…`) | Prevents an open redirect | Decided |
| D20 | 2026-11-09 | Commits carry no Claude co-author trailer | User instruction | Decided |
| D21 | 2026-11-09 | The test DB helper passes `runtimeAdapters: { os }` to `mongoose.connect`, and `MONGOMS_DOWNLOAD_DIR` is pinned in `tests/setupEnv.js` | mongodb driver 7.8 loads `os` with a dynamic `import()`, which fails inside Jest and leaves an empty handshake; without the pin, runs from the repo root re-download about 780 MB. Test-only | Decided |
| D22 | 2026-11-09 | `/api/auth/guest` shares the login/signup limiter (10/min per IP) | Same abuse surface: it issues tokens for free | Decided |
| D23 | 2026-11-09 | Removing a member is an optimistic update on the exact member set; a conflict returns 409 `TEAM_CHANGED` | A join racing a leave can't corrupt the captain or archive state | Decided |
| D24 | 2026-11-09 | `npm --prefix server run dev:memory` runs the API on an in-memory MongoDB | Lets the app run locally and in demos without Atlas | Decided |
| D25 | 2026-11-09 | `render.yaml` sits at the repo root with `rootDir: server` | Render reads blueprints only from the repo root | Decided |
| D26 | 2026-11-09 | The invite box shows only while a team has an open seat | A full team can't accept joins; the captain can still make a new code | Decided |
| D27 | 2026-11-09 | Client helpers `useForm` (regex validation with server error mapping) and `useAsync` (loading, error, reload) | One pattern for 5 forms and every data page (UI-4) | Decided |
| D28 | 2026-11-09 | `CLIENT_ORIGIN` takes a comma-separated list; trailing slashes are ignored | A trailing slash or a Vercel preview URL otherwise fails with an opaque CORS error (final review) | Decided |
| D29 | 2026-11-09 | `safeNext` resolves `next` with `new URL()`, requires the same origin, and rejects control characters and backslashes; a top-level `ErrorBoundary` catches render errors | `/\t/evil.com` slipped through and blanked the page (final review); NFR-20 says never a blank page | Decided |
| D30 | 2026-11-09 | The API client treats a 200 reply that isn't JSON as an error (`BAD_RESPONSE`) | A wrong `VITE_API_URL` on Vercel otherwise leaves an endless "Checking your session" spinner | Decided |
| D31 | 2026-11-09 | Hosting: MongoDB Atlas M0, Render free web service (`duosync-api`, from `render.yaml`), Vercel for the client | Free tiers that fit the PRD; resolves Q2 | Decided |
| D32 | 2026-11-09 | Guests can create and join practice rooms from Phase 2. A player is identified by the token subject (user id or `guest_<uuid>`) | PRAC-1 allows guests and it costs nothing extra; Phase 5 still adds expiry and polish | Decided |
| D33 | 2026-11-09 | Cyber Heist fixed values are written in `server/src/content/cyberHeist.js` (PIN 9742, FIREWALL, 23-12-4, 8315, NODE) | The *Themed Puzzle Sets* document is missing (Q4). In Phase 3 these become the templates' fallback; replace them if the document differs. **2026-11-10:** kept unchanged as the Cyber Heist fallback in `docs/themed-puzzle-sets.md`; the file moved to `content/themes/cyberHeist.js` | Decided |
| D34 | 2026-11-09 | Practice attempts start in status `lobby`. `players[]` stores `{ id, kind, name, role, ready }`; `memberIds` and the challenge unique indexes arrive with challenges in Phase 3 | Practice has no entry step, and guests have no ObjectId | Decided |
| D35 | 2026-11-09 | The extra hint (GAME-10) arrives in Phase 3; the content already carries the hint text | §11 lists "shared board and extra hints" under Phase 3 | Decided |
| D36 | 2026-11-09 | No pause in Phase 2: a disconnect mid-attempt does not stop the timer; a reconnect gets a full snapshot. Pause, the 60 s grace and the pause budget come in Phase 4 | §11 puts "disconnect, pause and resync" in Phase 4 | Decided |
| D37 | 2026-11-09 | An `AttemptRuntime` is created lazily on the first join or event, so ticking resumes after a restart once someone rejoins; a countdown found at creation goes back to `lobby` | Covers restarts in Phase 2 without the full boot-time rebuild planned for Phase 4 | Decided |
| D38 | 2026-11-09 | Results are shown on `/play/:code` from socket state and never include answers. `GET /api/attempts/:id/result` and the rank come in Phase 4 | Practice is unranked; answers are revealed only per CHAL-10 later | Decided |
| D39 | 2026-11-09 | Socket events reply through an ack: `{ ok: true, … }` or `{ error, message }`. Without an ack the server emits `error` with the same body | Tests and the client can await each action; same error shape as REST (D5) | Decided |
| D40 | 2026-11-09 | Phase 2 renders 5 clue types (text, tokens, table, strip, symbols), the ones Cyber Heist needs; `grid` comes in Phase 3. A glyph legend is `symbols` with labels | Builds only what the fixed level set uses | Decided |
| D41 | 2026-11-09 | `rankCompare` is written with the leaderboards in Phase 4, not in Phase 2 | Nothing in Phase 2 ranks attempts | Decided |
| D42 | 2026-11-10 | We wrote the *Themed Puzzle Sets* ourselves (`docs/themed-puzzle-sets.md`): the 4 PRD themes plus 4 new ones in other genres (Haunted Asylum, Tomb of the Sun King, Alchemist's Tower, Polar Expedition), all built only from the 11 existing mechanics | The user asked for more theme variety; resolves Q4 | Decided |
| D43 | 2026-11-10 | Each theme is a module `{ theme, templates, pools }` under `server/src/content/themes/`; each template carries its ADMIN-3 fields and a full `fallback`. `getContent(slug).levels` is the fallback set until the level engine lands | One machine copy of the document that Phase 3 seeds and generators read | Decided |
| D44 | 2026-11-10 | A grid coordinate answer (column letter + row digit, e.g. `B9`) uses `answerKind: 'code'`; a code is up to 4 letters or digits with at least one digit | §6.5 Star Map needs one; §6.4 names only digit codes | Decided |
| D45 | 2026-11-10 | The glyph set grows to 16 shapes and token colours to 6 (`catalog.js`); the client draws the new ones in Phase 3 | Letter legends need up to 6 letters + 2 decoys (PARROT, SCARAB) | Decided |
| D46 | 2026-11-10 | A `strip` clue may have no shift (`numbered: true`): a plain numbered alphabet | Dying Message's shift comes from the board (the shoe size), not from clue B | Decided |
| D47 | 2026-11-10 | `revealText` may contain `{answer.N}`, filled from the finished attempt's levels by `fillText` in `attemptView` | §6.5: the Detective reveal states the killer and shoe size from the instance | Decided |
| D48 | 2026-11-10 | Template hints carry no values (no digits, no instance words) | A hint is shared by every generated instance | Decided |
| D49 | 2026-11-10 | "No half shows the answer" (§6.1 step 4) allows the answer only as one candidate among ≥3 table rows or labelled grid cells; answers under 3 characters are checked by the per-mechanic solvers instead | Suspect lists, registers and maps must name the answer among decoys | Decided |

## Deferred

| # | Date | Question | Must settle by | Notes |
| --- | --- | --- | --- | --- |
| Q1 | 2026-11-09 | Admin account seeding: Phase 1 or with the theme seed in Phase 3? | Phase 3 | Phase 1 tests set roles directly in the DB |
| Q3 | 2026-11-09 | Can the challenge creator see the in-progress team view if they also play in it? | Phase 4 | SCORE-5 vs. the fairness of the "accepted risk" |
| Q5 | 2026-11-09 | How a paused attempt that was mid-countdown behaves after a server restart | Phase 4 | Edge case of D15 |
| Q6 | 2026-11-09 | Sound assets: Web Audio synthesis or bundled files | Phase 6 | The PRD allows either |
| Q7 | 2026-11-09 | NFR-6 allows 10 auth requests per minute per IP. In a class contest where 50 students share one college IP (NAT), signups would be throttled | Before the first class event (Phase 4/5) | `AUTH_RATE_LIMIT` is configurable: raise it for event days, or key the limit by IP + email |
