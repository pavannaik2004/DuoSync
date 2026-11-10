# Phase 3 — Challenges and Level Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players create challenges with time windows, enter them with a 2-player team, and play their single attempt on a level set generated once per challenge from the 8 themes. Practice games get fresh values on every game, and every level has an extra hint (PRD §11 Phase 3).

**Architecture:** Each of the 11 mechanics gets a generator module (`server/src/generators/<mechanic>.js`) that builds a level from a template's `params` and the theme's `pools`, using a seeded RNG. Each module also has a `solve` function, which re-derives the answer from the clue data. `generateLevelSet` runs the five generators in order: it plans the finale rewards first, validates each level against its `solve`, retries up to 20 times, and falls back to the theme's fixed set. Themes and templates are seeded into MongoDB from `server/src/content/themes/*.js`. A `Challenge` stores its generated level set. Entering creates the team's `Attempt` (status `entered`), which then uses the Phase 2 lobby, socket runtime and game flow, joined by `attemptId` instead of a practice code.

**Tech Stack:** The Phase 2 stack. No new dependencies (the RNG is mulberry32, written by hand).

**Spec:** `PRD Collaborative Digital Escape Room.md`, plus `docs/themed-puzzle-sets.md` (themes, mechanics, params, pools, fallbacks). Cross-phase rules are in `docs/superpowers/plans/2026-11-09-00-roadmap.md`. Read those, `DECISIONS.md` (D1–D49, plus D50–D61 added by this plan) and `CONTEXT.md` before starting.

**PRD requirements covered:** CHAL-1, 2, 3, 5 (no leaderboard yet), 6, 7, 8, 9; TEAM-7; GAME-1 (copy the challenge's levels), GAME-8 (board rewards from generation), GAME-10; §6.1–6.5 (all 11 generators, all 6 clue types, validation, retries, fallback); PRAC-1 (theme choice), PRAC-2 (fresh values); NFR-7 (unique indexes); NFR-18 (UTC windows); the seed script (§3 "Seed data"; resolves Q1); UI-1 pages: create challenge and challenge page.
**Not in this phase:** leaderboards, the creator's team view, final results, solutions after closing (CHAL-10), pause and disconnect grace (Phase 4); the public challenges list and filters (CHAL-4), admin CRUD and practice expiry (Phase 5); per-theme styling (Phase 6).

## Decisions this plan adds (write them into DECISIONS.md in Task 13)

| # | Decision |
| --- | --- |
| D50 | Themes and level templates are stored in MongoDB (`Theme`, `LevelTemplate`), seeded from the content modules. At boot, `ensureSeeded()` inserts them only when the `themes` collection is empty, so Phase 5 admin edits survive restarts. `npm --prefix server run seed` upserts every theme and creates the admin from `SEED_ADMIN_EMAIL`, `SEED_ADMIN_USERNAME` and `SEED_ADMIN_PASSWORD` (resolves Q1) |
| D51 | Challenges and attempts store a **theme snapshot** (`slug, name, genre, story, roles, timerMinutes, styleKey, boardLabel, revealText, failText`). Views read it through `themeOf(attempt)`, which falls back to `getContent(themeSlug).theme` for Phase 2 attempts that have no snapshot |
| D52 | A generator module exports `generate({ template, params, pools, rng, context }) → GeneratedLevel` and `solve(level, context) → string`, and the finale module also exports `plan`. `GeneratedLevel.solution` is server-only data for `solve` and is stripped before saving. The fallbacks carry `solution` too, so they pass the same validator |
| D53 | The finale's `plan` runs before level 1: it fixes the rewards of levels 1–4 (letters, distinct digits, or first letters) and the finale order |
| D54 | If any level fails 20 retries, the **whole** fallback set is used (`usedFallback: true`), because the rewards are planned across the set |
| D55 | Theme-specific text in generated clues comes from `params.copy` (strings with `{placeholders}`). Captions not in `copy` are taken from the fallback clue of the same half |
| D56 | Entering needs a full team (2 members). Until the attempt starts, removing the partner pulls them from the team's `entered`/`lobby` attempts, and a new partner is added, after the CHAL-6 check. An archived team's not-started entries are deleted. TEAM-7: removal or leaving is refused with 409 `TEAM_IN_ATTEMPT` while the team has an attempt in `countdown`, `in_progress` or `paused` |
| D57 | A challenge's status (upcoming, open, closing, closed, per §7.1) is computed from its window and its attempts, never stored |
| D58 | Challenge attempts are joined with `attempt:join { attemptId }`; the client page is `/challenge/:code/play` |
| D59 | Phase 3 has no pauses, so a hint is ready 90 s after `unlockedAt` (wall time). Phase 4 switches this to active time |
| D60 | Socket option `levelSetFor(themeContent) → levels`. The default generates a fresh set (PRAC-2); the test helpers pass the fallback set, so the Phase 2 socket tests keep their fixed values |
| D61 | The creator can edit the name, window and `maxTeams` only before `startsAt`, and `maxTeams` may not drop below the current number of entries. The max-teams check is not race-proof (it's a C-priority requirement) |

## Global Constraints

- **Workflow:** read `CONTEXT.md` before each task. Afterwards, append a dated log entry to it and record decisions in `DECISIONS.md`. Work on branch `phase-3-challenges-engine`.
- **Commits:** no `Co-Authored-By` trailer and no mention of Claude (D20).
- JavaScript only (CommonJS on the server, `.jsx` for React), no TypeScript, no CSS framework, no new npm dependencies.
- **NFR-1:** challenge levels, answers, `acceptedAnswers`, `explanation`, `solution`, the seed and unrevealed hints never reach a client. Attempt payloads are still built only in `services/attemptView.js`. Challenge payloads are built only in `services/challengeView.js`.
- **Randomness:** generators use only the `rng` they are given, never `Math.random` or `Date`. The RNG key is `` `${seed}:${order}:${retry}` `` (D17), and the plan's key is `` `${seed}:plan` ``. The seed is `crypto.randomBytes(8).toString('hex')`.
- **§6.1 validation:** a single answer (from `solve`); a `word` up to 8 letters; a `code` up to 4 characters with at least one digit (D44); a `list` up to 8 characters normalized; no half shows the answer (D49); up to **20** retries, then the fallback (D54).
- **Values pinned by the PRD:** challenge code **6** characters from the D6 alphabet, with an uppercasing setter; the window ends **≥ 15 min** after it starts and **≤ 30 days** after; the hint unlocks **90 s** after the level opens and costs **25** points, once; timers are 15/20/15/18 min for the PRD themes, and the new themes use their content values.
- **Roles:** guests get 403 `GUEST_NOT_ALLOWED` on every challenge route and on `attempt:join { attemptId }`. Only `organizer` or `admin` may create a `public` challenge; others get 403 `PUBLIC_NEEDS_ORGANIZER`.
- **NFR-18:** `startsAt` and `endsAt` travel as ISO-8601 UTC strings. The client converts `datetime-local` input to UTC and shows times in local time.
- Errors use `{ error: CODE, message }` (D5), and socket replies use acks (D39).
- 360 px with no horizontal scroll; touch targets ≥ 44 px; grid cells and glyphs have text labels (NFR-15, NFR-16).

## Review Focus

1. **One player in two teams enters the same challenge with both, at the same moment.** Exactly one entry is created; the other gets 409 `MEMBER_IN_CHALLENGE` (unique index on challenge + member). Test in Task 8.
2. **The window closes while a team is still in the lobby or mid-countdown.** The start is refused, the attempt goes back to `lobby`, and chat says so. A team that started 1 minute before closing plays its full timer. Test in Task 9.
3. **The same seed must give the same level set** (deep-equal, including clue data and rewards), and two different seeds must differ in at least 4 of 5 levels. Test in Task 5.
4. **The partner is removed while the other teammate waits in the lobby.** The removed player's next lobby event gets `NOT_IN_ATTEMPT`, and the countdown can't start with one player. Removal during `in_progress` gets 409 `TEAM_IN_ATTEMPT`. Test in Task 8.
5. **Both teammates reveal the hint at the same moment, or one does it before 90 s.** It is deducted exactly once, and the early one gets 409 `HINT_NOT_READY` at no cost. Test in Task 10.

---

## Part A — Level engine

### Task 1: Phase 2 deferred minors

**Files:**
- Modify: `server/src/sockets/handlers.js` (`attempt:join`), `server/src/sockets/runtime.js`, `server/src/sockets/flow.js` (`finish`), `server/src/services/gameService.js` (`submitAnswer`)
- Modify: `client/src/hooks/useAttempt.js`, `client/src/game/attemptReducer.js`, `client/src/pages/PlayPage.jsx`, `client/src/api/practice.js`
- Test: `server/tests/socketJoin.test.js`, `server/tests/socketGame.test.js`, `server/tests/socketLobby.test.js`

**Interfaces:**
- Produces: `AttemptRuntime#release()`, which drops the runtime from its registry when it has no sockets (the registry passes a `drop` callback to the constructor). `submitAnswer` throws 409 `NOT_STARTED` for `lobby` and `countdown`.

- [ ] **Step 1: Write the failing tests**

```js
// socketJoin.test.js
test('a socket already in one room cannot take a seat in another', async () => {
  // carol is in room R1; her socket emits attempt:join for R2 (with 1 player)
  expect(ack.error).toBe('ALREADY_IN_ATTEMPT');
  expect((await Attempt.findOne({ practiceCode: r2 })).players).toHaveLength(1);
});
// socketGame.test.js
test('a finished attempt with nobody connected drops its runtime', async () => {
  // both players disconnect, the timer runs out (timerMs: 300)
  expect(io.runtimes.size()).toBe(0); // add size() to the registry
});
test('level:submit before the start says NOT_STARTED', async () => { expect(ack.error).toBe('NOT_STARTED'); });
// socketLobby.test.js — Review Focus 2 of Phase 2, beyond chat
test.each(['lobby:claimRole', 'lobby:ready', 'lobby:cancel', 'level:submit', 'attempt:quit'])(
  '%s from a socket that never joined gets NOT_IN_ATTEMPT', async (event) => { expect(ack.error).toBe('NOT_IN_ATTEMPT'); });
```

- [ ] **Step 2: Run them.** `npm test -- socketJoin socketGame socketLobby` (from `server/`). Expected: the 3 new behaviours FAIL; the `test.each` rows may already pass.

- [ ] **Step 3: Implement.**
  - `attempt:join` resolves the room with `findPractice` and compares ids **before** `joinPractice` takes a seat.
  - `flow.finish` calls `runtime.release()` when `!runtime.hasSockets()`.
  - `submitAnswer` checks `['lobby','countdown'].includes(status)` first.

- [ ] **Step 4: Client fixes (checked by hand).**
  - The reducer keeps `lastResult` across a snapshot (`lastResult: state?.lastResult ?? null`), so a flash that arrives just before a reconnect snapshot still shows.
  - `connect_error` while `state` exists sets `error`. `PlayPage` then shows the error message in the banner with a **Retry** button (`socket.connect()`), plus a **Log in** link for `AUTH_REQUIRED`, instead of a permanent "Reconnecting…".
  - Delete the unused `getPractice`.

- [ ] **Step 5: Verify.** `npm test` passes, and `npm --prefix client run lint` is clean.

- [ ] **Step 6: Commit.** `fix: phase 2 deferred minors (seat grab, idle runtimes, NOT_STARTED, reconnect banner)`

---

### Task 2: RNG, level validator and the 11 solvers

**Files:**
- Create: `server/src/generators/rng.js`, `server/src/generators/validate.js`, and one module per mechanic: `server/src/generators/{decodeKey,caesar,ruleFilter,describeMatch,ordering,gridLookup,gridNavigation,morse,splitRiddle,arithmetic,fragmentFinale}.js` (`solve` only in this task)
- Create: `server/src/generators/index.js` (the `GENERATORS` map, keyed by the mechanic slugs in `catalog.MECHANICS`)
- Modify: the `server/src/content/themes/*.js` fallbacks (add `solution`; align the Detective weapon text), `server/src/content/index.js` (strip `solution` from `levels`)
- Modify: `server/tests/themedPuzzleSets.test.js` (replace the test-local solvers with the production validator)
- Test: `server/tests/rng.test.js`, `server/tests/validate.test.js`

**Interfaces:**
- Produces:
  - `createRng(key: string) → { float() → [0,1), int(min, max) (inclusive), pick(list), shuffle(list) → new array, sample(list, n) → n distinct items }`. Internally: mulberry32 seeded by a 32-bit FNV-1a hash of `key`.
  - `validateClue(clue) → string[]`: the shape rules from `checkClueData` in today's content test, moved into production code.
  - `revealsAnswer(half, candidate, kind) → boolean` (the D49 rule).
  - `validateLevel(level, { mechanic, context }) → string[]`: answer limits, `acceptedAnswers` limits, `validateClue` on both halves, `revealsAnswer` false for the answer and each alternative, and `normalize(GENERATORS[mechanic].solve(level, context)) === level.answer`. A `solve` that throws counts as an error.
  - `context = { levels: Level[] /* earlier levels of this set, index = order − 1 */, pools, params, plan }`.
  - `solution` shapes:
    - `ruleFilter`: `{ table: 'A'|'B', where: [{ col, op: 'eq'|'ne'|'lt'|'in'|'covers', value, cols? }], pick: number, sort: 'asc'|'desc'|null, join: boolean }`. `covers` reads `cols: [fromCol, untilCol]` and passes when the row's range contains the `value` time. `join: false` requires exactly 1 matching row; `join: true` requires ≥ 2, joined with `-` in `sort` order.
    - `ordering`: `{ table: 'A', idCol, valueCol, direction }`.
    - `arithmetic`: `{ reading: string, delta: number, format: 'clock' | 'number' }`. `solve` also asserts that clue A's text contains `reading` and clue B's contains `|delta|`. `clock` answers are 12-hour `HHMM`, zero-padded to 4 (`11:35 − 15 → 1120`, `4:50 + 25 → 0515`).
  - Mechanics that solve from clue data alone (no `solution`):
    - `decodeKey`, `caesar` (with a shift; carry-over reads the shift from `context.levels[params.carryOver.shiftFrom − 1].answer`), `morse`, `gridLookup`, `gridNavigation`, `splitRiddle` (via `pools.riddles`).
    - `describeMatch` with symbols, or the weapon variant: the pool weapon whose `wound` is clue A's paragraph.
    - `fragmentFinale` (titles in clue A's order → rewards, or their first letters when `params.use === 'firstLetter'`).

- [ ] **Step 1: Write the failing tests**

```js
// rng.test.js
test('the same key gives the same sequence; different keys differ', () => {
  const a = createRng('s:1:0'); const b = createRng('s:1:0'); const c = createRng('s:1:1');
  const seq = (r) => Array.from({ length: 5 }, () => r.int(1, 1000));
  expect(seq(a)).toEqual(seq(b)); expect(seq(createRng('s:1:0'))).not.toEqual(seq(c));
});
test('int is inclusive and in range; sample has no repeats', () => { /* 1000 draws of int(1, 3) hit 1, 2 and 3 only */ });
// validate.test.js
test('every fallback level of every theme passes validateLevel', () => { /* listThemes() × 5, context built in order */ });
test.each([
  ['an answer of 9 letters', { answer: 'ABCDEFGHI' }],
  ['a code of 5 digits', { answerKind: 'code', answer: '12345' }],
  ['clue A showing the answer in text', 'clueA paragraphs contain FIREWALL'],
  ['a solve that disagrees', 'Firewall strip shift 4'],
  ['an unknown glyph', 'symbols shape "skull"'],
])('rejects %s', (_, mutation) => { expect(validateLevel(mutated, ctx).length).toBeGreaterThan(0); });
```

- [ ] **Step 2: Run them.** `npm test -- rng validate`. Expected: FAIL (the modules don't exist).

- [ ] **Step 3: Implement** `rng.js`, `validate.js` and each module's `solve`.
  - Add `solution` to the fallbacks that need it: Cyber 3; Detective 1–3; Space 1; Pirate 4; Haunted 2 and 4; Tomb 3; Alchemist 1 and 3; Polar 3 and 4.
  - Change Detective 4's clue A to the pool's `wound` text for DAGGER.
  - `fallbackLevel` in `content/index.js` leaves out `solution`.

- [ ] **Step 4: Rewrite `themedPuzzleSets.test.js`.** Drop the `GENERIC`/`CUSTOM` solvers and `checkClueData`, and assert `validateLevel(...)` is `[]` for every level. Keep the theme, PRD-match, pool and Pirate-satisfiability tests.

- [ ] **Step 5: Verify.** `npm test` passes, and the deliberate mutation from the puzzle-sets work (Polar 4 → `296`) still fails exactly one test.

- [ ] **Step 6: Commit.** `feat: seeded RNG, level validator and per-mechanic solvers`

---

### Task 3: Generators for the data-driven mechanics

The mechanics in this task have one shape across themes: `decodeKey`, `caesar`, `morse`, `splitRiddle`, `gridLookup`, `gridNavigation`, `ordering`.

**Files:**
- Modify: the 7 generator modules (add `generate`), plus `server/src/generators/pick.js` (shared helpers)
- Modify: the theme modules' `params` (add `copy`), for every template that uses these mechanics
- Test: `server/tests/generators/basic.test.js`

**Interfaces:**
- Consumes: `createRng`, `validateLevel`, `context` (Task 2).
- Produces:
  - `generate({ template, params, pools, rng, context }) → GeneratedLevel` (`{ clueA, clueB, answer, acceptedAnswers, answerKind, reward, explanation, solution? }`). `params` is `template.params`; `template.fallback` supplies the captions (D55), and `template.rewardRule` drives `rewardFor`.
  - `pickAnswer(list, rng, context, order) → entry`: picks from `list`, keeping only entries that start with `context.plan.startsWith[order]` when that is set.
  - `rewardFor(template, answer, context) → string|null`: `letter`/`digit` → `context.plan.rewards[order]`; `answer` → the answer; `caseNote` → `params.copy.reward` filled with the answer.
- **`params.copy` placeholders** (the content modules supply the strings):

| Mechanic | Keys and placeholders |
| --- | --- |
| decodeKey | `captionA`, `captionB` (none). `params.labels` is `'colors'` (label = colour name) or a list (Tomb guardians) |
| caesar | `introA` (clue A's first line), `stripCaption` with `{shift}` |
| morse | `introA` |
| splitRiddle | `introA`, `introB` |
| gridLookup | `captionA`, `captionB`. `params.mark` is `'star'` or `'rune'` |
| gridNavigation | `introA`, `startLine` with `{landmark}`, `moveLine` with `{count} {unit} {direction}`; `params.unit` is `['pace','paces']` (and likewise for steps or tiles) |
| ordering | `captionA`, `columns: [idLabel, valueLabel]`, `ruleLine` with `{direction}`, `params.directionWords` such as `{ asc: 'from the lowest pressure to the highest', desc: '…' }` |

- **Value rules** (from §6.5 and the doc §4): decodeKey uses 4 distinct digits 1–9 and the colours from `params.colors`. Caesar uses shift `int(params.shift)` and direction `params.direction`; the encoded word is the answer shifted the opposite way. Grid Navigation (the generator's own retry loop, before validation): place `params.landmarks` labels on distinct cells and pick a start landmark plus 3 moves of 1–3 squares that stay on the map, pass no landmark, and end on another landmark. Ordering uses distinct values in `params.valueRange` and 4 distinct ids 1–9. Grid Lookup uses distinct letters from A–Z excluding I and O, and distinct row digits 1–9.

- [ ] **Step 1: Write the failing tests**

```js
// generators/basic.test.js
const CASES = [ /* [slug, order] for every template using these 7 mechanics, from listThemes() */ ];
test.each(CASES)('%s level %i: 200 seeds all validate', (slug, order) => {
  for (let s = 0; s < 200; s += 1) {
    const level = generate(template, `t${s}`, contextWithPlan);
    expect(validateLevel(level, { mechanic, context })).toEqual([]);
  }
});
test('Firewall: shift stays in 1–5 and the word comes from caesarWords', () => { /* 200 seeds */ });
test('Island Walk honours plan.startsWith for the Pirate finale', () => { /* plan.startsWith[2] = 'W' → answer WELL or WRECK */ });
test('Grid Navigation never passes over another landmark', () => { /* walk each generated path */ });
```

- [ ] **Step 2: Run them.** `npm test -- generators/basic`. Expected: FAIL.

- [ ] **Step 3: Implement** the 7 `generate` functions, `pick.js`, and add `copy` to the content modules. Before Task 5 builds the real plan, the tests pass a stub plan: `rewards` = `{1:'A',2:'B',3:'C',4:'D'}`.

- [ ] **Step 4: Verify.** `npm test` passes.

- [ ] **Step 5: Commit.** `feat: generators for decode-key, caesar, morse, riddles, grids and ordering`

---

### Task 4: Generators with theme variants

These are `ruleFilter`, `describeMatch` and `arithmetic`, plus the Detective carry-over in `caesar`.

**Files:**
- Modify: `server/src/generators/{ruleFilter,describeMatch,arithmetic,caesar}.js`, theme `params` (add `variant` and `copy`)
- Test: `server/tests/generators/variants.test.js`, `server/tests/generators/detective.test.js`

**Interfaces:**
- Consumes: Task 2 and Task 3 helpers.
- Produces: `params.variant` selects a builder. Each builder returns a `GeneratedLevel` with its `solution`.

| Mechanic | Variant (template) | Randomized (doc §4) |
| --- | --- | --- |
| ruleFilter | `offline-servers` (Cyber 3) | 6 IDs 1–30, exactly 3 offline (fan OFF and light not GREEN), direction desc or asc |
| | `alibis` (Detective 2) | 4 suspects from `suspects`, 4 witnesses or `nobody`; exactly 1 witnessed range covers the murder time (`context.levels[0]`) |
| | `shoe-size` (Detective 3) | Print 22–27 cm; the chart is fixed (22→5 … 27→10) |
| | `cursed-item` (Pirate 4) | 5 items from `chestItems` (`pickAnswer` for the target), colours and kinds from `params.colours` / `params.kinds`; rule variant `colour+kind`, `colour+not kind` or `not colour+kind`; exactly 1 matches |
| | `patient-bed` (Haunted 2, `listHolder: 'B'`) | 6 beds 1–30, months, discharged, window; exactly 1 matches all 3 conditions |
| | `potions` (Alchemist 1) | 6 bottles; a 2-condition rule leaving 2–3; direction |
| | `crates` (Polar 3) | 6 crates 1–20; 3 conditions leaving exactly 3; direction |
| describeMatch | `glyph-digits` (Cyber 4) | 4 of the first 6 shapes, a digit legend, 1–2 decoys |
| | `glyph-letters` (Pirate 3, Tomb 1) | Word from `params.pool` (`pickAnswer`), a distinct shape per letter, 2 decoys |
| | `weapon` (Detective 4) | Weapon from `weapons`; clue A is its `wound`; clue B lists all 5 `[name, mark]` |
| arithmetic | `clock-fast` (Detective 1) | Murder 23:05–23:35 in 5-min steps; error 10/15/20; reading = murder + error |
| | `clock-slow` (Tomb 3) | Reading 1:00–5:55 in 5-min steps; error 15–35 in steps of 5; answer = reading + error |
| | `gauge-high` (Polar 4) | Reading 200–480 in steps of 5; correction 15–60 in steps of 5; answer = reading − correction |
| caesar | `params.carryOver` (Detective 5) | Killer = `rng.pick` of level 2's 3 uncleared suspects; encoded forward by `Number(context.levels[2].answer)`; clue B is `{ numbered: true }` |

- [ ] **Step 1: Write the failing tests**

```js
// generators/variants.test.js
test.each(VARIANT_CASES)('%s: 300 seeds validate and the rule leaves the expected count', ...);
test('cursed-item: every rule variant appears across seeds', () => { /* collect solution.where shapes */ });
test('arithmetic answers stay within limits (code ≤ 4 chars)', () => {});
// generators/detective.test.js — the §6.5 consistency rules over 300 seeds of a whole Detective set
test('the cleared suspect is never the killer, the killer is uncleared, shift = shoe size', () => {
  const { levels } = generateLevelSet(detective, `d${s}`);
  const suspects = levels[1].clueA.data.rows.map((r) => r[0]);
  expect(suspects).toContain(levels[4].answer);
  expect(levels[4].answer).not.toBe(levels[1].answer);
  expect(shiftWord(levels[4].clueA.data.paragraphs.at(-1), -Number(levels[2].answer))).toBe(levels[4].answer);
});
```
The Detective test depends on `generateLevelSet` from Task 5: mark it `test.todo` here and enable it in Task 5.

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement** the builders. Each one generates the candidate data, then re-rolls inside its own loop (up to 50 tries) until its condition yields exactly the required count, and only then returns. `validateLevel` is the outer check.

- [ ] **Step 4: Verify.** `npm test` passes.

- [ ] **Step 5: Commit.** `feat: rule-filter, describe-match and arithmetic generators with theme variants`

---

### Task 5: Finale plan and `generateLevelSet`

**Files:**
- Modify: `server/src/generators/fragmentFinale.js` (add `plan`, `generate`), `server/src/generators/index.js`
- Test: `server/tests/generators/levelSet.test.js` (and enable the Task 4 Detective test)

**Interfaces:**
- Produces:
  - `plan({ templates, params, pools, rng }) → { rewards: {1..4: string}, startsWith: {1..4: letter}|{}, order: number[] /* level orders in finale order */, answer: string }`:
    - `rewards: 'letters'` takes a word from `finaleWords` and gives its letters to levels 1–4 in shuffled order.
    - `rewards: 'distinct digits 1–9'` uses `sample` to pick 4 digits.
    - `rewards: 'answers'` (Pirate) picks a word and a permutation `startsWith` that the pools can satisfy; the rewards become the answers later.
  - `generateLevelSet({ templates, pools }, seed) → { levels: Level[], seed, usedFallback: boolean }`. A `Level` is in the Attempt level shape (`order, title, hint, answerKind, answer, acceptedAnswers, reward, clueA, clueB, explanation`), with no `solution`.
  - The algorithm (§6.1):
    1. Plan with `createRng(`${seed}:plan`)`.
    2. For each template in order, try `retry` from 0 to 19 with `createRng(`${seed}:${order}:${retry}`)`; `generate`, then `validateLevel`; stop at the first valid level.
    3. If any level fails all 20 tries, return the fallback set with `usedFallback: true`, and `console.warn` the slug, order and seed.
    4. Finally, strip `solution`.

- [ ] **Step 1: Write the failing tests**

```js
// generators/levelSet.test.js
test.each(listThemes())('%s: 100 seeds all pass validation without fallback (§11 acceptance)', (slug) => {
  for (let s = 0; s < 100; s += 1) expect(generateLevelSet(content(slug), `seed-${s}`).usedFallback).toBe(false);
});
test.each(listThemes())('%s: same seed → deep-equal set', (slug) => {
  expect(generateLevelSet(c, 'x1')).toEqual(generateLevelSet(c, 'x1'));
});
test.each(listThemes())('%s: two seeds differ in at least 4 of 5 levels (§11 acceptance)', (slug) => {
  for (let s = 0; s < 50; s += 1) {
    const a = generateLevelSet(c, `a${s}`).levels; const b = generateLevelSet(c, `b${s}`).levels;
    const differ = a.filter((l, i) => JSON.stringify([l.clueA, l.clueB, l.answer]) !== JSON.stringify([b[i].clueA, b[i].clueB, b[i].answer]));
    expect(differ.length).toBeGreaterThanOrEqual(4);
  }
});
test('no generated level carries solution', () => {});
test('a template whose generator always fails gives the fallback set and usedFallback', () => {});
test('digit finales: rewards are 4 distinct digits 1–9 and the answer is them in finale order', () => {});
```

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement** `plan`, the finale `generate` (clue A lists the titles in `plan.order`; clue B lists `title gave reward.` or `title: answer.`, phrased with `params.copy`), and `generateLevelSet`.

- [ ] **Step 4: Verify.** `npm test` passes. The 100-seed loop over 8 themes must finish in under 10 s; if it's slower, reduce only the loop count in Task 3/4 tests, never in this acceptance test.

- [ ] **Step 5: Commit.** `feat: finale planning and generateLevelSet with retries and fallback`

---

### Task 6: Themes in the database, seeding, theme snapshot, practice with fresh values

**Files:**
- Create: `server/src/models/Theme.js`, `server/src/models/LevelTemplate.js`, `server/src/services/themeService.js`, `server/src/controllers/themeController.js`, `server/src/routes/themeRoutes.js`, `server/scripts/seed.js`, `server/tests/helpers/themes.js`
- Modify: `server/src/models/Attempt.js` (`theme` snapshot, `hintRevealedAt` on levels), `server/src/services/attemptView.js` and `server/src/sockets/handlers.js` (use `themeOf`), `server/src/services/practiceService.js`, `server/src/services/lobbyService.js` (`startAttempt`), `server/src/sockets/index.js` (`levelSetFor`), `server/src/server.js` (`ensureSeeded` after connect), `server/src/routes/index.js`, `server/package.json` (`"seed": "node scripts/seed.js"`), `server/.env.example`, `render.yaml` (`SEED_ADMIN_*` as `sync: false`)
- Modify: the test helpers `tests/helpers/sockets.js` (pass `levelSetFor: (c) => c.fallbackLevels`) and `tests/helpers/users.js` (`createRoom(app, auth, theme?)`)
- Test: `server/tests/themes.test.js`, `server/tests/practice.test.js`, `server/tests/socketGame.test.js`

**Interfaces:**
- Produces:
  - `Theme`: the content theme fields, plus `pools` (Mixed), `active` (default true), `deletedAt` (default null) and timestamps; `slug` unique.
  - `LevelTemplate`: `themeId, order` (validator 1–5, unique together with `themeId`), `title, mechanic` (enum `MECHANICS`), `params` (Mixed), `hint, rewardRule, timeEstimateSec, fallback` (Mixed).
  - `themeService`:
    - `seedThemes({ overwrite }) → { created, updated }` and `ensureSeeded() → void` (seeds only when the collection is empty).
    - `listActiveThemes() → [{ slug, name, genre, story, timerMinutes, styleKey, roles }]`.
    - `loadThemeContent(slug) → { theme: Snapshot, templates, pools, fallbackLevels }`; throws 404 `THEME_NOT_FOUND` for a missing, inactive or deleted theme.
    - `themeSnapshot(theme) → Snapshot` (D51).
  - `themeOf(attempt) → Snapshot` (exported from `attemptView.js`).
  - `GET /api/themes` (any token) → `listActiveThemes()`.
  - `POST /api/practice { theme? }`: `theme` defaults to `'cyber-heist'` and is validated as a slug (`/^[a-z0-9-]{3,40}$/`); the room stores the snapshot and `timerMinutes`.
  - `lobbyService.startAttempt(attemptId, { now, timerMs, levelSetFor })`: practice takes `levelSetFor(await loadThemeContent(attempt.themeSlug))`. The default `levelSetFor` is `(c) => generateLevelSet(c, newSeed()).levels`.
  - `scripts/seed.js` connects, runs `seedThemes({ overwrite: true })`, and creates or promotes the admin (roles `['player','admin']`) from `SEED_ADMIN_EMAIL`, `SEED_ADMIN_USERNAME` and `SEED_ADMIN_PASSWORD`, skipping the admin with a message when those are unset.

- [ ] **Step 1: Write the failing tests**

```js
// themes.test.js
test('ensureSeeded inserts 8 themes and 40 templates once; a second call changes nothing', async () => {});
test('ensureSeeded does not overwrite an edited theme; seedThemes({ overwrite: true }) does', async () => {});
test('GET /api/themes lists the 8 active themes, without pools or templates; a guest may call it', async () => {});
test('an inactive theme is not listed and loadThemeContent rejects it with THEME_NOT_FOUND', async () => {});
// practice.test.js
test('POST /api/practice { theme: "pirate" } makes a Pirate room with an 18-minute timer and a snapshot', async () => {});
test('POST /api/practice { theme: "nope" } → 404 THEME_NOT_FOUND; { theme: {} } → 400 VALIDATION_ERROR', async () => {});
// socketGame.test.js
test('with the default levelSetFor, two practice games of one theme get different levels (PRAC-2)', async () => {});
```

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement.** Every suite that creates rooms calls `seedThemes()` from `tests/helpers/themes.js` in `beforeAll`, after `startDb()` (and again after any `clearDb()` that empties themes).

- [ ] **Step 4: Verify.** `npm test` passes, including the unchanged Phase 2 socket tests (which use fallback levels through the helper). `npm --prefix server run dev:memory` logs that it seeded 8 themes.

- [ ] **Step 5: Commit.** `feat: themes in MongoDB with seeding, theme snapshots and fresh practice levels`

---

## Part B — Challenges

### Task 7: Challenge model and REST (create, view, edit, delete)

**Files:**
- Create: `server/src/models/Challenge.js`, `server/src/models/levelFields.js` (level fields shared with `Attempt`), `server/src/services/challengeService.js`, `server/src/services/challengeView.js`, `server/src/controllers/challengeController.js`, `server/src/routes/challengeRoutes.js`
- Modify: `server/src/models/Attempt.js` (use `levelFields`), `server/src/utils/patterns.js` and `client/src/utils/validators.js` (add `CHALLENGE_NAME` and `CHALLENGE_CODE` to both, identically), `server/src/routes/index.js`
- Test: `server/tests/challenges.test.js`

**Interfaces:**
- Produces:
  - `patterns.CHALLENGE_NAME = /^(?=.{3,40}$)[A-Za-z0-9_'!?-]+(?: [A-Za-z0-9_'!?-]+)*$/`, and `patterns.CHALLENGE_CODE = /^[A-HJ-NP-Z2-9]{6}$/i`.
  - `Challenge`: `code` (uppercasing setter, unique), `name, themeSlug, theme` (snapshot), `creatorId, visibility` (`public|private`), `startsAt, endsAt, maxTeams` (null or 2–500), `seed, levels` (`levelFields`, no progress), `usedFallback`, `createdAt`.
  - `challengeService`:
    - `createChallenge(user, { name, theme, startsAt, endsAt, visibility, maxTeams }, now) → { id, code }`. It generates the level set once (CHAL-2) with `generateLevelSet(await loadThemeContent(theme), newSeed())`, and retries a code collision 5 times, as practice does.
    - `getChallengeByCode(code, user, now) → ChallengeView`.
    - `updateChallenge(id, user, patch, now)` and `deleteChallenge(id, user)`.
    - `statusOf(challenge, now, hasRunning) → 'upcoming'|'open'|'closing'|'closed'` (D57).
  - `ChallengeView` (from `challengeView.js`): `{ id, code, name, visibility, theme: { slug, name, genre, story, timerMinutes, roles }, startsAt, endsAt (ISO), status, teamsEntered, maxTeams, isCreator, myEntry: { attemptId, teamId, teamName, status } | null }`. It never includes levels, the seed or `usedFallback`.
  - Routes (all `requirePlayer`):
    - `POST /api/challenges` → 201
    - `GET /api/challenges/:code` → 200 (404 `CHALLENGE_NOT_FOUND` for a malformed or unknown code)
    - `PATCH /api/challenges/:id` and `DELETE /api/challenges/:id` → 204
  - Errors: `VALIDATION_ERROR` (window < 15 min or > 30 days, `startsAt` more than 5 min in the past, bad dates, bad name); `PUBLIC_NEEDS_ORGANIZER` 403; `NOT_CREATOR` 403; `CHALLENGE_STARTED` 409 (edit after `startsAt`); `HAS_ENTRIES` 409 (delete); `MAX_TEAMS_TOO_LOW` 409.

- [ ] **Step 1: Write the failing tests**

```js
// challenges.test.js
test('a player creates a private challenge: 201, 6-character code, 5 levels saved with a seed', async () => {
  const doc = await Challenge.findOne({ code: res.body.code });
  expect(doc.levels).toHaveLength(5); expect(doc.seed).toMatch(/^[0-9a-f]{16}$/);
});
test('the challenge page never contains an answer, a clue, the seed or a solution (NFR-1)', async () => {
  const json = JSON.stringify(page.body);
  for (const l of doc.levels) expect(json).not.toContain(l.answer.length >= 3 ? l.answer : '\u0000');
  expect(json).not.toMatch(/clueA|clueB|seed|solution|explanation/);
});
test('a player gets 403 PUBLIC_NEEDS_ORGANIZER for public; an organizer may', async () => {});
test.each([
  ['end 14 minutes after start', 14 * 60e3], ['end 31 days after start', 31 * 864e5],
])('rejects a window with %s', async (_, length) => { expect(res.body.error).toBe('VALIDATION_ERROR'); });
test('a guest gets 403 GUEST_NOT_ALLOWED on every challenge route', async () => {});
test('two challenges of one theme have different seeds and levels', async () => {});
test('the creator edits the name before the start; after the start → 409 CHALLENGE_STARTED; another player → 403', async () => {});
test('delete works with no entries; HAS_ENTRIES once a team has entered', async () => {}); // entry inserted directly; Task 8 adds the route
test('status is upcoming, then open, then closed as the clock passes the window', () => { /* statusOf with fixed now */ });
```

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement.**
  - Express-validator rules on the route: `name` matches `CHALLENGE_NAME`; `theme` matches the slug pattern; `startsAt`/`endsAt` are ISO-8601 strings; `visibility` is one of the two values; `maxTeams` is an optional integer 2–500.
  - The window rules live in `challengeService`, which takes `now` as a parameter so the tests control the clock.

- [ ] **Step 4: Verify.** `npm test` passes.

- [ ] **Step 5: Commit.** `feat: challenges with windows, generated level sets and creator edits`

---

### Task 8: Entering a challenge, one-attempt rule, TEAM-7 and partner replacement

**Files:**
- Modify: `server/src/models/Attempt.js` (add `memberIds`; add unique partial indexes `{ challengeId: 1, teamId: 1 }` and `{ challengeId: 1, memberIds: 1 }`, both with `partialFilterExpression: { challengeId: { $type: 'objectId' } }`)
- Modify: `server/src/services/challengeService.js` (`enterChallenge`), `server/src/services/teamService.js` (`removeMember`, `joinTeam`), `server/src/routes/challengeRoutes.js`, `server/src/controllers/challengeController.js`
- Test: `server/tests/challengeEntries.test.js`, `server/tests/teamLeave.test.js`, `server/tests/teamJoin.test.js`

**Interfaces:**
- Produces:
  - `enterChallenge(challengeId, user, { teamId }, now) → { attemptId }`, behind `POST /api/challenges/:id/entries`, which returns 201. The checks run in this order:
    1. The challenge exists (404 `CHALLENGE_NOT_FOUND`).
    2. Its status is `upcoming` or `open` (409 `CHALLENGE_CLOSED`).
    3. The team exists, isn't archived, and the caller is a member (403 `NOT_TEAM_MEMBER`).
    4. The team has 2 members (409 `TEAM_NOT_FULL`).
    5. `maxTeams` isn't reached (409 `CHALLENGE_FULL`).
    6. Create the attempt: `{ challengeId, teamId, memberIds, players: members.map(u => ({ id: String(u._id), kind: 'user', name: u.username })), status: 'entered', themeSlug, theme, timerMinutes }`.
    7. A duplicate key (11000) means 409 `ALREADY_ENTERED` when this team already has an attempt; otherwise 409 `MEMBER_IN_CHALLENGE`.
  - `removeMember`:
    - Refuses with 409 `TEAM_IN_ATTEMPT` when `Attempt.exists({ teamId, status: { $in: ['countdown','in_progress','paused'] } })`.
    - After the team update, the target is `$pull`ed from `memberIds` and `players` of the team's `entered`/`lobby` attempts, and the remaining players' `ready` is set to false.
    - When the team is archived, those attempts are deleted (D56).
  - `joinTeam`:
    - After the atomic join, the new member is added to the team's `entered`/`lobby` attempts.
    - If any add hits 11000, roll back: `$pull` the user from the team and from the attempts already updated, then throw 409 `PARTNER_IN_CHALLENGE` (CHAL-6).
    - A pre-check gives the same error before joining, for the common case.
  - `lobbyService.startAttempt` additionally requires 2 players holding roles A and B; otherwise it resets the attempt to `lobby` and returns null.

- [ ] **Step 1: Write the failing tests**

```js
// challengeEntries.test.js
test('a member enters with a full team: 201, attempt status entered with both players', async () => {});
test('the same team entering twice → 409 ALREADY_ENTERED', async () => {});
test('Review Focus 1: a player in two teams entering both at once → one 201, one 409 MEMBER_IN_CHALLENGE', async () => {
  const [r1, r2] = await Promise.all([enter(teamAB), enter(teamAC)]);
  expect([r1.status, r2.status].sort()).toEqual([201, 409]);
  expect(await Attempt.countDocuments({ challengeId })).toBe(1);
});
test.each([['TEAM_NOT_FULL', 'a team of 1'], ['NOT_TEAM_MEMBER', "someone else's team"], ['CHALLENGE_CLOSED', 'after endsAt'], ['CHALLENGE_FULL', 'maxTeams reached']])(
  '%s for %s', async () => {});
// teamLeave.test.js
test('TEAM-7: leaving while the team attempt is in_progress → 409 TEAM_IN_ATTEMPT; team unchanged', async () => {});
test('Review Focus 4: removing the partner before the start pulls them from the entered attempt', async () => {
  expect(attempt.players.map((p) => p.id)).toEqual([alice.user.id]);
});
test('the last member leaving deletes the team\'s not-started entries', async () => {});
// teamJoin.test.js
test('CHAL-6: the new partner is added to the entered attempt', async () => {});
test('CHAL-6: a new partner already in that challenge with another team → 409 PARTNER_IN_CHALLENGE, team unchanged', async () => {});
```

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement.** Call `Attempt.syncIndexes()` in `startDb()` after connect, so the new partial indexes exist in tests.

- [ ] **Step 4: Verify.** `npm test` passes.

- [ ] **Step 5: Commit.** `feat: challenge entries, one attempt per team and member, TEAM-7 and partner replacement`

---

### Task 9: Playing a challenge attempt over sockets (window rules)

**Files:**
- Create: `server/src/services/challengeAttemptService.js`
- Modify: `server/src/sockets/handlers.js` (`attempt:join` takes `{ practiceCode }` or `{ attemptId }`, exactly one), `server/src/services/lobbyService.js` (`startAttempt` for challenges), `server/src/sockets/flow.js` (`startCountdown` posts the closed-window message), `server/tests/helpers/rooms.js` (add `startedChallengeAttempt(options)`)
- Test: `server/tests/socketChallenge.test.js`

**Interfaces:**
- Consumes: `enterChallenge`, `statusOf` (Tasks 7–8).
- Produces:
  - `openAttempt(attemptId, identity, now) → attempt`:
    - Throws 403 `GUEST_NOT_ALLOWED` for a guest; 404 `ATTEMPT_NOT_FOUND` for a malformed or unknown id; 403 `NOT_IN_ATTEMPT` when the identity isn't in `players`.
    - For status `entered`: before `startsAt`, 409 `NOT_OPEN`, with `message` naming the ISO start; at or after `endsAt`, 409 `CHALLENGE_CLOSED`; otherwise sets `status = 'lobby'`.
    - Any other status is returned as is, so a finished attempt shows its results.
  - `startAttempt`, for a challenge attempt:
    - Loads the challenge.
    - When `now < startsAt` or `now >= endsAt`, it resets to `lobby` (all `ready: false`) and returns `{ refused: 'CHALLENGE_CLOSED' }`.
    - Otherwise it copies `challenge.levels` (GAME-1) and starts the timer with the attempt's `timerMinutes`.
  - `flow.startCountdown`, on `refused`: posts the system message "The challenge window has closed. This attempt can no longer start." and broadcasts the lobby.

- [ ] **Step 1: Write the failing tests**

```js
// socketChallenge.test.js
test('Gate: two teams in one challenge get identical clue halves for every level', async () => {
  // play both teams through with the answers read from Challenge.levels; compare each level:unlocked payload by role
});
test('a teammate opens the lobby: entered → lobby; snapshot has the theme snapshot and no answers', async () => {});
test('a non-member socket → NOT_IN_ATTEMPT; a guest → GUEST_NOT_ALLOWED; both attemptId and practiceCode → VALIDATION_ERROR', async () => {});
test('before startsAt → NOT_OPEN; an un-started team after endsAt → CHALLENGE_CLOSED', async () => {});
test('Review Focus 2: the window closes during the countdown → back to lobby with a system message', async () => {});
test('an attempt started 1 minute before endsAt keeps its full timer (CHAL-7)', async () => {
  expect(new Date(attempt.endsAt) - new Date(attempt.startedAt)).toBe(theme.timerMinutes * 60000);
});
test('a finished team cannot play again: joining shows the result and lobby:ready is refused', async () => {});
```
Tests set the window by writing `startsAt`/`endsAt` directly on the challenge document, and use short `countdownMs`/`timerMs` options as the Phase 2 tests do.

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement.** The `attempt:join` handler branches to `joinPractice` or `openAttempt`. Everything after the join (runtime, snapshot, lobby, game) is unchanged.

- [ ] **Step 4: Verify.** `npm test` passes.

- [ ] **Step 5: Commit.** `feat: challenge attempts over sockets with window checks`

---

### Task 10: Extra hints (GAME-10)

**Files:**
- Modify: `server/src/services/gameService.js` (`revealHint`, and `submitAnswer` uses `hintUsed`), `server/src/services/attemptView.js` (`clueFor` adds the hint state), `server/src/sockets/handlers.js` (`hint:reveal`), `server/src/sockets/flow.js` (`scheduleHint`), `server/src/sockets/index.js` (`hintDelayMs: 90000`)
- Test: `server/tests/socketHint.test.js`, `server/tests/attemptView.test.js`

**Interfaces:**
- Produces:
  - `revealHint(attemptId, player, { order }, now) → { kind: 'revealed', order, hint, attempt } | { kind: 'ignored' }`:
    - Throws 409 `NOT_STARTED`, 409 `ATTEMPT_OVER`, 409 `HINT_NOT_READY` (now − `unlockedAt` < `hintDelayMs`), or 409 `NO_HINT` (when `hint` is null).
    - The update is atomic: the filter includes `levels.<i>.hintRevealedAt: null` and `levels.<i>.solvedAt: null`.
    - It is ignored when `order` isn't the current level or when the hint is already revealed.
  - `clueFor` → `{ order, title, clue, hint: { ready: boolean, text: string|null } }`. `text` is set only once the hint is revealed (NFR-1).
  - Events:
    - `hint:available { order }` (with chat "Hint ready for <title>") fires once per level, from `scheduleHint(runtime, attempt)`. It is called after the start, after each unlock and on resume, and cleared on finish.
    - `hint:revealed { order, hint, revealedBy: { id, name, role } }` (with chat "<Role name> revealed the hint (−25)").
  - Scoring: `levelPoints({ …, hintUsed: Boolean(level.hintRevealedAt) })`.

- [ ] **Step 1: Write the failing tests**

```js
// socketHint.test.js (hintDelayMs: 300)
test('hint:available arrives after hintDelayMs, with a chat message, once', async () => {});
test('Review Focus 5: revealing before ready → HINT_NOT_READY, nothing deducted', async () => {});
test('Review Focus 5: both reveal at once → one hint:revealed, and the level scores −25 once', async () => {
  // reveal ×2 in parallel, then solve: points === levelPoints({ activeMs, wrongCount: 0, hintUsed: true })
});
test('a reconnecting player sees the revealed hint text in the snapshot', async () => {});
// attemptView.test.js
test('an unrevealed hint never appears in any payload', () => { expect(JSON.stringify(view)).not.toContain(level.hint); });
```

- [ ] **Step 2: Run them.** Expected: FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Verify.** `npm test` passes.

- [ ] **Step 5: Commit.** `feat: extra team hints with a 90-second unlock and a one-time 25-point cost`

---

## Part C — Client

### Task 11: Clue renderers, hints and the practice theme picker

**Files:**
- Create: `client/src/components/clues/GridClue.jsx`, `client/src/components/game/HintPanel.jsx`, `client/src/api/themes.js`
- Modify: `client/src/components/clues/{ClueView,Glyph,StripClue}.jsx`, `client/src/components/game/{GameScreen,gameShapes}.js(x)`, `client/src/game/attemptReducer.js`, `client/src/hooks/useAttempt.js`, `client/src/pages/PracticeHome.jsx`, `client/src/api/practice.js`, `client/src/styles/game.css`

**Interfaces:**
- Consumes: `clueFor` hint state and the `hint:available`/`hint:revealed` events (Task 10); `GET /api/themes` and `POST /api/practice { theme }` (Task 6).
- Produces:
  - `GridClue({ data })`: a CSS grid of `rows × cols`; a header row of `colLabels` and a first column of `rowLabels` when present. A cell with `mark` shows a glyph with `aria-label` ("star" or "rune"); a cell with `label` shows the text. On screen readers each cell reads as "row R, column C".
  - `Glyph` draws all 16 `SYMBOL_SHAPES` (D45), each as one SVG element in the 48 × 48 viewBox.
  - `.token-orange` and `.token-purple` colours.
  - `StripClue` with `numbered` shows A–Z with the numbers 1–26 and no shift row.
  - `HintPanel({ hint, onReveal })`: "Hint unlocks 90 seconds into the level" until `ready`; then a `ConfirmButton` "Reveal hint (−25 points)"; then the text.
  - `useAttempt({ practiceCode } | { attemptId })` with `actions.revealHint(order)`; reducer cases `hintAvailable` and `hintRevealed`.
  - `createPractice(theme)`; `listThemes()`.
  - `PracticeHome` has a theme `<select>` (name, genre and timer) loaded with `useAsync`.

- [ ] **Step 1: Implement** (the PRD has no frontend tests).

- [ ] **Step 2: Verify.**
  - `npm --prefix client run lint` is clean, and `npm --prefix client run build` stays under **300 KB** gzip JS (NFR-12).
  - By hand, at 360 px and on desktop, in two browsers: a Space Station practice game shows the Star Map grid; a Pirate game shows anchor/moon/key glyphs; a Detective game shows the numbered strip at level 5; the hint appears after 90 s, and revealing it in one browser shows it in both.

- [ ] **Step 3: Commit.** `feat(client): grid clues, 16 glyphs, numbered strip, hints and practice theme picker`

---

### Task 12: Challenge pages

**Files:**
- Create: `client/src/api/challenges.js`, `client/src/pages/CreateChallenge.jsx`, `client/src/pages/ChallengePage.jsx`, `client/src/pages/ChallengePlay.jsx`, `client/src/components/game/AttemptScreen.jsx` (the lobby/game/results switch extracted from `PlayPage`), `client/src/utils/time.js`
- Modify: `client/src/App.jsx`, `client/src/pages/PlayPage.jsx` (use `AttemptScreen`), `client/src/pages/Dashboard.jsx`

**Interfaces:**
- Consumes: Task 7–9 routes and errors; `useAttempt({ attemptId })` (Task 11).
- Produces:
  - Routes (all `allow={players}`): `/challenges/new`, `/challenge/:code`, `/challenge/:code/play`.
  - `challenges.js`: `createChallenge(body)`, `getChallenge(code)`, `updateChallenge(id, patch)`, `deleteChallenge(id)`, `enterChallenge(id, teamId)`.
  - `time.js`: `toUtcIso(datetimeLocalValue) → string`, `formatLocal(iso) → string`, `formatCountdown(ms) → 'd h m s'` (NFR-18).
  - `CreateChallenge`:
    - Fields: name (`CHALLENGE_NAME` regex via `useForm`), theme select, start, end, optional max teams.
    - The visibility radio shows only for organizers and admins; everyone else creates private.
    - Client checks mirror the window rules. On success, `navigate('/challenge/' + code)`.
  - `ChallengePage`:
    - Shows the name, theme story, the window in local time with a countdown to the start or end (display only), teams entered, the share link and the code.
    - Without `myEntry`: an enter form listing the player's full, unarchived teams.
    - With `myEntry`: "Open team lobby" → `/challenge/:code/play`.
    - For the creator before the start: edit name/window and delete (`ConfirmButton`).
    - Errors map to friendly text: `NOT_OPEN` → "Opens at <local time>".
  - `ChallengePlay` loads the challenge, then renders `AttemptScreen` with `useAttempt({ attemptId: myEntry.attemptId })`. When the player has no entry, it links back to the challenge page.
  - `Dashboard`: "Create a challenge" and an "Open a challenge" code form (`CHALLENGE_CODE`).

- [ ] **Step 1: Implement.**

- [ ] **Step 2: Verify.**
  - Lint is clean and the build is under 300 KB.
  - By hand: 4 accounts form 2 teams; one creates a challenge that opens in 2 minutes; both teams enter; before the start the lobby shows "Opens at…"; after it opens, both teams play. A guest opening `/challenge/<code>` sees the players-only message.
  - Everything works at 360 px with no horizontal scroll.

- [ ] **Step 3: Commit.** `feat(client): create challenge, challenge page and challenge play`

---

### Task 13: Docs, deploy and the Phase 3 gate

**Files:**
- Modify: `README.md` (status table; REST routes for themes, challenges and entries; socket events `hint:*` and `attempt:join { attemptId }`; seeding steps; the MVC map adds `generators/`), `DECISIONS.md` (D50–D61), `CONTEXT.md`, `docs/superpowers/plans/2026-11-09-00-roadmap.md` (Phase 3 status), `docs/themed-puzzle-sets.md` (§6 marks the delivered items)

- [ ] **Step 1: Write the docs.** Add a CO1 trace for creating a challenge: `CreateChallenge.jsx` → `api/challenges.js` → `POST /api/challenges` → `challengeRoutes` → `challengeController.create` → `challengeService.createChallenge` (→ `generateLevelSet`) → `models/Challenge.js`.

- [ ] **Step 2: Verify locally.** `npm test` passes all tests. Client lint and build are clean. `npm --prefix server run seed` against the in-memory DB reports 8 themes and the admin.

- [ ] **Step 3: Deploy (needs the user).**
  - The user sets `SEED_ADMIN_*` on Render, pushes `main`, and runs `npm run seed` once from the Render shell (or relies on `ensureSeeded`, without the admin).
  - Check: `GET /api/themes` → 8.

- [ ] **Step 4: The Phase 3 gate on the hosted URL.**
  - Two teams on two networks play the same challenge, and their clue halves match level by level.
  - A second challenge of the same theme shows different values.
  - Record the result in CONTEXT.

- [ ] **Step 5: Commit.** `docs: phase 3 README, decisions and gate log`
