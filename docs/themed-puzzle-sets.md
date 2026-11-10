# Themed Puzzle Sets

The companion document to the PRD (`PRD Collaborative Digital Escape Room.md`, §6.1 step 4 and §6.5). For every theme it holds the story, the roles, the visual style, the five level designs, the pools the generators draw from, and the **fixed fallback values** used when generation fails 20 times.

There are **8 themes**: the 4 the PRD names, plus 4 more in other genres. The extra ones use only the 11 existing mechanics and the 6 clue display types, so they need no new generator code (§6.1).

| # | Theme | Genre | Timer | Style key | Board shows |
| --- | --- | --- | --- | --- | --- |
| 1 | Cyber Heist – Operation Blackout | Tech heist | 15 min | `cyber` | Fragments (letters) |
| 2 | Detective – Murder at Blackwood Manor | Mystery | 20 min | `noir` | Case notes |
| 3 | Space Station – Station Helios Emergency | Sci-fi | 15 min | `orbital` | Launch digits |
| 4 | Pirate – Blackbeard's Lost Treasure | Adventure | 18 min | `pirate` | Treasure log (answers) |
| 5 | Haunted Asylum – The Ward 13 Séance | Horror | 20 min | `haunted` | Spirit letters |
| 6 | Tomb of the Sun King – The Golden Mask | Ancient myth | 18 min | `tomb` | Sacred digits |
| 7 | Alchemist's Tower – The Midnight Elixir | Fantasy | 15 min | `arcane` | Runes (letters) |
| 8 | Polar Expedition – Whiteout at Camp Aurora | Survival | 18 min | `polar` | Frequency digits |

## 1. Where this lives in the code

| What | Where |
| --- | --- |
| One module per theme: `{ theme, templates, pools }` | `server/src/content/themes/<theme>.js` |
| Shared vocabulary: mechanics, clue types, glyphs, colours, style keys, Morse | `server/src/content/catalog.js` |
| Registry: `getContent(slug)`, `listThemes()`, `fillText()` | `server/src/content/index.js` |
| Checks: every fallback solved from its own clues, plus every pool rule below | `server/tests/themedPuzzleSets.test.js` |

The modules are the machine copy of this document. **Full clue data and full pools are in the modules**. This document summarises them. If you change one, change the other, and run `npm test`.

Each theme is seeded into MongoDB (`npm --prefix server run seed`, or `ensureSeeded()` at boot). Each template's generator (`server/src/generators/`) produces fresh values from `params` and `pools`, and `generateLevelSet` validates them; the `fallback` set is used only when a level still fails after 20 retries (§6.1 step 4, D54). The fallbacks also carry a server-only `solution` so they pass the same validator (D52).

**Template fields** (ADMIN-3): `order`, `title`, `mechanic`, `params` (ranges and pool names), `hint`, `rewardRule`, `timeEstimateSec`, `fallback` (`clueA`, `clueB`, `answer`, `acceptedAnswers`, `answerKind`, `reward`, `explanation`).

## 2. Authoring rules

These apply to every theme, and the content tests enforce them.

1. **Answer limits** (§6.4). A `word` has up to 8 letters. A `code` has up to 4 characters and at least one digit: a PIN such as `9742`, or a grid coordinate such as `B9` (DECISIONS D44). A `list` is IDs joined by dashes, up to 8 characters normalised, such as `23-12-4`. Accepted alternatives follow the same limits.
2. **No half gives the answer away.** The answer, and each accepted alternative, must not appear in either clue half. The one exception: it may appear as one candidate among at least 3 rows of a table or 3 labelled cells of a grid, as in a suspect list or a map. Answers shorter than 3 characters are covered by rule 3 instead.
3. **Every fallback can be solved from its two halves.** The test suite contains a solver for each mechanic (and one for each prose rule). It recomputes the answer from the clue data, and it must match.
4. **Hints carry no values.** A template's hint is shown for every generated instance, so it may not contain digits or instance-specific words. Write "A fast clock shows a later time than the real one", not "11:35 minus 15".
5. **Rewards** (GAME-8) follow the template's `rewardRule`. `letter` is one letter. `digit` is one digit from 1 to 9, distinct across levels 1–4. `answer` is the level's own answer (the Pirate board). `caseNote` is a short note (the Detective board). Level 5 has no reward.
6. **Finale coherence.** Clue A of a Fragment Finale lists the titles of levels 1–4 in the order to use. Clue B lists each level's reward. Read in clue A's order, the rewards (or their first letters, when `params.use` is `firstLetter`) spell the answer.
7. **Original content.** No names, characters or items from existing games. The Detective weapons, for example, are a set of our own.
8. **Text placeholders.** `revealText` may contain `{answer.N}`, which is replaced by level N's answer once the attempt is finished (`fillText`, D47). Detective uses it to name the killer and the shoe size (§6.5).

### Adding a theme without code

Pick 5 mechanics from §6.2 (a Fragment Finale, if used, must be level 5). Give each one `params` within the ranges shown below, a value-free hint, a reward rule and a fallback. Add a pool for every `params.pool`. Then run the content tests: they will solve your fallbacks and check your pools.

## 3. Clue data shapes

All 6 display types (§6.3) take structured data. `caption` is optional on every type.

| Type | Data | Notes |
| --- | --- | --- |
| `text` | `{ paragraphs: string[] }` | Riddles, rules, signals. Morse signals use `.` and `-`, with one space between letters |
| `tokens` | `{ tokens: [{ label, color, value? }] }` | `color` comes from `TOKEN_COLORS`. The label is always printed (NFR-16) |
| `symbols` | `{ symbols: [{ shape, label? }] }` | `shape` comes from `SYMBOL_SHAPES`. A legend is `symbols` with labels (D40) |
| `table` | `{ columns: string[], rows: string[][] }` | Every cell is a string |
| `grid` | `{ rows, cols, colLabels?, rowLabels?, cells: [{ r, c, mark?, label? }] }` | `r` and `c` count from 0, starting at the top left. North is up. Each cell position appears once |
| `strip` | `{ shift, direction: 'back' \| 'forward' }` or `{ numbered: true }` | With no shift it is a plain, numbered alphabet; the shift comes from elsewhere (Dying Message, D46) |

**Glyphs** (`SYMBOL_SHAPES`, 16): triangle, circle, square, diamond, hexagon, star, moon, cross, heart, wave, eye, key, crown, sun, anchor, bolt. `client/src/components/clues/Glyph.jsx` draws all 16 (D45). Letter legends need up to 6 letters plus 2 decoys.

**Token colours** (`TOKEN_COLORS`, 6): red, blue, green, yellow, orange, purple. `game.css` styles all 6.

**Morse:** international Morse for A–Z and 0–9, in `catalog.MORSE`. Role B's chart is always the full A–Z table (`morseChart()`).

### Mechanics: what each half carries

| Mechanic | Role A gets | Role B gets | Used by |
| --- | --- | --- | --- |
| `decode-key` | `tokens` with values | `tokens` in entry order | Cyber 1, Space 3, Tomb 2 |
| `caesar` | `text`, encrypted word last | `strip` (shift + direction), or a numbered strip for carry-over | Cyber 2, Detective 5, Alchemist 2 |
| `rule-filter` | `table` of items (or the rule) | the rule as `text` (or the table) | Cyber 3, Detective 2–3, Pirate 4, Haunted 2, Alchemist 1, Polar 3 |
| `describe-match` | `symbols` row (or a description) | `symbols` legend with decoys (or a register table) | Cyber 4, Detective 4, Pirate 3, Tomb 1 |
| `ordering` | `table` of id + value | direction + output format as `text` | Space 1, Haunted 4, Alchemist 3 |
| `grid-lookup` | unlabelled `grid` with one mark | labelled empty `grid` | Space 2, Alchemist 4 |
| `grid-navigation` | `text`: start landmark + 3 moves | labelled `grid` map | Pirate 2, Tomb 4, Polar 1 |
| `morse` | `text` signal | `table` Morse chart | Space 4, Haunted 1, Polar 2 |
| `split-riddle` | first half of a riddle | second half | Pirate 1, Haunted 3 |
| `arithmetic` | a reading (clock, dial, gauge) | the correction rule | Detective 1, Tomb 3, Polar 4 |
| `fragment-finale` | the order of levels 1–4 | the rewards of levels 1–4 | Cyber 5, Space 5, Pirate 5, Haunted 5, Tomb 5, Alchemist 5, Polar 5 |

`params.listHolder: 'B'` swaps the halves of a Rule Filter, so the rule goes to A and the table to B (Haunted 2).

## 4. The themes

Each section gives the story, the roles, the style, and the five levels. The **Fallback** column is the fixed value set: answer, then reward.

Style notes are for UI-2 (Phase 6, `client/src/styles/themes/<styleKey>.css`). Fonts are Google Fonts. Every palette must keep body text at 4.5:1 contrast or better against its background (NFR-16).

### 4.1 Cyber Heist – Operation Blackout (15 min) · `cyber`

*A rival firm has locked its vault behind five layers of security. The Hacker is inside the network and sees the raw signals. The Decoder holds the manuals that make sense of them. You have 15 minutes before the system resets.*

- **Roles:** A **Hacker** (inside the network: keypads, codes and readouts) · B **Decoder** (the manuals: rules and keys)
- **Reveal:** The vault door swings open. Operation Blackout is a success. · **Fail:** The system reset before you got in. The vault stays locked.
- **Style:** near-black `#0b0f14` with terminal green `#3dff9a` and an amber `#ffb000` warning. Fonts: *JetBrains Mono* for display and *Inter* for body. Texture: faint scanlines. Timer: a segmented LED countdown that flickers under 1 minute.

| # | Puzzle | Mechanic | Randomized each game (`params`) | Hint | Fallback |
| --- | --- | --- | --- | --- | --- |
| 1 | Access PIN | Decode and Key | 4 distinct digits, their colours, the entry order | Read each colour in the Decoder's order and take its digit from the Hacker's keypad. | `9742` → D |
| 2 | Firewall | Caesar Cipher | Word from `caesarWords`, shift 1–5 back | Find each intercepted letter in the top row of the strip. The letter under it is the real one. | `FIREWALL` → N |
| 3 | Server Reboot | Rule Filter | 6 server IDs (1–30), which 3 are offline, sort direction | Three servers are offline. | `23-12-4` → E |
| 4 | Glyph Keypad | Describe and Match | 4 shapes from the first 6, shape-to-digit legend, 1–2 decoys | The legend lists more glyphs than the panel shows. | `8315` → O |
| 5 | Vault Finale | Fragment Finale | Word from `finaleWords`; its letters are the rewards of 1–4 in random order | The fragments are also on your team board. | `NODE` |

**Pools:** `caesarWords` (10): SECURITY, FIREWALL, PASSWORD, ENCRYPT, NETWORK, BACKDOOR, MALWARE, PROTOCOL, SERVER, KERNEL · `finaleWords` (8): BYTE, CODE, ROOT, NODE, HACK, LINK, PORT, DISK.

### 4.2 Detective – Murder at Blackwood Manor (20 min) · `noir`

*Lord Blackwood lies dead in his study, and the storm has cut the manor off until dawn. The Inspector walks the scene: the clock, the prints, the body and the guests. The Pathologist holds the reference files that make the evidence speak. Name the killer in 20 minutes, before the guests can slip away.*

- **Roles:** A **Inspector** (at the scene: the clock, the alibis, the footprint, the wound, the last message) · B **Pathologist** (the files: clock records, shoe-size chart, weapons register, cipher key)
- **Reveal:** It was `{answer.5}`, wearing size `{answer.3}` shoes. The case of Blackwood Manor is closed. · **Fail:** Dawn breaks, the roads reopen, and the killer drives away. The case goes cold.
- **Style:** sepia paper `#f3ead8` with ink `#2a2118` and oxblood `#7a1f1f`. Fonts: *Playfair Display* for display and *Lora* for body. Texture: aged paper with a typewriter-ribbon underline. Timer: a pocket-watch dial.

| # | Puzzle | Mechanic | Randomized each game (`params`) | Hint | Fallback |
| --- | --- | --- | --- | --- | --- |
| 1 | Stopped Clock | Arithmetic Split | Murder time 11:05–11:35 PM (5-min steps), clock 10/15/20 min fast | A fast clock shows a later time than the real one. | `1120` → "Murder at 11:20 PM" |
| 2 | Alibi Check | Rule Filter | 4 suspects from `suspects`, alibis built around the murder time; exactly 1 cleared (a witness for the whole time) | A suspect is cleared only by a witness who saw them for the whole time of the murder. | `BELLAMY` → "BELLAMY is cleared" |
| 3 | Footprint | Rule Filter | Print length 22–27 cm → shoe size 5–10 | Find the row of the chart whose print length matches the print exactly. | `8` → "Shoe size 8" |
| 4 | Murder Weapon | Describe and Match | Weapon and wound from `weapons` (5); the register lists all 5 | Only one entry in the register leaves every mark the Inspector describes. | `DAGGER` (also `KNIFE`) → "Weapon: DAGGER" |
| 5 | Dying Message | Caesar (carry-over) | Killer from the 3 uncleared suspects; name shifted forward by the shoe size from level 3 | The shift is the shoe size from the Footprint, on your case board. | `CROWE` (written `KZWEM`) |

**Consistency rules** (§6.5). This theme is the most sensitive to randomization, so the generator must keep the story consistent:

1. Draw 4 suspects. Exactly 1 is cleared: a named witness saw them for an interval that contains the murder time. The other 3 have no witness, or an interval that misses the murder.
2. The killer is one of the 3 uncleared suspects, never the cleared one.
3. The footprint is the killer's. Its size (level 3) is the shift for level 5.
4. Level 5's encrypted text is the killer's name shifted **forward** by the size. Clue B is a numbered strip with no shift, so the team must take the size from the board.
5. The reveal names the killer and the size from the instance (`{answer.5}`, `{answer.3}`).

**Pools:** `suspects` (10): ASHFORD, BELLAMY, CROWE, DUVAL, HARLOW, MORTON, SINCLAIR, VANCE, WHITLOCK, FENWICK · `weapons` (5, each with the Inspector's wound text and the register's mark): POKER, DAGGER, SCARF, POISON, HAMMER · `witnesses` (6): the vicar, the cook, the butler, the maid, the gardener, the chauffeur.

### 4.3 Space Station – Station Helios Emergency (15 min) · `orbital`

*A solar flare has crippled Station Helios. Oxygen is leaking, the navigation computer is dark and the last escape pod is locked. The Engineer is aboard, working the controls by hand. Mission Control is on the radio with the manuals and charts. The air runs out in 15 minutes.*

- **Roles:** A **Engineer** (aboard: valves, star window, cables, radio signal) · B **Mission Control** (on Earth: valve procedure, star charts, wiring plans, Morse chart)
- **Reveal:** The pod clears the station seconds before the hull gives way. Helios crew, welcome home. · **Fail:** The oxygen alarm falls silent. Station Helios drifts on without a crew.
- **Style:** deep space `#070b1a` with cool white `#e6ecff`, cyan `#4fd1ff` and alert orange `#ff7a3d`. Fonts: *Orbitron* for display and *Exo 2* for body. Texture: a sparse starfield. Timer: a circular O₂ gauge that drains.

| # | Puzzle | Mechanic | Randomized each game (`params`) | Hint | Fallback |
| --- | --- | --- | --- | --- | --- |
| 1 | Oxygen Valves | Ordering | 4 distinct pressures (60–220 kPa), lowest-first or highest-first | Compare the pressures, then read the valve numbers in the order Mission Control asks for. | `2431` → 7 |
| 2 | Star Map | Grid Lookup | Star position on the 4 × 4 grid, column letters, row numbers | Describe where the beacon is by counting rows and columns from one corner. | `B9` → 3 |
| 3 | Power Routing | Decode and Key | Cable order, cable-to-port mapping (6 colours) | Follow Mission Control's cable order and read each cable's port number. | `4681` → 9 |
| 4 | Distress Signal | Morse | Word from `morseWords` | Each group of dots and dashes is one letter. Read them left to right. | `MAYDAY` → 5 |
| 5 | Escape Pod Launch | Fragment Finale | Distinct digit rewards 1–9 for 1–4, finale order | The launch digits are also on your team board. | `5793` |

**Pools:** `morseWords` (20): EARTH, HELP, MAYDAY, RESCUE, ORBIT, DANGER, SIGNAL, COMET, OXYGEN, ROCKET, GALAXY, PLANET, LAUNCH, METEOR, SATURN, ENGINE, SHIELD, MARS, VENUS, ALIEN.

### 4.4 Pirate – Blackbeard's Lost Treasure (18 min) · `pirate`

*Blackbeard's map has led you to a nameless island, and the tide is coming in. The Deckhand is ashore with the torn parchment, the compass and the chest. The Navigator stays aboard with the charts, the cipher legend and the captain's log. You have 18 minutes before the sea takes the beach.*

- **Roles:** A **Deckhand** (ashore: parchment, island walk, chests) · B **Navigator** (aboard: island chart, cipher legend, captain's log)
- **Reveal:** The chest creaks open on a hoard of gold. Blackbeard's treasure is yours. · **Fail:** The tide swallows the beach. The treasure sleeps on beneath the waves.
- **Style:** parchment `#efe0bd` with sea blue `#14425c`, rope brown `#6b4423` and treasure gold `#c99a2e`. Fonts: *Pirata One* for display and *Crimson Text* for body. Texture: a stained chart with a compass rose. Timer: an hourglass.

| # | Puzzle | Mechanic | Randomized each game (`params`) | Hint | Fallback |
| --- | --- | --- | --- | --- | --- |
| 1 | Torn Parchment | Split Riddle | Riddle from `riddles` (20) | Read both halves aloud as one riddle. | `MAP` (also `CHART`) → MAP |
| 2 | Island Walk | Grid Navigation | 7 landmarks on the 5 × 5 grid, start point, 3 moves that stay on the map and end on a landmark | North is the top of the chart. Trace each move one square at a time. | `SKULL` → SKULL |
| 3 | Pirate Code | Describe and Match | Word from `codeWords`, symbol legend, 2 decoys | The same symbol always stands for the same letter. | `PARROT` → PARROT |
| 4 | Cursed Chest | Rule Filter | 5 items from `chestItems` with random colours and kinds; the rule variant leaves exactly 1 | The rule has two conditions. Only one item meets both. | `AMULET` → AMULET |
| 5 | Captain's Password | Fragment Finale | Finale word first (`finaleWords`), then answers for 1–4 whose **first letters** spell it, in random order | Take only the first letter of each answer on your board. | `MAPS` |

**Finale rule.** The generator picks the finale word first, then a permutation that assigns each letter to one of levels 1–4. Each level then draws an answer from its own pool that starts with that letter. The pools are written so that **every finale word can be spelled**: the test tries all 24 assignments for each word.

**Pools:** `riddles` (20, answers MAP, NEEDLE, RIVER, BOTTLE, STEPS, FIRE, COIN, BREATH, ANCHOR, EIGHT, SAIL, WHALE, OAR, CASK, PLANK, VOYAGE, DOUBLOON, ISLAND, RUM, TIDE) · `landmarks` (9): PALM, SKULL, WELL, VOLCANO, LAGOON, DUNE, WRECK, EAGLE, CAVE · `codeWords` (11): CANNON, PARROT, SAILOR, MAST, OCEAN, DECK, ROPE, ANCHOR, VOYAGE, GALLEON, COMPASS · `chestItems` (10): AMULET, GOBLET, PEARL, CROWN, MEDAL, EMERALD, DIAMOND, OPAL, SILVER, RUBY · `finaleWords` (7): CAVE, COVE, CODE, MAPS, ROPE, WAVE, SAND.

### 4.5 Haunted Asylum – The Ward 13 Séance (20 min) · `haunted` · *new*

*Ravenhill Asylum closed a century ago, but the lights in Ward 13 still flicker every night. A restless spirit is trying to speak. The Medium sits in the ward and senses the signs. The Archivist is in the records room with the old files. Learn the spirit's name before the candles burn down in 20 minutes.*

- **Roles:** A **Medium** (in Ward 13: flickering lights, whispers, the faces in the portraits) · B **Archivist** (the records room: patient files, the telegraph room's Morse chart, the portrait register)
- **Reveal:** You speak the name `{answer.5}` aloud. The candles gutter, the air warms, and Ward 13 falls silent at last. · **Fail:** The last candle goes out. Something in Ward 13 laughs softly in the dark.
- **Style:** cold grey-green `#11140f` with candlelight `#f2d48a`, faded hospital green `#7f9a86` and dried red `#8c1c1c`. Fonts: *Special Elite* for display and *EB Garamond* for body. Texture: water-stained plaster with a slow vignette flicker (off under reduced motion). Timer: a candle that burns down.

| # | Puzzle | Mechanic | Randomized each game (`params`) | Hint | Fallback |
| --- | --- | --- | --- | --- | --- |
| 1 | Flickering Lights | Morse | Word from `morseWords` | A short flicker is a dot and a long one is a dash. Each group is one letter. | `ATTIC` → D |
| 2 | Patient Files | Rule Filter (halves swapped: the whisper is the rule, the files are the table) | 6 beds, admission month, discharged, by a window; 3 conditions leave exactly 1 bed | Check every part of the whisper against each file. Only one bed fits them all. | `17` → A |
| 3 | Whispers in the Walls | Split Riddle | Riddle from `riddles` (20) | Put the two halves together and say them as one riddle. | `ECHO` → E |
| 4 | Portrait Hall | Ordering | 4 portraits with years 1840–1920, newest-first or oldest-first | Sort the portraits by year first, then read off their plaque numbers. | `8635` → N |
| 5 | The Séance | Fragment Finale | Spirit name from `finaleWords`; its letters are the rewards of 1–4 | The spirit letters are also on your board. | `EDNA` |

**Pools:** `morseWords` (20): GHOST, NURSE, ATTIC, CELLAR, LANTERN, SHADOW, WARDEN, CANDLE, MIRROR, CHAPEL, GRAVE, WHISPER, CRYPT, COFFIN, SPIRIT, DUNGEON, PHANTOM, SCREAM, CURSE, WIDOW · `riddles` (20, answers SHADOW, ECHO, DARKNESS, CLOCK, SILENCE, MIRROR, CANDLE, STAIRS, GHOST, WINDOW, KEY, DOLL, DOOR, FOG, BELL, MOON, PILLOW, DREAM, PORTRAIT, RAIN) · `finaleWords` (8): EDNA, CORA, ROSE, ELSA, MAUD, NELL, IRIS, LILA.

### 4.6 Tomb of the Sun King – The Golden Mask (18 min) · `tomb` · *new*

*Deep under the desert lies the sealed tomb of the Sun King, and his golden mask has never been seen. The Explorer has crawled inside with a torch. The Scholar waits at camp with the translations and the dig notes, talking over the radio. The torch has 18 minutes of oil left.*

- **Roles:** A **Explorer** (in the tomb: carved walls, jars, the sundial shaft, floor tiles) · B **Scholar** (at camp: hieroglyph translations, dig notes, floor plan)
- **Reveal:** The last seal cracks and sunlight floods the chamber. The Sun King's golden mask gleams in your hands. · **Fail:** The torch sputters out. In the dark, the tomb door grinds shut behind you.
- **Style:** sandstone `#e8d3a8` with lapis `#1f3a93`, gold leaf `#d4a017` and charcoal `#2b2420`. Fonts: *Cinzel* for display and *Cormorant Garamond* for body. Texture: carved stone with a gold-leaf border. Timer: a torch flame that shrinks.

| # | Puzzle | Mechanic | Randomized each game (`params`) | Hint | Fallback |
| --- | --- | --- | --- | --- | --- |
| 1 | Hieroglyph Wall | Describe and Match | Word from `hieroglyphWords`, glyph-to-letter legend, 2 decoys | Each glyph always stands for the same letter. Two glyphs in the translation are not on the wall. | `SCARAB` (also `BEETLE`) → 4 |
| 2 | Canopic Jars | Decode and Key | 4 distinct numerals on the 4 guardian jars, colours, sealing order | Take the jars in the Scholar's order and read the numeral painted on each. | `2169` → 7 |
| 3 | Sundial | Arithmetic Split | Reading 1:00–5:55 (5-min steps), dial 15–35 min behind; enter as 4 digits | A dial that runs behind shows an earlier time than the true one. | `0515` (also `515`) → 1 |
| 4 | Pressure Plates | Grid Navigation | 7 tiles from `landmarks` on the 5 × 5 floor, start, 3 moves ending on a tile | North is the top of the floor plan. Count one tile per step. | `COBRA` (also `SNAKE`) → 5 |
| 5 | Mask Chamber | Fragment Finale | Distinct digit rewards 1–9, finale order | The sacred digits are also on your board. | `1547` |

**Pools:** `hieroglyphWords` (10): SCARAB, ANKH, SPHINX, PHARAOH, PYRAMID, OBELISK, LOTUS, NILE, COBRA, MUMMY · `landmarks` (8): FALCON, IBIS, LOTUS, COBRA, JACKAL, LION, VULTURE, BEETLE · `guardians` (4): FALCON, JACKAL, BABOON, HUMAN.

### 4.7 Alchemist's Tower – The Midnight Elixir (15 min) · `arcane` · *new*

*Your master, the old alchemist, has fallen under a sleeping curse. Only the Midnight Elixir can wake him, and it must be brewed before the tower bell strikes twelve. The Apprentice works at the bench among the shelves and runes. The Grimoire Keeper reads from the spellbook. You have 15 minutes.*

- **Roles:** A **Apprentice** (the workbench: potion shelf, rune lock, scales, spellbook pages) · B **Grimoire Keeper** (the grimoire: recipes, rune key, brewing order, page index)
- **Reveal:** The elixir glows silver as the bell strikes twelve. Your master opens his eyes and smiles. · **Fail:** The bell tolls midnight and the cauldron turns to ash. The curse holds.
- **Style:** midnight violet `#1a1033` with moon silver `#d9d4f0`, potion teal `#2ec4b6` and ember `#ff9f1c`. Fonts: *Uncial Antiqua* for display and *Alegreya* for body. Texture: a faint constellation and rune watermark. Timer: a moon phase that waxes to full at zero.

| # | Puzzle | Mechanic | Randomized each game (`params`) | Hint | Fallback |
| --- | --- | --- | --- | --- | --- |
| 1 | Potion Shelf | Rule Filter | 6 bottles (colour, stopper, state), 2-condition rule leaving 2–3, sort direction | A potion must meet both conditions in the recipe. | `6-4-1` → O |
| 2 | Rune Lock | Caesar Cipher (forward) | Word from `caesarWords`, shift 2–9 forward | Find each carved rune-letter in the top row of the key. The letter under it is the true one. | `MANDRAKE` (written `IWJZNWGA`) → T |
| 3 | Alchemy Scales | Ordering | 4 distinct weights 40–400 g, heaviest-first or lightest-first | Weigh first, then read off the jar numbers in order. | `2795` → E |
| 4 | Spellbook Index | Grid Lookup | Rune position on the 4 × 4 page, column letters, row numbers | Describe where the glowing rune is by counting rows and columns from one corner. | `Q3` → M |
| 5 | The Elixir | Fragment Finale | Word from `finaleWords`; its letters are the rewards of 1–4 | The runes are also on your board. | `TOME` |

**Pools:** `caesarWords` (12): DRAGON, ELIXIR, WYVERN, GOLEM, MANDRAKE, PHOENIX, GRIFFIN, UNICORN, WIZARD, POTION, CAULDRON, BASILISK · `finaleWords` (8): TOME, RUNE, WAND, SAGE, MAGE, BREW, MOON, OWLS.

### 4.8 Polar Expedition – Whiteout at Camp Aurora (18 min) · `polar` · *new*

*A blizzard has buried Camp Aurora, and the rescue plane can only land if you send it the right frequency. The Navigator is out on the ice in the storm. The Radio Operator is in the base hut with the map, the charts and the manifest. The plane turns back in 18 minutes.*

- **Roles:** A **Navigator** (on the ice: the trail, radio static, crates, fuel gauge) · B **Radio Operator** (base hut: camp map, Morse chart, manifest rules, fuel tables)
- **Reveal:** Landing lights cut through the snow. The rescue plane touches down at Camp Aurora. Everyone goes home. · **Fail:** The plane circles once, then turns back into the storm. Camp Aurora waits for spring.
- **Style:** snow white `#f4f8fb` with glacier blue `#1e5f8c`, aurora green `#36d399` and signal red `#e63946`. Fonts: *Rajdhani* for display and *Source Sans 3* for body. Texture: wind-blown snow drift (static under reduced motion). Timer: a thermometer whose mercury falls.

| # | Puzzle | Mechanic | Randomized each game (`params`) | Hint | Fallback |
| --- | --- | --- | --- | --- | --- |
| 1 | Whiteout Walk | Grid Navigation | 7 landmarks on the 5 × 5 map, start, 3 moves ending on a landmark | North is the top of the map. Trace each move one square at a time. | `CAIRN` → 3 |
| 2 | Radio Static | Morse | Word from `morseWords` | Each group of beeps is one letter. Read them left to right. | `FROST` → 8 |
| 3 | Supply Crates | Rule Filter | 6 crates (IDs 1–20; seal, weight, stencil), 3-condition rule leaving 3, sort direction | A crate must pass all three checks in the manifest rules. | `14-9-2` → 6 |
| 4 | Fuel Gauge | Arithmetic Split | Reading 200–480 L (steps of 5), gauge 15–60 L too high | A gauge that reads too high shows more fuel than there really is. | `295` → 1 |
| 5 | Rescue Flare | Fragment Finale | Distinct digit rewards 1–9, finale order | The frequency digits are also on your board. | `1368` |

**Pools:** `morseWords` (20): SNOW, BLIZZARD, RESCUE, HUSKY, FROST, GLACIER, AURORA, SLED, ICEBERG, TUNDRA, ARCTIC, SLEDGE, PARKA, SUMMIT, CAMP, TENT, SEAL, WALRUS, PENGUIN, COMPASS · `landmarks` (8): FLAGPOLE, CAIRN, HUT, RIDGE, IGLOO, DEPOT, CREVASSE, BEACON.

## 5. Pool rules (checked by the tests)

| Pool | Minimum size | Rule |
| --- | --- | --- |
| `caesarWords`, `morseWords` | 8 | A–Z only, up to 8 letters, no duplicates |
| `riddles` | 6 | `{ partA, partB, answer, acceptedAnswers }`. Neither half contains the answer |
| `weapons` | exactly 5 | `{ name, wound, mark }`. The Inspector's wound text never names the weapon |
| `suspects` | 6 | Names of up to 8 letters |
| `landmarks` | 7 | Every label on a Grid Navigation map comes from this pool |
| `finaleWords` | 6 | 4 letters each. Pirate: each one must be spellable from levels 1–4 |
| `codeWords`, `hieroglyphWords` | 6 | Distinct letters + 2 decoys ≤ 16 glyphs |
| `chestItems` | 5 | A–Z, up to 8 letters |

A fallback answer that comes from a pool must be in that pool.

## 6. What Phase 3 added for these sets

All of this is delivered on the `phase-3-challenges-engine` branch (hosted gate pending).

- [x] The `grid` clue renderer (Star Map, Spellbook Index, Island Walk, Pressure Plates, Whiteout Walk).
- [x] 10 more glyphs in `Glyph.jsx`, so all 16 `SYMBOL_SHAPES` can be drawn.
- [x] `orange` and `purple` token colours in `game.css`.
- [x] The numbered strip (`strip` with `numbered: true`) for the Dying Message.
- [x] Generators for the 11 mechanics, reading `params` and `pools` from these templates, with the Detective consistency rules (§4.2) and the Pirate first-letter finale (§4.4).
- [x] A theme picker for practice rooms (PRAC-1).

### 6.1 Template text parameters

- **`params.copy`** (D55): theme-specific strings with `{placeholders}`, such as `introA`, `measureA`, `reward`, `stripCaption`. A value may be a list; the generator picks one wording per level (Detective Footprint has 3 intros × 3 measure lines). A caption that is not in `copy` is taken from the fallback clue of the same half.
- **`{places}`**: in a Caesar `stripCaption`, becomes "place" when the shift is 1 and "places" otherwise.
- **`params.variant`**: picks one of a mechanic's builders. Rule Filter has 7, Describe Match has 3 and Arithmetic has 3.
- **Pool sizes grew in Phase 3** so two seeds differ in at least 4 of 5 levels: Morse words (Space, Haunted, Polar: 20 each) and riddles (Pirate, Haunted: 20 each). The pool minimums in §5 are unchanged.
