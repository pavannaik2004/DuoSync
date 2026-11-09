# CONTEXT — DuoSync progress log

The single source of truth for project progress. **Read this before starting any job. Append a log entry after finishing one.**

## Current state

- **Phase:** 1 Foundation. Code complete on branch `phase-1-foundation`; hosted deployment pending.
- **Next:** deploy (README → Deploy; needs the user's Atlas, Render and Vercel accounts), then run the Phase 1 gate on the hosted URL. After that, write the Phase 2 plan.
- **Hosted URLs:** none yet
- **Open blockers:** deployment accounts (DECISIONS Q2); the *Themed Puzzle Sets* document for Phase 3 (Q4)
- **Run locally:** `npm --prefix server run dev:memory` + `npm run dev:client` (no database needed)
- **Tests:** `npm test` → 61 backend tests

## Key documents

| File | Purpose |
| --- | --- |
| `PRD Collaborative Digital Escape Room.md` | The spec |
| `docs/superpowers/plans/2026-11-09-00-roadmap.md` | Phase list and cross-phase architecture |
| `docs/superpowers/plans/2026-11-09-01-foundation.md` | Phase 1 task plan |
| `DECISIONS.md` | Decisions made where the PRD was silent, and decisions deferred |
| `README.md` | Setup, tests, deploy, MVC map |

## Phase checklist

- [ ] 1 Foundation: code done, gate (two accounts form a team on the hosted URL) pending deployment
- [ ] 2 Core attempt (EL Phase I)
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
