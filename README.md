# 🐍 Shedding Snake

**A gravity snake-puzzle with one twist: shed your tail to build the world.**

[中文文档 →](README.zh.md)

Eat apples to grow. Your body is a bridge. Press **X** and your tail freezes
into a permanent crate — even in mid-air. Body = health = building material.

Built with [Phaser 3](https://phaser.io/) + TypeScript. Pixel art based on the
CC0 [Kenney](https://kenney.nl/) asset family. Runs in any browser, no install.

## Features

- **Turn-based gravity puzzles** — Snakebird-style movement: any body segment
  resting on solid ground supports the whole snake; fall off the world or
  onto spikes and it's over (unlimited undo, even after death).
- **The shed mechanic** — sacrifice tail segments to leave solid crates
  behind, even floating in mid-air.
- **Three kinds of doors** — apple-locked (eat every apple), key-locked
  (bump it while holding a key), and open doors that win instantly.
- **Keys & lock blocks** — locks merge into connected walls, one keyhole per
  cell, one key per keyhole.
- **Spike blocks** — teeth on every exposed face; hang above them safely,
  but never let them carry your weight (weight-based death rules).
- **Level editor** — paint levels with real in-game tiles, draw your snake
  segment by segment, test instantly, save locally, export as ASCII text.
- **Campaign** — 6 tutorial levels with sequential unlocks and auto-save
  (cloud save on CrazyGames).

## Getting Started

```bash
npm install
npm run dev     # → http://localhost:5173
npm test        # 33 rule unit tests (vitest)
npm run build   # production build in dist/ (relative paths, portal-ready)
```

Requires Node.js 18+. No game engine download needed — Phaser is an npm
dependency.

## How to Play

Reach the door. Doors with a **red apple padlock** open once every apple on
the level is eaten; doors with a **gold padlock** need a key; plain doors are
already open.

| Key | Action |
|---|---|
| Arrows / WASD | Move (the body follows; gravity applies after every step) |
| **X** | Shed: the tail segment freezes into a permanent crate |
| Z | Undo (works after death) |
| R | Restart level |
| M | Mute |
| ESC | Back to menu / level select / editor |

Mobile: swipe to move, tap to shed.

Rules worth knowing:

- Eating an apple makes you one segment longer — length is reach.
- You fall unless some segment rests on something solid. Falling off the
  board or into spikes kills.
- Hanging *above* spikes or spike blocks is safe. Letting a spike block be
  your only support — or pushing into one — is not.
- Shed crates are permanent and frozen in place, even in mid-air.

## Level Editor

Menu → **LEVEL EDITOR**. Pick a tile from the scrollable object bar (walls,
spikes, spike blocks, apples, keys, locks, three door types, snake), click or
drag to paint. The draft is validated after every stroke, so it can always be
play-tested with **TEST** (ESC brings you back with the draft intact).
**COPY** exports the level as ASCII text — paste it into
`src/levels/index.ts` to make it part of the campaign:

```
.  empty      #  wall       ^  spike      S  spike block
o  apple      k  key        L  lock       E  apple door
D  key door   O  open door  H  head       1..9  body
```

## Architecture

```
src/
  core/     pure TypeScript game rules — zero rendering dependencies,
            fully unit-tested, portable to other shells
  levels/   campaign levels as ASCII maps
  render/   Phaser scenes (menu, level select, game, editor) + a shared
            BoardRenderer so the editor preview and the game never drift
  progress.ts    campaign progress behind a pluggable save backend
  crazygames.ts  CrazyGames SDK v3 wrapper (no-op outside the platform)
```

Everything visual is generated or autotiled at boot: terrain, lock blocks
and spike blocks are 16-state connected families; the snake is drawn
programmatically (connection-aware segments, directional faces).

## Credits

- Tiles, sounds, music, fonts: [Kenney](https://kenney.nl/) (CC0) and
  [Juhani Junkala](https://opengameart.org/content/5-chiptunes-action) (CC0)
- Snake, apple, padlocks, spike/lock block pixel art: original, drawn in the
  Kenney palette
- Inspired by [Snakebird](https://store.steampowered.com/app/357300/Snakebird/)
  (Noumenon Games) — go buy it, it's brilliant

## License

[MIT](LICENSE) — game code. Bundled third-party assets are CC0.
