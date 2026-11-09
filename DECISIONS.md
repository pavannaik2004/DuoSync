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

## Deferred

| # | Date | Question | Must settle by | Notes |
| --- | --- | --- | --- | --- |
| Q1 | 2026-11-09 | Admin account seeding: Phase 1 or with the theme seed in Phase 3? | Phase 3 | Phase 1 tests set roles directly in the DB |
| Q2 | 2026-11-09 | Hosting accounts and URLs (Atlas, Render, Vercel) | Phase 1, Task 10 | Needs the user's accounts |
| Q3 | 2026-11-09 | Can the challenge creator see the in-progress team view if they also play in it? | Phase 4 | SCORE-5 vs. the fairness of the "accepted risk" |
| Q4 | 2026-11-09 | Exact pool contents (words, riddles, weapons) for each generator | Phase 3 | The PRD references a *Themed Puzzle Sets* document that isn't in the repo. **Ask the user for it** |
| Q5 | 2026-11-09 | How a paused attempt that was mid-countdown behaves after a server restart | Phase 4 | Edge case of D15 |
| Q6 | 2026-11-09 | Sound assets: Web Audio synthesis or bundled files | Phase 6 | The PRD allows either |
