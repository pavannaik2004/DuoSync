# PRD: Collaborative Digital Escape Room

Nov 4, 2026 · @Sumanth

## 1. Overview

This is a web-based escape room competition. **Teams of 2 players** compete against other teams on the same set of 5 levels. Within each level, the two teammates each receive a different half of the clue. They must talk in their team chat to work out the answer, and the answer unlocks the next level. Teams play whenever they like during a challenge's time window, and are ranked by points. It is built on MERN with Socket.io as the solo Experiential Learning project for Full Stack Application Development (MCA261IA).

**Problem.** Most browser puzzle games are single-player, or one strong player carries the team. Here the server splits every clue between two teammates, so neither can progress alone. Sharing one puzzle set across many teams adds competition: every team faces identical levels, and the scores can be compared fairly.

**Core concepts**

| Term | Meaning |
| --- | --- |
| Team | 2 registered players with a team name. Created by a captain, joined by a partner with a team invite code. Reused across challenges. |
| Challenge | One theme's 5 levels with fixed values, open during a time window set by its creator. Every team in the challenge gets exactly the same levels. |
| Attempt | One team's single run at a challenge, with its own countdown timer |
| Level | One puzzle. Each teammate sees their own clue half; the correct answer unlocks the next level. |
| Practice | An unranked game with any partner, including guests, with fresh random values |

**Goals**

1. Let teams of 2 compete on identical 5-level challenges, with a points-based leaderboard for each challenge.
2. Make every level need both teammates. This is enforced on the server: a client never receives the partner's clue half or any answer.
3. Let organizers run events (e.g. a class contest) and let any player create a private challenge for friends.
4. Keep scoring fair and server-owned: timer, points, penalties and ranking are all computed on the server.
5. Demonstrate every syllabus unit (Node/Express, React, MongoDB/Mongoose, REST, React Router and forms) in a clean MVC codebase.

**Non-goals for v1:** teams larger than 2, live head-to-head matches where all teams start together, voice chat, preventing teams from sharing answers outside the app (accepted risk), native mobile apps, payments.

**Success criteria**

- 3 or more teams finish the same challenge on the hosted URL and appear on its leaderboard, correctly ranked by points.
- No answer or partner clue half can be found in the browser's network traffic or page state.
- Every team in a challenge receives identical level values; two different challenges of the same theme receive different values.
- An admin can add a new theme through the admin panel with no code changes.
- Every syllabus unit maps to at least one implemented feature (section 10).

## 2. Users and roles

There are 4 kinds of user. Inside an attempt, each teammate also holds one of 2 in-game roles.

| User type | How they get in | Can do | Cannot do |
| --- | --- | --- | --- |
| Player | Sign up with email and password | Create or join teams, play challenges for a team, create private challenges, play practice games, keep a profile and history | Create public event challenges, use admin pages |
| Guest | Nickname only (temporary session) | Play practice games | Join teams, play challenges, appear on leaderboards |
| Organizer | A player given the `organizer` role by an admin | Everything a player can, plus create public event challenges and watch every team's progress in them | Edit themes or levels |
| Admin | A player with the `admin` role (seeded, not self-service) | Everything above, plus CRUD on themes, levels and users' roles | Change attempts in progress |

**Team captain** is the player who created the team. The captain can rename the team, make a new invite code and remove the partner. A team always has exactly 2 members to play a challenge. A player can be in several teams, but in any one challenge they can play for only one team.

**Challenge creator** is the organizer or player who created a challenge. They pick the theme and the time window, share the challenge code, and see its leaderboard. Creating a challenge does not stop them from also playing in it with a team.

**In-game roles.** Each theme names its 2 roles: Hacker/Decoder, Forensics Desk/Interview Room, Engineer/Commander and Navigator/Quartermaster. Internally they are role A and role B. Teammates claim roles in the team lobby before each attempt. The role decides which half of every clue that player receives.

## 3. Scope and constraints

Version 1 is an asynchronous team competition: 2-player teams, challenges with time windows, 4 themes, points-based leaderboards, a practice mode, an admin panel and hosted deployment.

**In scope (v1)**

- Accounts (signup, login, logout, profile), organizer and admin roles, and guest play limited to practice
- Named 2-player teams with captain, invite code and team profile
- Challenges: event challenges (public, by organizers) and private challenges (code-only, by any player), each with a start and end time
- One attempt per team per challenge; every team gets the same generated level values
- Team lobby with role claiming and ready state; the attempt starts when both teammates are ready
- 4 themes × 5 levels; values generated once per challenge
- Clue halves in 6 display types (text, tokens, symbols, table, grid, strip)
- Server-checked answers; points per level, reduced by time taken, wrong answers and hints
- An extra team hint per level that unlocks after 90 seconds and costs points
- Shared team board holding earlier levels' rewards
- Team chat (private to the team) with system messages; chat log on the results screen
- Server-owned countdown per attempt; pause and resync when a teammate disconnects
- Challenge leaderboard that updates as teams finish; final ranking when the window closes
- Practice mode: any 2 players (guests included) via a room code, fresh random values, unranked
- Admin CRUD for themes and levels; admin grants the organizer role
- Sound effects with mute, a themed UI, fully responsive down to phone width (360 px)
- Hosted deployment

**Out of scope (v1).** Teams larger than 2, challenges with more than one theme, live head-to-head matches, stopping teams from sharing answers outside the app (accepted risk), voice chat, background music, achievements, spectators, and localisation.

**Constraints**

| Constraint | Detail |
| --- | --- |
| Course | Must use and visibly demonstrate MERN: MongoDB, Express, React, Node.js. MVC structure is assessed (CO1–CO4). |
| Real-time | Socket.io on the same Node/Express server, for team chat and in-attempt sync. An addition beyond the syllabus. |
| Team | Solo developer, so the scope is phased (section 11) and each phase can be demoed on its own |
| Hosting | Free tiers only. The backend host must support WebSockets. |
| Assessment | Demoed live in the SEE lab (design 20, presentation 20, viva 10) and in EL Phase I and Phase II |

**Technology stack (decided)**

| Layer | Choice |
| --- | --- |
| Language | JavaScript only (`.js` on the server, `.jsx` for React). No TypeScript. |
| Frontend | React with Vite, React Router, socket.io-client and PropTypes. State with React Context and hooks; no Redux. |
| Styling | Plain CSS with CSS custom properties. One stylesheet per escape-room theme, switched by a `data-theme` attribute on the page root. No CSS framework or component library. |
| Backend | Node.js (current LTS), Express, Socket.io on the same HTTP server, MVC folders: `models`, `controllers`, `routes`, `services`, `sockets`, `middleware`, `generators`. |
| Database | MongoDB Atlas (free M0 cluster) with Mongoose |
| Auth | JWT as a Bearer token, stored in localStorage on the client; bcrypt for passwords. The Socket.io handshake sends the same token. |
| Validation | Regular expressions on every client form; server-side validation middleware (express-validator) on every route |
| Security middleware | helmet, cors (frontend origin only), express-rate-limit |
| Testing | Backend only. Jest + Supertest for REST routes; unit tests for every generator, answer normalization and scoring; Socket.io integration tests for a full attempt; mongodb-memory-server as the test database. No automated frontend tests. |
| Hosting | Frontend on Vercel, backend on Render (web service), database on MongoDB Atlas M0 |
| Assets | Sound effects made with the Web Audio API, or small royalty-free files bundled in the repo. Shapes and symbols drawn as inline SVG React components. |
| Seed data | A seed script creates the 4 themes, their 20 level templates and an admin account taken from environment variables. |
| Repository | One repo with `client/` and `server/` folders, a root README with setup and deploy steps, and `.env.example` files for both. |

## 4. User journeys

A team enters a challenge, meets in its team lobby and plays one attempt. Its result goes straight onto the challenge leaderboard, next to every other team that played the same levels.

&#91;embedded content: user journeys · player and admin\]

A disconnect pauses the attempt. If the teammate returns within 60 seconds, play resumes. Otherwise the attempt ends early and keeps the points already earned. Practice mode follows the same lobby, attempt and results steps, with a room code instead of a challenge, and is never ranked.

**Inside an attempt**, each level runs the same loop:

1. The level unlocks. Player A sees clue half A, player B sees clue half B, and the level timer starts.
2. The teammates describe their halves to each other in team chat.
3. Either teammate submits an answer.
4. Wrong: both see −10 points on that level, and it stays open. Correct: both see the points earned, the reward goes onto the team board, and the next level unlocks.
5. After level 5 (or when time runs out), the results screen shows the points breakdown and the team's current rank.

## 5. Functional requirements

There are 79 requirements across 12 modules. Priority: **M** = must (needed for the demo), **S** = should (needed for full marks), **C** = could (polish).

### 5.1 Accounts (AUTH)

| ID | Requirement | Pri |
| --- | --- | --- |
| AUTH-1 | Sign up with username (3–20 characters: letters, digits, underscore), email and password (at least 8 characters, with a letter and a digit). Each field is checked with a regular expression on the client and again on the server. | M |
| AUTH-2 | Log in with email and password and receive a signed token. Passwords are stored hashed. | M |
| AUTH-3 | Guest entry with a nickname gives a 24-hour guest token, valid for practice mode only. | S |
| AUTH-4 | Pages that need login redirect to the login page and return to the original page afterwards (including invite and challenge links). | M |
| AUTH-5 | Log out clears the token on the client. | M |
| AUTH-6 | Player profile: username, join date, teams, challenges played, total points and best rank. | S |
| AUTH-7 | Edit profile: change username and avatar colour. | C |

### 5.2 Teams (TEAM)

| ID | Requirement | Pri |
| --- | --- | --- |
| TEAM-1 | Create a team with a unique name (3–24 characters). The creator becomes captain and gets an 8-character invite code and link. | M |
| TEAM-2 | Join a team with its invite code or link. Refused if the team already has 2 members. | M |
| TEAM-3 | My Teams page lists each team, its partner and its challenge record. | M |
| TEAM-4 | The captain can rename the team, generate a new invite code (the old one stops working) and remove the partner. | S |
| TEAM-5 | A member can leave the team. A team whose only member leaves is archived; its past results are kept. | S |
| TEAM-6 | Team profile page: members, challenges entered, points, ranks and stars per challenge. | S |
| TEAM-7 | Team membership can't change while the team has an attempt in progress. | M |

### 5.3 Challenges (CHAL)

| ID | Requirement | Pri |
| --- | --- | --- |
| CHAL-1 | Create a challenge: name, theme, window start and end (end at least 15 minutes after start, at most 30 days later), and visibility. Organizers can choose public or private; players can create private only. | M |
| CHAL-2 | When a challenge is created, the server generates its 5 levels once and saves them. Every team plays these exact values. | M |
| CHAL-3 | Each challenge gets a 6-character code and link. A private challenge is reachable only through them. | M |
| CHAL-4 | Challenges page lists public challenges as upcoming, open or closed, with a filter form by theme and status. | S |
| CHAL-5 | Challenge page: name, theme story, window with a countdown, number of teams entered, and the leaderboard. | M |
| CHAL-6 | A team enters a challenge by picking one of the player's teams. Refused if either teammate is already in that challenge with another team, or if the team has already entered. Until its attempt starts, an entered team may replace its partner (remove, then invite). The new partner is checked by the same rule. | M |
| CHAL-7 | An attempt can start only while the window is open. An attempt started before the window closes may run to the end of its own timer. | M |
| CHAL-8 | The creator can edit the name and window before the start, and delete a challenge that no team has entered yet. | S |
| CHAL-9 | The creator can set an optional maximum number of teams. | C |
| CHAL-10 | After the window closes and every attempt has ended, the challenge shows final results, and each level's answer and explanation are revealed. | C |

### 5.4 Team lobby (LOBBY)

| ID | Requirement | Pri |
| --- | --- | --- |
| LOBBY-1 | Opening an entered challenge puts the teammate in the team lobby. It shows which teammates are online, the theme, roles, the timer length and a scoring summary. | M |
| LOBBY-2 | Each teammate claims role A or B. A claimed role is locked for the partner. | M |
| LOBBY-3 | When both teammates are online, have roles and press Ready, a 5-second countdown starts the attempt. Either one can cancel during the countdown. | M |
| LOBBY-4 | The lobby warns that there is only one attempt and that it can't be paused by leaving. | M |
| LOBBY-5 | Team chat is already available in the lobby. | S |

### 5.5 Attempt gameplay (GAME)

| ID | Requirement | Pri |
| --- | --- | --- |
| GAME-1 | When the attempt starts, the server copies the challenge's levels into the attempt and starts the timer. | M |
| GAME-2 | Each teammate receives only their own role's clue half for the current level. Answers and the partner's half never reach the client. | M |
| GAME-3 | Levels unlock one at a time, in order. Both teammates are always on the same level. | M |
| GAME-4 | Either teammate can submit an answer. The server normalizes it and compares it with the accepted answers (6.4). | M |
| GAME-5 | Correct: both teammates see the points earned, the reward is added to the board, and the next level unlocks within 1 second. | M |
| GAME-6 | Wrong: both teammates see the submitted text and the point deduction, and the level stays open. | M |
| GAME-7 | Submissions are processed one at a time per attempt. Answers to an already solved level are ignored. | M |
| GAME-8 | Shared team board shows the rewards of solved levels (fragments, digits, case entries or answers, by theme). | M |
| GAME-9 | Level bar showing 5 levels, each marked solved (with its points), current or locked, plus a running score. | M |
| GAME-10 | The extra hint unlocks 90 seconds into a level. Either teammate can reveal it after confirming the cost; both then see it. | S |
| GAME-11 | The attempt ends when level 5 is solved (finished) or the timer reaches 0 (timed out). Both teammates go to the results screen. | M |
| GAME-12 | A teammate can end the attempt early after confirming. Points from solved levels are kept. | S |

### 5.6 Team chat (CHAT)

| ID | Requirement | Pri |
| --- | --- | --- |
| CHAT-1 | Chat is private to the team: messages up to 300 characters, delivered in under 1 second, showing the sender's role name and the time. | M |
| CHAT-2 | System messages in the chat stream: teammate joined or left, level solved with its points, wrong answer, hint unlocked or revealed, timer warnings, pause and resume. | M |
| CHAT-3 | Messages are saved with the attempt. A reconnecting teammate gets the full log. | S |
| CHAT-4 | The results screen shows the full chat log. Only the team can see it. | S |
| CHAT-5 | Message text is shown as plain text (no HTML). | M |
| CHAT-6 | A player can send at most 5 messages in 3 seconds. | C |

### 5.7 Timer and connection (TIME)

| ID | Requirement | Pri |
| --- | --- | --- |
| TIME-1 | The server stores the attempt's end time and broadcasts the remaining time every second. Clients only display it. | M |
| TIME-2 | Warnings at 5 minutes, 1 minute and 10 seconds remaining. | S |
| TIME-3 | If a teammate disconnects, the timer pauses and the partner sees a 60-second reconnect countdown, within a pause budget of 3 minutes per attempt. | S |
| TIME-4 | A teammate who reconnects gets a full snapshot: current level, own clue half, board, chat, remaining time, score and hint state. | S |
| TIME-5 | If the teammate doesn't return within 60 seconds, the attempt ends. Points from solved levels are kept. | S |
| TIME-6 | Refreshing the page counts as a disconnect followed by a reconnect. | S |

### 5.8 Scoring and leaderboards (SCORE)

| ID | Requirement | Pri |
| --- | --- | --- |
| SCORE-1 | Points are calculated on the server using the rules in 7.3. | M |
| SCORE-2 | Results screen: levels cleared, points per level, completion bonus, total, stars, wrong answers, hints, time used, current rank and chat log. | M |
| SCORE-3 | Challenge leaderboard: rank, team, points, levels cleared, time used and stars. Ties are broken as in 7.3. Every player can see the full leaderboard at all times. While the window is open it is marked provisional and refreshes as teams progress. | M |
| SCORE-4 | The leaderboard lists teams that are playing right now as in progress, with the level they have reached. | S |
| SCORE-5 | The creator and organizers see every entered team's status: not started, in progress, finished or ended early. | S |
| SCORE-6 | Overall team ranking per theme: each team's best challenge result. | C |
| SCORE-7 | Game history on the player and team profiles: challenge, theme, team, points, rank and date, newest first, 10 per page. | S |

### 5.9 Practice mode (PRAC)

| ID | Requirement | Pri |
| --- | --- | --- |
| PRAC-1 | Any player or guest can create a practice room for a theme and share its 6-character room code with one partner. | S |
| PRAC-2 | Practice uses the same lobby, gameplay, chat, timer and scoring, with values generated fresh for each game. | S |
| PRAC-3 | Practice results are shown but never ranked or saved to a team. | S |
| PRAC-4 | Practice rooms with no activity for 30 minutes expire. | C |

### 5.10 Admin panel (ADMIN)

| ID | Requirement | Pri |
| --- | --- | --- |
| ADMIN-1 | Admin routes are protected by role on both the client and the server. | M |
| ADMIN-2 | Themes: list, create, view, edit, delete. Fields: name, slug, story, role names and descriptions, timer minutes, visual style key, reveal and failure text, active flag. | M |
| ADMIN-3 | Levels inside a theme: list, create, edit, delete, reorder. Fields: title, order, mechanic, parameters, clue templates, hint, reward rule, time estimate. | M |
| ADMIN-4 | A theme can be activated only when it has exactly 5 valid levels. | S |
| ADMIN-5 | Preview: generate a sample set and view clue A, clue B and the answer side by side. | S |
| ADMIN-6 | Users: search by username or email, and grant or remove the organizer role. | S |
| ADMIN-7 | Deleting a theme is a soft delete. Challenges that used it keep their saved levels and results. | S |
| ADMIN-8 | Admin list pages have a search box and filters. | C |

### 5.11 Audio (AUDIO)

| ID | Requirement | Pri |
| --- | --- | --- |
| AUDIO-1 | Sound effects for correct answer, wrong answer, level unlock, hint ready, timer warning, finish and time-out. | S |
| AUDIO-2 | A mute toggle remembered on the device. Muted until the player first interacts, as browsers require. | S |

### 5.12 Interface and theming (UI)

| ID | Requirement | Pri |
| --- | --- | --- |
| UI-1 | Pages: landing, login, signup, guest entry, dashboard, my teams, team page, join team, challenges list, create challenge, challenge page and leaderboard, team lobby, attempt, results, practice create/join, profile, admin (themes, levels, preview, users) and 404. | M |
| UI-2 | Each theme restyles the lobby, attempt and results pages: colours, fonts, textures and timer style. | S |
| UI-3 | Fully usable from 360 px phone width up to desktop. On phones the attempt screen has tabs for Clue, Board and Chat. | M |
| UI-4 | Loading, empty and error states on every page that loads data. | S |
| UI-5 | Short animations for unlock, solve, wrong answer and the reveal, turned off when the user prefers reduced motion. | C |

## 6. Level system

Levels are stored as **templates** and turned into a concrete **level set** once for each challenge. A template names a mechanic and its parameter ranges. The server runs that mechanic's generator to pick values and build clue A, clue B and the answer. Every team in a challenge plays the same level set, so scores can be compared directly. A new challenge of the same theme gets new values, so an old challenge's answers don't help. Practice games generate a fresh set for each game.

### 6.1 How generation works

1. When a challenge is created (or a practice game starts), the server loads the theme's 5 templates in order.
2. It creates a random seed and saves it with the challenge, so the level set can be regenerated for debugging.
3. Each template's generator runs in order and receives a **context** with earlier levels' answers and rewards. This is how carry-over levels and finales reference earlier results.
4. Each generated level is checked: exactly one valid answer, answer at most 8 characters, and no single clue half that shows the answer by itself. If a check fails, the generator retries with a new seed, up to 20 times. If every retry fails, the fixed values from the *Themed Puzzle Sets* document are used.
5. The level set is saved on the challenge and copied into each attempt when it starts. Clue halves go only to the matching role. Answers are never sent to clients.

Admins can build new levels and themes from the **existing mechanics** with no code changes. A new mechanic needs a new server-side generator and, if necessary, a new clue display type. Editing a theme's templates affects only challenges created afterwards.

### 6.2 Mechanics

| Mechanic | Role A gets | Role B gets | What is randomized |
| --- | --- | --- | --- |
| Decode and Key | Values tagged with colours or labels | The order to enter them in | Values, tags, order |
| Caesar Cipher | Encrypted word | Shift rule + alphabet strip | Word from a pool, shift 1–9 |
| Rule Filter | A list or table of items | A rule that leaves the answer | Items, attributes, rule variant |
| Describe and Match | A row of symbols or shapes | Legend mapping symbols to values (with decoys) | Symbols, mapping, decoys |
| Ordering | Items with numeric values | Sort direction + output format | Values, direction |
| Grid Lookup | A grid with one marked cell | Column and row labels | Cell position, labels |
| Grid Navigation | Start point + moves | Labelled map with landmarks | Landmark positions, start, moves |
| Morse | Morse code signal | Morse chart | Word from a pool |
| Split Riddle | First half of a riddle | Second half | Riddle from a pool |
| Arithmetic Split | A reading (e.g. a clock) | A correction rule | Reading, correction amount |
| Fragment Finale | Order of the earlier puzzles | Rewards of the earlier puzzles (also on the board) | Target word or code, order |

### 6.3 Clue display types

The client renders each clue with one of 6 display types. Each type receives structured data, not free text.

| Type | Shows | Used by |
| --- | --- | --- |
| text | Paragraphs: riddles, statements, rules | Most puzzles |
| tokens | A row of coloured chips with a value or label | Access PIN, Oxygen Valves, Power Routing |
| symbols | A row of icons from a built-in icon set | Glyph Keypad, Pirate Code |
| table | Rows and columns | Server Reboot, size chart, alibis, Morse chart, legends |
| grid | An n × m grid with marked cells and optional axis labels | Star Map, Island Walk |
| strip | An alphabet strip with optional shift arrows | Caesar puzzles |

### 6.4 Answer rules

- Answers are normalized on both sides before comparison: converted to uppercase, with every character that is not a letter or digit removed. So `11:25` and `1125` both match.
- List answers are the exception. Separators are collapsed into one dash instead of removed, so `3, 7, 9`, `3 7 9` and `3-7-9` all become `3-7-9`. This stops two different ID lists from producing the same string. A list typed with no separators (`379`) is not accepted.
- Each instance stores an `acceptedAnswers` list for valid alternatives.
- Answer length limits: codes of up to 4 digits, words of up to 8 letters.

### 6.5 Themes and randomization rules

The theme stories, roles and visual styles follow the *Themed Puzzle Sets* document. The table below shows which values change from one challenge to the next.

| Theme (timer) | # | Puzzle | Mechanic | What changes each game |
| --- | --- | --- | --- | --- |
| Cyber Heist – Operation Blackout (15 min) | 1 | Access PIN | Decode and Key | 4 distinct digits, their colours, and the entry order |
|  | 2 | Firewall | Caesar Cipher | Word from a pool of 8+ (SECURITY, FIREWALL, PASSWORD…), shift 1–5 |
|  | 3 | Server Reboot | Rule Filter | 6 server IDs (1–30), which 3 are offline, sort direction |
|  | 4 | Glyph Keypad | Describe and Match | 4 shapes from 6, shape-to-digit legend, 1–2 decoys |
|  | 5 | Vault Finale | Fragment Finale | 4-letter word from a pool (BYTE, CODE, ROOT, NODE…); its letters are given out as rewards for puzzles 1–4 in random order |
| Detective – Murder at Blackwood Manor (20 min) | 1 | Stopped Clock | Arithmetic Split | Murder time 11:05–11:35 PM, clock error 10/15/20 minutes fast |
|  | 2 | Alibi Check | Rule Filter | Alibis built around the murder time: exactly 1 suspect cleared; the killer is never cleared |
|  | 3 | Footprint | Rule Filter | Print length 22–27 cm, giving shoe size 5–10 |
|  | 4 | Murder Weapon | Describe and Match | Weapon and wound description from a pool of 5 |
|  | 5 | Dying Message | Caesar Cipher (carry-over) | Killer chosen from the 3 uncleared suspects; their name is encoded with shift = shoe size from puzzle 3 |
| Space Station – Station Helios Emergency (15 min) | 1 | Oxygen Valves | Ordering | 4 distinct pressures, lowest-first or highest-first |
|  | 2 | Star Map | Grid Lookup | Star position on the 4 × 4 grid, column letters, row numbers |
|  | 3 | Power Routing | Decode and Key | Cable order, cable-to-port mapping |
|  | 4 | Distress Signal | Morse | Word from a pool (EARTH, HELP, MAYDAY…) |
|  | 5 | Escape Pod Launch | Fragment Finale | Distinct digit rewards 1–9 for puzzles 1–4, finale order |
| Pirate – Blackbeard's Lost Treasure (18 min) | 1 | Torn Parchment | Split Riddle | Riddle from a pool of 6+ |
|  | 2 | Island Walk | Grid Navigation | Landmark positions on the 5 × 5 grid, start point, 3 moves that stay on the map and end on a landmark |
|  | 3 | Pirate Code | Describe and Match | Word from a pool (CANNON, PARROT, SAILOR…), symbol legend, 2 decoys |
|  | 4 | Cursed Chest | Rule Filter | 5 items with random colours and types; rule variant leaves exactly 1 |
|  | 5 | Captain's Password | Fragment Finale | The generator first picks a 4-letter finale word from a pool (CAVE, COVE, CODE, MAPS…), then chooses answers for levels 1–4 whose first letters spell it, in a random order. The answer is always a real word |

The Detective theme is the most sensitive to randomization. Its generator must keep the story consistent: the shoe size, the uncleared suspects and the encoded name all have to point to the same killer. The reveal screen states the killer's name and shoe size from the instance.

## 7. Game rules

Each level is worth up to 100 points. Points drop with time taken, wrong answers and hints, and clearing all 5 levels adds a bonus for time left. Each team gets one attempt per challenge, with its own server-owned timer.

### 7.1 Challenge window and attempts

- A challenge is **upcoming** before its start time, **open** during its window, **closing** after the end time while attempts are still running, and **closed** once every attempt has ended.
- A team can start its single attempt at any time while the challenge is open. Its timer is the theme's length (15, 20, 15 or 18 minutes), whatever the time of day.
- An attempt started before the window ends runs to the end of its own timer. Entered teams that never started get no score and are listed as “did not start”.
- Rankings are provisional while the challenge is open or closing, and final when it is closed.

### 7.2 Timer

- The server saves `endsAt` when the attempt starts. Remaining time = `endsAt` − now, broadcast every second. Clients never count down on their own.
- When remaining time reaches 0, the attempt times out. A submission that arrives after `endsAt` is rejected.
- Wrong answers and hints cost points, not time.

### 7.3 Points

The points for a solved level are:

```latex
\text{level points} = \max\bigl(30,\; 100 - \lfloor (t - 60)^{+} / 6 \rfloor - 10w - 25h\bigr)
```

- *t* = seconds spent on the level, from unlock to solve, excluding paused time. The first 60 seconds are free; after that, 1 point is lost every 6 seconds.
- *w* = wrong answers on that level; each costs 10 points.
- *h* = 1 if the extra hint was revealed; it costs 25 points.
- A solved level is always worth at least 30. An unsolved level is worth 0.
- **Completion bonus:** if all 5 levels are cleared, add 1 point for every 5 seconds left on the timer.
- **Example:** solved in 3 minutes with 1 wrong answer and no hint: 100 − 20 − 10 = 70 points.

**Ranking order** on a leaderboard: 1. total points, 2. levels cleared, 3. less time used, 4. earlier finish.

### 7.4 Wrong answers

- Each wrong answer costs 10 points on the current level. Both teammates see it.
- To prevent spamming, each player can submit at most one answer every 2 seconds. Submissions rejected for this reason cost nothing.
- There is no lockout. The point cost replaces the 5-attempt lockout from the puzzle document.

### 7.5 Extra hint

- Separate from the clue halves, each level has 1 extra team hint. It unlocks 90 seconds after the level opens (paused time excluded).
- Either teammate can reveal it after confirming its 25-point cost. It then shows for both, and is recorded in chat.

### 7.6 Disconnects

- If a teammate's connection drops during an attempt, the server pauses it. `endsAt` is extended by the paused time when play resumes, and the level timer *t* also stops.
- The partner sees “Waiting for \[role\] to reconnect — 0:60”. Chat stays open.
- If the teammate returns within 60 seconds, they get a full snapshot and the attempt resumes.
- If they don't return, or both teammates are gone for 60 seconds, the attempt ends early and keeps the points already earned. There is no second attempt.
- **Abuse guard.** Each attempt has a pause budget of 3 minutes. After it is used up, disconnects no longer pause the timer, though the 60-second rule still applies.

### 7.7 Attempt states

| State | Entered when | Leaves to |
| --- | --- | --- |
| entered | The team enters the challenge | lobby (a teammate opens it) |
| lobby | A teammate opens the challenge while it is open | countdown (both ready) |
| countdown | Both teammates are ready (5 seconds) | lobby (cancelled), in\_progress |
| in\_progress | The countdown ends, or play resumes after a pause | paused, finished, timed\_out, ended\_early |
| paused | A teammate disconnects and pause budget remains | in\_progress (they return), ended\_early (60 seconds pass) |
| finished | Level 5 is solved | (final) |
| timed\_out | Time reaches 0 | (final) |
| ended\_early | A teammate quits, or a reconnect times out | (final) |

### 7.8 Stars

| Stars | Condition |
| --- | --- |
| ★ | All 5 levels cleared |
| ★★ | All 5 cleared and at least 350 points |
| ★★★ | All 5 cleared and at least 450 points |

Stars are a quick summary for profiles. Rankings always use points.

## 8. Non-functional requirements

Each target below is measurable, so it can be checked during testing (section 11).

| ID | Area | Requirement |
| --- | --- | --- |
| NFR-1 | Security | Answers and the partner's clue half are never sent to the browser. Checked by inspecting all socket and HTTP payloads during a full attempt. |
| NFR-2 | Security | Passwords are hashed with a slow algorithm (bcrypt, cost 10 or more). Tokens are signed and expire (7 days for accounts, 24 hours for guests). |
| NFR-3 | Security | Every REST route and socket event checks the token. Socket events also check that the sender is a member of that team and attempt, and holds the right role. |
| NFR-4 | Isolation | A team's chat, clues, board and progress events go only to that team's socket room. Other teams see only leaderboard data. |
| NFR-5 | Security | All input is validated on the server. Chat and names are shown as plain text. Database queries never use raw user objects (prevents NoSQL injection). |
| NFR-6 | Security | The login and signup endpoints allow at most 10 attempts per minute per IP address. |
| NFR-7 | Integrity | Points, ranks and stars are calculated only on the server. A team can't start a second attempt at the same challenge (enforced by a unique index on challenge + team). |
| NFR-8 | Consistency | The server is the only source of truth. A client reloaded at any moment shows exactly the server's state within 2 seconds. |
| NFR-9 | Consistency | Submissions within an attempt are processed one at a time. A level can be solved only once (atomic database update). |
| NFR-10 | Performance | Chat and game events reach the teammate in under 500 ms on a normal connection. The timer on both screens differs by at most 1 second. |
| NFR-11 | Performance | A challenge leaderboard of 100 teams loads in under 1 second. |
| NFR-12 | Performance | First page load is under 3 seconds on 4G. JavaScript bundle under 300 KB gzipped, with admin pages loaded only when needed. |
| NFR-13 | Scalability | Handles 25 attempts at once (50 players, e.g. a class contest) on a free-tier server without breaking NFR-10. |
| NFR-14 | Availability | The hosted demo is reachable on the demo day. A cold start on a free host is warmed up before the demo. |
| NFR-15 | Responsiveness | Every page works from 360 px to 1920 px wide with no horizontal scrolling. Touch targets are at least 44 px. |
| NFR-16 | Accessibility | Text contrast is at least 4.5:1 in every theme. All controls work with the keyboard. Correct and wrong are shown by an icon and text, not colour alone. Reduced-motion settings are respected. |
| NFR-17 | Browser support | Latest 2 versions of Chrome, Edge, Firefox and Safari, on desktop and mobile. |
| NFR-18 | Time zones | Challenge windows are stored in UTC and shown in each viewer's local time. |
| NFR-19 | Maintainability | Backend arranged as MVC: models, controllers, routes, services, sockets. Settings in environment variables. A README with setup steps. |
| NFR-20 | Reliability | One error handler on the server returns `{ error, message }` with the correct HTTP status code. The client shows a friendly message and never a blank page. |

## 9. Data model, API and real-time events

This section is conceptual. It fixes *what* is stored and exchanged. Exact field types and extra indexes are left to the implementation, as long as these rules hold. REST handles accounts, teams, challenges, leaderboards and admin. Socket.io handles everything live inside a team's attempt, plus leaderboard refreshes.

### 9.1 Collections

| Collection | Key fields | Notes |
| --- | --- | --- |
| users | username, email, passwordHash, roles (player, organizer, admin), avatarColor, createdAt | Guests are not stored; a guest token carries a guestId and nickname |
| teams | name, captainId, memberIds (at most 2), inviteCode, archived, createdAt | Unique team name |
| themes | slug, name, story, roles {A, B}, timerMinutes, styleKey, revealText, failText, active, deletedAt | Soft delete |
| leveltemplates | themeId, order (1–5), title, mechanic, params, clueTemplates {A, B}, hint, rewardRule, estMinutes | Pools and ranges for the generator |
| challenges | code, name, themeId, creatorId, visibility, startsAt, endsAt, maxTeams, seed, levels \[generated level\], createdAt | The one shared level set. Answers live here and never leave the server |
| attempts | challengeId (empty for practice), teamId, practiceCode, memberIds, players \[{id, name, role, ready, connected}\], status, levels \[generated level + progress\], board, startedAt, endsAt, pausedAt, pauseUsedMs, totalPoints, levelsCleared, timeUsedMs, bonus, stars, finishedAt | Created when a team enters (status `entered`). Unique on challengeId + teamId, and on challengeId + each memberId |
| messages | attemptId, kind (user or system), senderName, role, text, createdAt | Separate from attempts so they don't grow without limit |

One **level progress** entry holds: unlockedAt, activeMs (time on the level, excluding pauses), wrongCount, hintRevealedAt, solvedAt, solvedBy and points.

Leaderboards and history are **queries on `attempts`**, sorted by the ranking order in 7.3. They are not stored separately, so they can't drift out of sync.

### 9.2 REST API

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| POST | /api/auth/signup · /login · /guest | Create account, log in, get a guest token | — |
| GET | /api/auth/me | Current user or guest | Any |
| GET PATCH | /api/users/me | Read or edit my profile | Player |
| GET | /api/users/me/history?page= | My challenge history | Player |
| POST | /api/teams | Create a team | Player |
| GET | /api/teams/mine | My teams | Player |
| GET PATCH | /api/teams/:id | Team profile; rename (captain) | Player |
| POST | /api/teams/join | Join with an invite code | Player |
| POST | /api/teams/:id/invite-code | Generate a new invite code | Captain |
| DELETE | /api/teams/:id/members/:userId | Remove the partner, or leave | Captain or self |
| GET | /api/themes | Active themes | Any |
| GET | /api/challenges?status=&theme= | Public challenges (filter form) | Any |
| POST | /api/challenges | Create a challenge and generate its level set | Player (private), Organizer (public) |
| GET | /api/challenges/:code | Challenge page data | Player |
| PATCH DELETE | /api/challenges/:id | Edit before start; delete if no team has entered | Creator |
| POST | /api/challenges/:id/entries | Enter with a team | Team member |
| GET | /api/challenges/:id/leaderboard | Ranked results | Player |
| GET | /api/challenges/:id/teams | Every team's status | Creator or Organizer |
| GET | /api/challenges/:id/solutions | Answers and explanations, after closing | Player |
| GET | /api/attempts/:id/result | Results, breakdown and chat log | That team |
| POST | /api/practice | Create a practice room | Any |
| GET | /api/practice/:code | Practice room preview | Any |
| GET POST | /api/admin/themes | List, create themes | Admin |
| GET PUT DELETE | /api/admin/themes/:id | Read, update, soft-delete a theme | Admin |
| GET POST | /api/admin/themes/:id/levels | List, create levels | Admin |
| PUT DELETE | /api/admin/levels/:id | Update, delete a level | Admin |
| PATCH | /api/admin/themes/:id/levels/order | Reorder levels | Admin |
| POST | /api/admin/themes/:id/preview | Generate a sample level set | Admin |
| GET PATCH | /api/admin/users?q= · /api/admin/users/:id/roles | Find users; grant or remove organizer | Admin |

### 9.3 Socket events

Each attempt has its own socket room that only its 2 players can join. Challenge pages join a read-only leaderboard room. Every event checks the token, membership and, where it matters, the role.

| Direction | Event | Payload | Effect |
| --- | --- | --- | --- |
| client → server | attempt:join | attemptId or practiceCode | Join the team's room; the server replies with a snapshot |
| client → server | lobby:claimRole / lobby:releaseRole | role | Claim or release role A or B |
| client → server | lobby:ready / lobby:cancel | — | Ready up, or cancel the countdown |
| client → server | chat:send | text | Post a team message |
| client → server | level:submit | order, answer | Submit an answer for the current level |
| client → server | hint:reveal | order | Reveal the extra hint (costs 25 points) |
| client → server | attempt:quit | — | End the attempt early |
| client → server | leaderboard:watch | challengeId | Follow a challenge's leaderboard |
| server → client | attempt:snapshot | Full state for **this** player (own clue half only) | On join, start and reconnect |
| server → client | lobby:update | players, roles, ready flags, countdown | Any lobby change |
| server → client | attempt:tick | remainingMs | Every second |
| server → client | level:result | order, correct, submittedBy, text, points or deduction | After each submission |
| server → client | level:unlocked | order, title, own clue half | Next level opens (each player gets only their own half) |
| server → client | board:update | board entries, running score | After a solve |
| server → client | hint:available / hint:revealed | order, hint text when revealed | 90 seconds in, and when revealed |
| server → client | chat:message | message | Team or system message |
| server → client | attempt:paused / attempt:resumed | who, graceMs | Disconnect and reconnect |
| server → client | attempt:ended | status, total, breakdown, stars, rank, reveal text | Finished, timed out or ended early |
| server → client | leaderboard:update | ranked rows, in-progress teams with level reached | A team in this challenge starts, solves a level or finishes |
| server → client | error | code, message | Rejected action |

## 10. Syllabus mapping (MCA261IA)

Every unit, course outcome and most lab exercises map to a concrete feature, so the viva can be answered from this project's own code.

### 10.1 Units

| Unit | Syllabus topics | Where it appears in the project |
| --- | --- | --- |
| I | Full stack and MERN, MVC, Node modules (CommonJS, core, third-party, file), event-driven programming, closures, Express app, request and response objects, middleware | MVC backend; Node `crypto` for codes and seeds, `events`/Socket.io for game events; closures in the timer and per-attempt state; Express middleware for auth, validation, rate limiting and errors |
| II | React components and classes, JSX, props and property validation, children, dynamic composition, state, events, child-to-parent communication, stateless components | Clue renderer composed by display type; PropTypes on every shared component; `children` in the themed layout; answer box passes submits up to the game page; a class component for the timer display; stateless display components |
| III | NoSQL, MongoDB CRUD, Mongoose schemas and models, find / findOne / save / update / delete, defaults, schema modifiers, custom getters and setters | 7 collections; defaults (`status: 'entered'`, `stars: 0`); setter that uppercases challenge, team and practice codes; getter that formats time used; validators on usernames and puzzle order |
| IV | REST, HTTP methods as actions, JSON, routing, handler functions, list and create APIs, error handling | REST API in 9.2, with list and create for teams, challenges, themes and levels; central error handler (NFR-16) |
| V | React Router: simple routes, route params, query strings, programmatic routing, nested routes, browser history; forms, filter form, Get, edit page, Update and Delete APIs | `/challenge/:code` and `/teams/join/:code` params; `?`status=open&theme= on the challenges list; redirect after creating a team or challenge, joining and login; nested `/admin/themes/:id/levels`; admin edit pages with Update and Delete; admin filter form |

### 10.2 Course outcomes

| CO | How the project shows it |
| --- | --- |
| CO1: MVC concepts | The backend folders follow MVC. The viva can trace one request, e.g. submitting an answer from the React view, through the controller and service, to the model. |
| CO2: Apply MVC with MERN | React = view, Express controllers = controllers, Mongoose = models, all across one feature (challenges) |
| CO3: Design and develop a full-stack app | The whole hosted product |
| CO4: Analyze structure and function | This PRD, the MVC code structure and the automated test report (section 11) |

### 10.3 Lab exercises reused

| Lab | Reused as |
| --- | --- |
| 1. Node CRUD (book cart) | Admin CRUD for themes and levels; team CRUD |
| 2. Express GET and POST forms | Auth, team and challenge-creation endpoints |
| 4. Components, state and props | Lobby and game screens |
| 5. Form validation with regular expressions | Signup, login, guest and join forms (AUTH-1) |
| 6. React ↔ Node connectivity | Whole client–server integration |
| 7. Comparison and logical selectors | Leaderboard and history queries (`$gte`, `$and`, `$in`) |
| 8. Aggregation pipeline | Leaderboard ranking and profile stats: points, ranks, best result per theme |
| 9. REST APIs in React | Admin panel and leaderboard |
| 10. react-router-dom multiple pages | All routes (UI-1) |

## 11. Release phases and acceptance criteria

The build runs in 6 phases. Each one ends in something that can be demoed, so a solo developer always has a working product to show. Phases 2 and 4 line up with EL Phase I and Phase II.

1. **Foundation.** MVC skeleton, database connection, signup and login, teams (create, join with invite code, my teams), router shell, and the first deployment to the hosting platform. *Gate:* on the hosted URL, two accounts form a team.
2. **Core attempt (EL Phase I).** Socket.io, team lobby with roles and ready state, team chat, server timer, Cyber Heist with fixed values, answer checking, points and the results screen. Played through a practice room. *Gate:* two devices finish Cyber Heist over the internet and see the same score.
3. **Challenges and level engine.** Creating challenges with windows, entering with a team, one-attempt rule, all 11 mechanic generators, the 6 clue display types, seeding script for the 4 themes, shared board and extra hints. *Gate:* 2 teams play the same challenge and get identical levels; a second challenge gets different values.
4. **Competition and resilience (EL Phase II).** Challenge leaderboard with live updates, in-progress status, creator's team view, final results when the window closes, disconnect, pause and resync, profiles and history. *Gate:* 3 teams finish one challenge and are ranked correctly; refreshing mid-attempt restores state.
5. **Admin and organizers.** CRUD for themes and levels, reorder, preview, activation checks, soft delete, granting the organizer role, public event challenges, challenges list with filters, practice mode for guests. *Gate:* a theme built only through the admin panel can be used in a public challenge.
6. **Polish and hardening.** Per-theme styling, phone layouts, audio, accessibility, security checks, tests, README and demo script. *Gate:* every acceptance check below passes on the hosted build.

### Acceptance checks

- [ ] 3 teams on different networks finish the same challenge on the hosted URL; the leaderboard ranks them by the 7.3 order.
- [ ] All teams in one challenge receive identical clues and answers; a new challenge of the same theme differs in at least 4 of the 5 levels.
- [ ] During a full attempt, the network tab and React state never contain an answer or the partner's clue half (NFR-1).
- [ ] One team's chat and progress events never reach another team's browser (NFR-4).
- [ ] A team that has used its attempt can't start another; a player can't enter the same challenge with a second team.
- [ ] An attempt can't start before the window opens or after it closes; one started 1 minute before closing runs its full timer.
- [ ] 100 generated level sets per theme pass validation: one answer, within the length limits (6.1).
- [ ] Points for 3 scripted runs match the 7.3 formula exactly, including the completion bonus and the 30-point floor.
- [ ] Both teammates submitting the correct answer at the same moment produces one solve and one points award.
- [ ] The extra hint unlocks at 90 seconds (paused time excluded) and deducts 25 points once.
- [ ] Refreshing mid-attempt restores the clue half, board, chat, score and timer within 2 seconds.
- [ ] Closing one teammate's tab for more than 60 seconds ends the attempt early with earned points kept.
- [ ] A guest can play practice mode but is refused when opening a challenge or team invite.
- [ ] A non-admin gets 403 on every /api/admin route; a non-organizer can't create a public challenge.
- [ ] Every page works at 360 px with no horizontal scrolling; the attempt screen's Clue, Board and Chat tabs work.
- [ ] Chat text containing script tags is shown as text and never runs.

## 12. Risks and future work

The biggest risks are the level engine and the fairness of an async competition. Fixed fallback values and server-only scoring cover them.

### 12.1 Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Teams that have finished share answers with teams that haven't (async play, same values) | Medium | **Accepted risk** (decided). Answers are never shown in the app before the challenge closes; organizers can keep windows short for events |
| Generators, especially the Detective story, take longer than planned | High | Phase 2 uses fixed values; add generators one theme at a time; every template keeps fixed fallback values (6.1) |
| Race conditions (both teammates submit, disconnect during a solve, two attempts started at once) | High | Process one action at a time per attempt; atomic “solve only if unsolved” update; unique indexes on attempts (9.1) |
| A teammate disconnects on purpose to stop the clock | Medium | Level timer and attempt timer both pause, but within a 3-minute pause budget only (7.6) |
| Free host doesn't support WebSockets, or sleeps when idle | Medium | Backend on Render, which supports WebSockets; open the site a few minutes before a demo to wake the server; keep a local demo ready |
| Solo scope creep (teams, challenges and practice add pages) | Medium | Follow the M/S/C priorities strictly; practice mode and Could items only after the Phase 5 gate |
| Small answer sets are still guessable (e.g. 4 suspects) | Low | Each wrong answer costs 10 points, so guessing hurts the score |
| Attempt screen too crowded on phones | Medium | Tabs for Clue, Board and Chat with an unread badge; test at 360 px from Phase 2 |
| Viva concentrates on syllabus topics rather than Socket.io | Medium | Keep the section 10 mapping visible in the code and README; rehearse the CO1 request trace |

### 12.2 Future enhancements

- Live head-to-head mode: all teams start together, with a live race view
- Teams of 3–4 with rotating roles
- Seasons: points from several challenges add up to a season ranking
- Values randomized per team with equal difficulty, so shared answers become useless
- More themes and mechanics such as audio clues, jigsaw pieces and image hotspots
- Achievements and badges
- Background music for each theme
- Spectator mode for organizers, plus replaying a finished attempt
- Level analytics: average solve time and wrong-answer rate per template, to tune difficulty
- Voice chat and multiple languages
