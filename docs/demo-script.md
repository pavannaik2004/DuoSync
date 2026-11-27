# Demo script

For the SEE lab demo and the EL reviews. It runs about 12 minutes and touches every §11 acceptance check that can be shown live. The checks themselves, with the test behind each one, are in [`acceptance.md`](acceptance.md).

## 30 minutes before

1. **Wake the API (NFR-14).** Render's free tier sleeps when idle and takes up to a minute to wake. Open `https://duosync-api.onrender.com/api/health` until it shows `{"status":"ok"}`, then open the client `https://duo-sync-lovat.vercel.app`.
2. **Load check, once.** From a laptop with the repo: `npm --prefix server run load -- --url https://duosync-api.onrender.com`. Expect `PASS` (p95 delivery under 500 ms, tick skew at most 1 s). It creates 50 guests and 25 practice rooms, which expire on their own after 30 idle minutes.
3. **Accounts.** Have these signed in, each in its own browser or device:
   - the admin (from `SEED_ADMIN_*`), on the projector laptop;
   - an organizer (a player the admin has granted the role);
   - 6 players in 3 teams (Team A, B and C), on at least 3 networks: two phones on mobile data and one laptop on the lab Wi-Fi.
4. **Sound.** Turn the projector laptop's sound on and press **Sound on** in the header once (browsers keep audio off until the first click).
5. **Fallback.** If the hosted site is down, run it locally: `npm --prefix server run dev:memory` and `npm run dev:client`, then use `http://localhost:5173`. The dev admin is admin@duosync.local / devadmin123.

## The walk-through

| Min | Show | Say |
| --- | --- | --- |
| 0 | Landing page, then the dashboard | Teams of two, every clue split between the teammates; the server never sends anyone the partner's half or the answer |
| 1 | **Admin → Themes**: open a theme, **Preview** a seed | Clue A, clue B and the answer side by side. A theme is activated only when it has 5 valid levels (ADMIN-4) |
| 2 | As the organizer: **Challenges → Create a challenge**, public, a 30-minute window | The server generates the 5 levels once, so every team gets identical values |
| 3 | The challenge appears in **Challenges** with the filter form | Query string `?status=open&theme=…` (Unit V) |
| 4 | Teams A, B and C enter and open the lobby. Claim roles, Ready | The lobby warns there is one attempt. The theme's own look appears: colours, fonts, timer |
| 5 | Play level 1 on Team A. Show the two phones side by side | Each phone shows a different half. They talk in team chat; either submits |
| 6 | Wrong answer, then the right one | −10 on a wrong answer, points and the next level on a right one, with sound |
| 7 | On Team B: **refresh** the page mid-level | Clue, board, chat, score and timer come back within 2 seconds (TIME-6) |
| 8 | On Team C: close one tab for 65 seconds while showing the partner's pause banner | The clock pauses with a 60-second grace; then the attempt ends early with its points kept |
| 9 | DevTools → Network → WS on Team A's laptop; search for the answer | Nothing: answers and the other half never leave the server (NFR-1) |
| 10 | The challenge leaderboard updating as teams finish | Ranked by points, then levels, then time; provisional until the window closes |
| 11 | Results page, then **Rankings** and **Profile → Edit profile** | Stars, breakdown, rank, chat log; best result per team per theme (SCORE-6) |
| 12 | A guest opening the challenge link | Guests may play practice only; challenges and team invites refuse them |

## The CO1 trace (viva)

Trace one answer submission through MVC, with the files open:

1. **View:** `client/src/components/game/AnswerBox.jsx` hands the text up to `GameScreen.jsx`, which calls `actions.submit` from `client/src/hooks/useAttempt.js`; it emits `level:submit`.
2. **Route and controller (socket):** `server/src/sockets/handlers.js` validates the payload, checks the sender is a player in this attempt (NFR-3), applies the 2-second gap, and queues the work on the attempt's runtime so submissions run one at a time (GAME-7).
3. **Service:** `server/src/services/gameService.js#submitAnswer` normalizes the answer (`services/answers.js`) and scores it (`services/scoring.js`, §7.3).
4. **Model:** `server/src/models/Attempt.js` is updated only if the level is still unsolved (`levels.$.solvedAt: null` in the filter), so two simultaneous answers score once (NFR-9).
5. **Back to the view:** the handler emits `level:result` and `board:update` to the team's room and `level:unlocked` to each player with only their own half (`services/attemptView.js`).

Other traces are in the README ("How the code is organised").

## If something goes wrong

| Problem | Do this |
| --- | --- |
| The API takes a minute to answer | It was asleep. Wait for `/api/health`, then refresh the client |
| A phone shows "Connection lost. Reconnecting…" | Mobile data dropped; it reconnects and resyncs by itself. Within 60 s nothing is lost |
| Login says "Too many attempts" | The auth limit is per IP and account (D93). Wait a minute, or log in with another account |
| A team pressed Ready too early | Either player can **Cancel** during the 5-second countdown |
