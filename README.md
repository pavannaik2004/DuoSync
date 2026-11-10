# DuoSync

DuoSync is a web-based escape-room competition for teams of two. In every level, each teammate sees a different half of the clue, and the server never sends anyone their partner's half or the answer. Teammates work the answer out in team chat. Teams play the same five levels during a challenge's time window and are ranked by points.

It is the Experiential Learning project for Full Stack Application Development (MCA261IA), built on MERN with Socket.io. The full specification is in [`PRD Collaborative Digital Escape Room.md`](PRD%20Collaborative%20Digital%20Escape%20Room.md).

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 1 Foundation | Accounts, guest tokens, teams with invite codes, router shell, deployment | Done, live at https://duo-sync-lovat.vercel.app |
| 2 Core attempt | Socket.io, practice rooms, team lobby with roles, team chat, server timer, Cyber Heist with fixed values, scoring, results | Built; hosted gate pending |
| 3 Challenges + level engine | 8 themes in MongoDB, generators for all 11 mechanics, challenges with time windows, entries, one attempt per team and member, extra team hints, grid clues, challenge pages | Built; hosted gate pending |
| 4–6 | Leaderboards and resilience, admin, polish | Not started |

Progress is logged in [`CONTEXT.md`](CONTEXT.md). Design decisions and open questions are in [`DECISIONS.md`](DECISIONS.md). Phase plans are in [`docs/superpowers/plans/`](docs/superpowers/plans/).

The 8 themes (stories, roles, styles, level designs, generator pools and fallback values) are in [`docs/themed-puzzle-sets.md`](docs/themed-puzzle-sets.md).

## Stack

| Layer | Choice |
| --- | --- |
| Client | React 19 + Vite, React Router, PropTypes, plain CSS with custom properties |
| Server | Node.js 22, Express 5, Mongoose (MongoDB), JWT auth, bcrypt, express-validator |
| Real time | Socket.io on the same HTTP server as Express |
| Tests | Jest + Supertest + mongodb-memory-server (backend only) |
| Hosting | Vercel (client), Render (API), MongoDB Atlas M0 (database) |

## How the code is organised (MVC)

```
client/src/
  api/          one module per REST resource, the fetch wrapper (client.js) and the socket (socket.js)
  context/      AuthContext — who is signed in
  hooks/        useForm (regex validation), useAsync (loading and error states), useAttempt (live game state)
  game/         attemptReducer — applies server events to the game state
  components/   shared UI with PropTypes; game/ (lobby, attempt, results) and clues/ (one renderer per clue type)
  pages/        one component per route
  styles/       base.css design tokens, game.css; per-theme sheets arrive in Phase 6
server/src/
  routes/       URL → middleware → controller          (the "C" entry point)
  controllers/  read the request, call a service, send JSON
  generators/   the level engine: seeded RNG, one generator + solver per mechanic, level validator, `levelSet.js` (`generateLevelSet`)
  sockets/      Socket.io: handshake auth, event handlers, per-attempt runtime (queue and timers)
  services/     business rules: auth, teams, themes, challenges, entries, practice, lobby, game, hints, chat, scoring, answers, player views
  models/       Mongoose schemas: User, Team, Theme, Challenge, Attempt, Message   (the "M")
  content/      the 8 themes: templates, pools and fallback level sets (catalog.js holds the shared vocabulary)
  middleware/   auth, validation, rate limit, error handler
  config/       environment and database connection
server/scripts/ seed.js (themes and the admin), devMemoryDb.js
```

React is the **view**. To trace one REST request, for example joining a team: `client/src/pages/JoinTeam.jsx` → `api/teams.js#joinTeam` → `POST /api/teams/join` → `routes/teamRoutes.js` (requirePlayer, validate) → `controllers/teamController.js#join` → `services/teamService.js#joinTeam` (one atomic update, so a team can never get a third member) → `models/Team.js`.

To trace **submitting an answer** (CO1): `components/game/AnswerBox.jsx` passes the answer up to `GameScreen` → `hooks/useAttempt.js#submit` emits the socket event `level:submit` → `sockets/handlers.js` validates it, checks that the sender is a player in this attempt and applies the 2-second limit → `runtime.enqueue()` runs it after any earlier event for the same attempt → `services/gameService.js#submitAnswer` normalizes the answer (`services/answers.js`) and scores it (`services/scoring.js`) → `models/Attempt.js`, updated only if the level is still unsolved, so two simultaneous correct answers score once → the handler emits `level:result` and `board:update` to the team's room, and `level:unlocked` to each player with only their own clue half (`services/attemptView.js`).

To trace **creating a challenge** (CO1): `pages/CreateChallenge.jsx` → `api/challenges.js#createChallenge` → `POST /api/challenges` → `routes/challengeRoutes.js` (requirePlayer, validate) → `controllers/challengeController.js#create` → `services/challengeService.js#createChallenge` (checks the window, snapshots the theme, calls `generators/levelSet.js#generateLevelSet` once so every team gets the same levels) → `models/Challenge.js`.

## REST API

All routes are under `/api`. Errors are `{ error, message }`. Theme routes need a signed-in user (guest or player). Challenge routes need a player account.

| Method and path | What it does |
| --- | --- |
| `POST /auth/signup`, `/auth/login`, `/auth/guest`; `GET /auth/me` | Accounts and guest tokens |
| `POST /teams`, `GET /teams/mine`, `GET /teams/:id`, `POST /teams/join` and member actions | Teams with invite codes. Removing a partner or leaving is refused with `TEAM_IN_ATTEMPT` while the team is playing |
| `GET /themes` | The 8 active themes (no templates or answers) |
| `POST /practice { theme? }`, `GET /practice/:code` | Practice rooms; a fresh level set per room |
| `POST /challenges` | Create a challenge: name, theme, window (`startsAt`, `endsAt`), `maxTeams` |
| `GET /challenges/:code` | Challenge details with its status (upcoming, open, closing, closed) |
| `PATCH /challenges/:id` | Creator edits name, window or `maxTeams`, only before `startsAt` |
| `DELETE /challenges/:id` | Creator deletes it, unless a team has entered |
| `POST /challenges/:id/entries { teamId }` | Enter a full team. One attempt per team (`ALREADY_ENTERED`) and per member (`MEMBER_IN_CHALLENGE`) |

## Real time

Live play runs over Socket.io on the API's own server. The handshake sends the same JWT as REST. Each attempt has a room, `attempt:<id>`, that only its two players join, so one team's chat and progress never reach another team. Every payload a player receives is built by `services/attemptView.js`, which never includes answers, explanations or the partner's clue half.

| Direction | Event | What it does |
| --- | --- | --- |
| client → server | `attempt:join { practiceCode }` or `{ attemptId }` | Join the room (exactly one of the two); the reply is an `attempt:snapshot`. A challenge attempt opens only inside the challenge window |
| client → server | `lobby:claimRole { role }`, `lobby:releaseRole` | Take or give up role A or B |
| client → server | `lobby:ready`, `lobby:cancel` | Ready up; cancel a ready or the countdown |
| client → server | `chat:send { text }` | Team message, 1–300 characters, shown as plain text |
| client → server | `level:submit { order, answer }` | Answer the current level (one per player every 2 seconds) |
| client → server | `hint:reveal { order }` | Show the team the level's hint, once it is ready (90 s after the level opens). Costs 25 points, once |
| client → server | `attempt:quit` | End early, keeping the points earned |
| server → client | `attempt:snapshot` | This player's full state: on join, start and reconnect |
| server → client | `lobby:update` | Players, roles, ready flags, countdown |
| server → client | `attempt:tick { remainingMs }` | Every second; the client only displays it |
| server → client | `level:result`, `board:update`, `level:unlocked` | After each answer |
| server → client | `hint:available { order }` | The hint can now be revealed (the text is not sent yet) |
| server → client | `hint:revealed { order, hint }` | The hint text, to both players, after a reveal |
| server → client | `attempt:removed { attemptId, reason }` | You were removed from the team; you have left the room |
| server → client | `chat:message` | Team and system messages |
| server → client | `attempt:ended { status, result }` | Finished, timed out or ended early |

Every client event takes an acknowledgement callback, which answers `{ ok: true }` or `{ error, message }`, the same error shape as REST.

## Run it locally

You need **Node.js 22 or later**.

```bash
npm --prefix server install
npm --prefix client install
cp client/.env.example client/.env
```

**Option A: no database setup.** Run the API on a throwaway in-memory MongoDB. Its data is lost when the API stops.

```bash
npm --prefix server run dev:memory      # API on http://localhost:4000
npm run dev:client                      # app on http://localhost:5173
```

**Option B: MongoDB Atlas, or a local MongoDB.**

```bash
cp server/.env.example server/.env      # then set MONGODB_URI and JWT_SECRET
npm run dev:server
npm run dev:client
```

| Server variable | Meaning |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Long random string used to sign login tokens |
| `CLIENT_ORIGIN` | The client's URL, the only origin CORS and Socket.io allow. Several URLs can be separated by commas |
| `PORT` | API port (default 4000) |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD` | Optional. Used by `npm --prefix server run seed` to create (or promote) the admin account |
| `AUTH_RATE_LIMIT` | Login, signup and guest requests allowed per minute per IP (default 10) |

**Seeding.** The API seeds the 8 themes on its own at boot, but only when the `themes` collection is empty (`ensureSeeded`), so later admin edits survive restarts. To seed by hand, or to create the admin, run it once with the variables above set:

```bash
npm --prefix server run seed      # upserts all 8 themes (overwriting edits) and creates or promotes the admin
```

With no `SEED_ADMIN_*` variables the admin step is skipped. The seed needs a database: use Option B, or set `MONGODB_URI` to a running MongoDB.

The client has one variable, `VITE_API_URL`: the API's base URL, with no trailing slash.

## Tests

```bash
npm test          # Jest + Supertest + Socket.io client against an in-memory MongoDB
```

There are 479 tests: REST routes, scoring and answer rules, the 8 theme puzzle sets (each fallback solved from its own clues, every pool rule), the level generators (200 seeds per template, validated by per-mechanic solvers), challenges and entries, the player views (no answer or partner half ever leaves the server), and full Socket.io games with two connected players. The first run downloads a MongoDB binary (about 780 MB unpacked) into `server/node_modules/.cache`. Later runs take about a minute.

## Deploy

1. **Database, MongoDB Atlas:** create a free M0 cluster and a database user. Under Network Access, allow `0.0.0.0/0`, because Render's outgoing IP addresses change. Copy the connection string.
2. **API, Render:** create a new Blueprint from this repository; it reads [`render.yaml`](render.yaml). When asked, enter `MONGODB_URI` and set `CLIENT_ORIGIN` to the Vercel URL from step 3 (you can update it after step 3). `JWT_SECRET` is generated for you. Check that `https://<render-app>.onrender.com/api/health` returns `{"status":"ok"}`.
3. **Client, Vercel:** import the repository with **Root Directory** `client` and the Vite framework preset. Add `VITE_API_URL=https://<render-app>.onrender.com` and deploy. [`client/vercel.json`](client/vercel.json) sends every path to `index.html`, so deep links such as invite links work.
4. Optional: set `SEED_ADMIN_EMAIL`, `SEED_ADMIN_USERNAME` and `SEED_ADMIN_PASSWORD` on Render and run `npm run seed` once from its shell. Without it the API still seeds the themes at first boot, but no admin is created.
5. Set Render's `CLIENT_ORIGIN` to the exact Vercel URL, without a trailing slash, and redeploy the API.

The free Render instance sleeps when idle. Open `/api/health` a few minutes before a demo to wake it up.
