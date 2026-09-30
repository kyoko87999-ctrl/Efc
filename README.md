# EFC — Elite Fighters Championship
### เกมต่อสู้ 3D บนเบราว์เซอร์ ที่ได้แรงบันดาลใจจาก Tekken 8 · A browser 3D fighter inspired by modern 3D fighters

**เล่นได้ทันที / Play now:** เปิดไฟล์ [`dist/efc.html`](dist/efc.html) ด้วยเบราว์เซอร์ (ไฟล์เดียว ไม่ต้องติดตั้ง ไม่ต้องใช้เซิร์ฟเวอร์)
Open `dist/efc.html` in any modern desktop or mobile browser — it is one self-contained file (Three.js and all code inlined).

Everything is original: original characters, moves, music, sound effects, story and stages — all generated from code
(procedural 3D models with IK animation, synthesized audio). No external assets are needed.

---

## ฟีเจอร์หลัก / Features

| Tekken-style system | In EFC |
|---|---|
| 4-button 3D fighting (LP / RP / LK / RK) | Left punch, right punch, left kick, right kick, numpad notation (`d/f+2`, `f,f+3`, `WS+4` …) |
| Full 3D movement | Sidestep (up/down), sidewalk, forward/back dash, run, crouch dash, jumps, crouching |
| High / mid / low / special-mid | Highs whiff on crouching foes, lows need crouch-block, mids beat crouch-block |
| Strings & tracking | Multi-hit strings with input buffering, homing moves, sidestep-tracking |
| Throws | Throw (1+3 / 2+4) beats blocking, ducked by crouching, **throw breaks** (press 1 or 2) |
| Launchers & juggles | Launch, air juggle, screw/tornado, bound, damage scaling, recovery cuts on launches |
| Counter hit / punish | Counter-hit bonus properties and damage, punish detection, on-screen tags |
| Power crush, parry | Armored moves that absorb high/mid hits; parry stances |
| Walls | Wall splat, wall carry, wall combos, **wall break** into a second arena (Moonlit Dojo → garden) |
| Knockdown game | Tech rolls, get-up options, ground hits, down attacks |
| **Heat** system | Heat Burst (2+3), Heat Engagers, chip damage, Heat Dash cancels, Heat Smash |
| **Rage** system | Low-health Rage, damage boost, cinematic **Rage Art** (1+2) and Rage Drive |
| Recoverable health | Grey health that regenerates when you attack |
| Frame data | Startup / on-block / on-hit / counter-hit for every move; live measured advantage in Practice |
| 10 unique fighters | Karate, Muay Thai, Kung Fu, Taekwondo, Boxing, Wrestling, Capoeira, Ninjutsu, Combat Robot, Demon Lord — each with 50+ moves and unique properties, six with their own stances (≈ 525 moves in total) |
| 9 stages | Neon Rooftop, Moonlit Dojo, Sunken Temple, Neon Alley, Volcano Rim, Bangkok Fight Night, Frozen Peak, Demon Throne, Training Grid |
| Cinematic camera | Dynamic framing, KO camera, Rage Art / Heat Smash cutscene cameras, slow-motion, screen shake |
| CPU AI | 6 levels (Beginner … Master): blocks, ducks, sidesteps, punishes, juggles, throw-breaks, uses Heat / Rage / walls |
| Audio | Fully synthesized SFX + generative music per stage + announcer (speech synthesis) |
| Languages | English and ไทย (switch on the title screen or in Options) |

### Game modes / โหมดเกม
- **Story** — "The Iron Bell Tournament": 9 chapters following Tawan, with dialogue, cutscene cards and a final boss.
- **Arcade Battle** — 8-stage ladder with continues, rising difficulty and the demon-lord boss on the Demon Throne.
- **Versus (2 players)** — local: one keyboard or two gamepads (or keyboard + gamepad).
- **VS CPU** — any fighter, any stage, any difficulty.
- **Ghost Battle** — an AI that learns your habits (how often you block high/low, break throws, sidestep …) and adapts.
- **Survival** — endless opponents, health carries over.
- **Practice** — infinite health/Heat/Rage, frame-data panel, input display, hitbox view, dummy behaviours (stand, crouch, block, CPU, record & playback), position reset, swap sides.
- **Tutorial** — 12 interactive lessons (movement, strings, blocking, levels, throws, throw break, juggles, walls, Heat, Rage, punishing).
- **Move List** — every command, level, startup, block/hit advantage, damage and properties for every fighter.
- **Customize** — alternate costumes and free colour editing per fighter (saved).
- **Replays** — the last five matches are recorded (inputs only, fully deterministic) and can be watched at 1/8× – 4× speed.
- **Options** — rounds, time, difficulty, Heat/Rage/recoverable-health/tech-roll toggles, damage multiplier, graphics quality, volumes, key re-binding, language.

---

## ปุ่มควบคุม / Controls

### Keyboard
| Action | Player 1 | Player 2 |
|---|---|---|
| Move (forward = towards opponent) | `A` / `D` | `←` / `→` |
| Up (sidestep / jump) / Down (crouch) | `W` / `S` | `↑` / `↓` |
| **1** Left Punch | `U` | `Numpad 4` or `,` |
| **2** Right Punch | `I` | `Numpad 5` or `.` |
| **3** Left Kick | `J` | `Numpad 1` or `/` |
| **4** Right Kick | `K` | `Numpad 2` or `Right Shift` |
| Heat Burst / Smash (2+3) | `Space` | `Numpad 8` or `Enter` |
| Rage Art (1+2) | `O` | `Numpad 6` |
| Throw (1+3) | `L` | `Numpad 0` |
| 2+4 (throw / special) | `P` | `Numpad 3` |
| 3+4 / 1+4 | `N` / `M` | `Numpad 7` / `Numpad 9` |
| Pause | `Esc` or `Tab` | |

All keys can be re-bound in **Options → Controls**. With one player only (Story, Arcade, CPU, Practice, Tutorial) both key sets control your fighter.

### Gamepad (standard mapping)
Left stick / D-pad = move · `X` = 1 · `Y` = 2 · `A` = 3 · `B` = 4 · `LB` = 1+3 · `RB` = 2+4 · `LT` = 1+2 · `RT` = 2+3 (Heat) · `Start` = pause.
Menus: D-pad / stick to move, `A` confirm, `B` back, `LB`/`RB` change tabs.

### Touch (phones / tablets)
On-screen stick, four attack buttons and macro buttons (1+3, 2+4, 1+2, HEAT, 3+4, 1+4). Shown automatically on touch devices (Options → Video → Touch controls).

### Notation / สัญลักษณ์
Numpad directions relative to the opponent (`6` = forward, `4` = back, `2` = down, `8` = up), written in the move list as arrows/`f b u d`.
`d/f` = down-forward, `f,f` = dash, `f,n,d,d/f` = crouch-dash motion, `WS` = while standing up from crouch, `WR` = while running, `SS` = from sidestep,
`CD` = from crouch dash, `,` = string (press the next button), `+` = press together, `RAGE` = only while in Rage.

---

## รันและสร้างเอง / Build from source

```bash
npm install
npm run build          # -> dist/efc.html (single file), dist/index.html + dist/game.js
npm run serve          # static server on http://localhost:8080 (optional)
npm test               # simulation unit tests
```

Node scripts in `tests/` (all headless, no browser needed):

| Script | What it checks |
|---|---|
| `node tests/run.mjs` | Core rules: startup frames, block, high/low, throws + break, launcher, wall break, fuzz stability |
| `node tests/moves.mjs` | Every move of every character can be executed with its documented command (444 moves) |
| `node tests/ai_sim.mjs [games] [level]` | AI-vs-AI across the roster: crashes, NaNs, stuck states, statistics |
| `node tests/replay.mjs` | Recorded inputs replay to the exact same result (determinism) |
| `node tests/tune.mjs`, `movestats.mjs`, `combofind.mjs`, `launchstats.mjs` | Balance / combo tooling |

`tools/*.mjs` are Playwright helpers used for screenshots and scripted UI checks.

### Architecture
- `src/sim/` — deterministic 60 Hz simulation (fighter state machine, hit/hurt capsules, combat rules, match/rounds, AI). No rendering, no randomness.
- `src/data/` — move definitions (`lib.js` presets + universal moves), 10 character files, roster.
- `src/render/` — Three.js rig with IK, poses & animation scripts, stages, camera director, particle FX.
- `src/ui/`, `src/game/` — DOM HUD and menus, game modes, story, tutorial, save data.
- `src/input/`, `src/audio/` — keyboard/gamepad/touch and WebAudio synthesis.

## ข้อจำกัด / Known limitations
- Local multiplayer only (no online / rollback netcode).
- Graphics are stylized procedural models rather than AAA scanned characters; all other systems aim to match the genre.
- Audio is synthesized (chiptune/orchestral-style loops), no voiced dialogue apart from the browser's speech synthesis announcer.

Built with [Three.js](https://threejs.org) (MIT licence). Fonts (Kanit, Rajdhani) are loaded from Google Fonts when online; the game falls back to system fonts otherwise.
