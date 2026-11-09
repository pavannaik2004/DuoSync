# DuoSync

DuoSync is a web-based escape-room competition for teams of two. In every level, each teammate sees a different half of the clue, and the server never sends anyone their partner's half or the answer. Teammates work the answer out in team chat. Teams play the same five levels during a challenge's time window and are ranked by points.

It is the Experiential Learning project for Full Stack Application Development (MCA261IA), built on MERN with Socket.io. The full specification is in [`PRD Collaborative Digital Escape Room.md`](PRD%20Collaborative%20Digital%20Escape%20Room.md).

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 1 Foundation | Accounts, guest tokens, teams with invite codes, router shell, deployment | Built; hosted deployment pending |
| 2–6 | Live attempts, challenges and level engine, leaderboards, admin, polish | Not started |

Progress is logged in [`CONTEXT.md`](CONTEXT.md). Design decisions and open questions are in [`DECISIONS.md`](DECISIONS.md). Phase plans are in [`docs/superpowers/plans/`](docs/superpowers/plans/).

## Stack

| Layer | Choice |
| --- | --- |
| Client | React 19 + Vite, React Router, PropTypes, plain CSS with custom properties |
| Server | Node.js 22, Express 5, Mongoose (MongoDB), JWT auth, bcrypt, express-validator |
| Real time | Socket.io on the same server (from Phase 2) |
| Tests | Jest + Supertest + mongodb-memory-server (backend only) |
| Hosting | Vercel (client), Render (API), MongoDB Atlas M0 (database) |

## How the code is organised (MVC)

```
client/src/
  api/          one module per REST resource, plus the fetch wrapper (client.js)
  context/      AuthContext — who is signed in
  hooks/        useForm (regex validation), useAsync (loading and error states)
  components/   shared UI with PropTypes
  pages/        one component per route
  styles/       base.css design tokens; per-theme sheets arrive in Phase 6
server/src/
  routes/       URL → middleware → controller          (the "C" entry point)
  controllers/  read the request, call a service, send JSON
  services/     business rules: auth, teams, codes
  models/       Mongoose schemas                        (the "M")
  middleware/   auth, validation, rate limit, error handler
  config/       environment and database connection
```

React is the **view**. To trace one request, for example joining a team: `client/src/pages/JoinTeam.jsx` → `api/teams.js#joinTeam` → `POST /api/teams/join` → `routes/teamRoutes.js` (requirePlayer, validate) → `controllers/teamController.js#join` → `services/teamService.js#joinTeam` (one atomic update, so a team can never get a third member) → `models/Team.js`.

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
| `CLIENT_ORIGIN` | The client's URL, the only origin CORS allows |
| `PORT` | API port (default 4000) |
| `AUTH_RATE_LIMIT` | Login, signup and guest requests allowed per minute per IP (default 10) |

The client has one variable, `VITE_API_URL`: the API's base URL, with no trailing slash.

## Tests

```bash
npm test          # Jest + Supertest against an in-memory MongoDB
```

The first run downloads a MongoDB binary (about 780 MB unpacked) into `server/node_modules/.cache`. Later runs take about 5 seconds.

## Deploy

1. **Database, MongoDB Atlas:** create a free M0 cluster and a database user. Under Network Access, allow `0.0.0.0/0`, because Render's outgoing IP addresses change. Copy the connection string.
2. **API, Render:** create a new Blueprint from this repository; it reads [`render.yaml`](render.yaml). When asked, enter `MONGODB_URI` and set `CLIENT_ORIGIN` to the Vercel URL from step 3 (you can update it after step 3). `JWT_SECRET` is generated for you. Check that `https://<render-app>.onrender.com/api/health` returns `{"status":"ok"}`.
3. **Client, Vercel:** import the repository with **Root Directory** `client` and the Vite framework preset. Add `VITE_API_URL=https://<render-app>.onrender.com` and deploy. [`client/vercel.json`](client/vercel.json) sends every path to `index.html`, so deep links such as invite links work.
4. Set Render's `CLIENT_ORIGIN` to the exact Vercel URL, without a trailing slash, and redeploy the API.

The free Render instance sleeps when idle. Open `/api/health` a few minutes before a demo to wake it up.
