# ⚔ Dark Fantasy

A dark fantasy arena survival game built with vanilla JS + Canvas. No libraries, no build step — open `index.html` (or serve the folder) and play.

## How to play

- **W A S D / arrows** — move
- **SPACE / ⚔ button** — attack (hold to keep swinging)
- **P / Esc** — pause
- **R / ↻** — restart
- **Enter / START** — begin
- **Joystick** — mobile movement (appears on small screens)

## Game loop

- Survive **waves** of enemies: grunts, fast stalkers, armored bulwarks, and a **Pale King boss** every 5th wave
- Clear a wave → an **exit portal** opens → step in to reach the next level (Forest Ruins → Crypt → Highlands, each with its own palette and layout)
- **Clear wave 10** to win
- Enemies scale in HP each wave

## Progression

- **XP & levels** — each kill grants XP; leveling up raises max HP and heals you
- **Health potions** drop from kills (red flask)
- **Sword upgrades** drop occasionally (gold sword): +4 damage, +5 range
- **Score** — kills, wave-clear bonuses, level bonuses; best score is saved in `localStorage`

## Files

| File | Purpose |
|------|---------|
| `config.js` | Canvas setup, DPR scaling, constants |
| `audio.js` | WebAudio synth SFX (no assets) |
| `fx.js` | Particles, damage numbers, screen shake, hurt vignette |
| `levels.js` | Level data (tile maps, decor, palettes), collision |
| `entities.js` | Player, enemy types/AI, combat, loot, XP |
| `input.js` | Keyboard + mobile joystick/attack controls |
| `ui.js` | HUD, banners, title/pause/end screens, buttons |
| `game.js` | Game state machine, wave manager, portal, loop |
| `style.css` | Page styling and responsive/mobile layout |

Plain script tags (no ES modules), so it works from `file://` or any static server:
`npx http-server .` then open http://localhost:8080
