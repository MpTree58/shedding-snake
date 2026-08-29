import Phaser from 'phaser';
import { Cell, GameState, GameEvent, Vec } from '../core/types';
import { Open, Side, ensureSpikeBlockTexture, maskKey, TILE } from './textures';
import { KENNEY_SCALE } from './backdrop';

export interface BoardLayout {
  ox: number;
  oy: number;
  fit: number;
}

/**
 * Computes where the board sits on screen and how much it must be scaled
 * to fit — big editor/campaign maps shrink instead of overflowing.
 */
export function layoutBoard(
  scene: Phaser.Scene,
  width: number,
  height: number,
  topPad = 60,
  bottomPad = 32,
): BoardLayout {
  const availW = scene.scale.width;
  const availH = scene.scale.height - topPad - bottomPad;
  const fit = Math.min(1, availW / (width * TILE), availH / (height * TILE));
  const ox = (availW - width * TILE * fit) / 2;
  const oy = topPad + (availH - height * TILE * fit) / 2;
  return { ox, oy, fit };
}

/** Cell center in board-local coordinates (containers carry ox/oy/fit). */
export function cellCenter(x: number, y: number): Vec {
  return { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
}

/**
 * Draws the static layer of a level (terrain autotiles + their off-screen
 * extensions, spikes, apples, keys, locks, doors, shed crates, decorative
 * flora) into a container. Shared by the game scene and the level editor so
 * the two can never drift apart visually.
 */
export class BoardRenderer {
  constructor(private scene: Phaser.Scene) {}

  render(
    container: Phaser.GameObjects.Container,
    state: GameState,
    layout: BoardLayout,
    opts: { decoSeed?: number; events?: GameEvent[]; staticSnake?: boolean } = {},
  ): void {
    const scene = this.scene;
    container.removeAll(true);
    container.setPosition(layout.ox, layout.oy).setScale(layout.fit);

    const at = cellCenter;
    const wallAt = (x: number, y: number) =>
      x < 0 || x >= state.width || y < 0 || y >= state.height
        ? true
        : state.grid[y]![x] === Cell.Wall;
    const terrainKey = (exposed: Open) => `terrain-${maskKey(exposed)}`;
    const events = opts.events ?? [];
    const shedAt = (x: number, y: number) =>
      events.some((e) => e.type === 'shed' && e.at.x === x && e.at.y === y);
    const add = (img: Phaser.GameObjects.Image) => container.add(img);

    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const cell = state.grid[y]![x]!;
        if (cell === Cell.Empty) continue;
        const p = at(x, y);
        if (cell === Cell.Apple) {
          add(scene.add.image(p.x, p.y, 'apple'));
          continue;
        }
        if (cell === Cell.Exit || cell === Cell.ExitKey || cell === Cell.ExitOpen) {
          // single-cell windowed door (0130) capped by a lintel (0110) whose
          // art is bottom-aligned, so it rests exactly on the door frame
          add(scene.add.image(p.x, p.y, 'door').setScale(KENNEY_SCALE));
          if (y > 0 && state.grid[y - 1]![x] === Cell.Empty) {
            add(scene.add.image(p.x, p.y - TILE, 'door-lintel').setScale(KENNEY_SCALE));
          }
          // three door states: apple-locked (red apple padlock),
          // key-locked (gold padlock), open (no lock at all)
          if (cell === Cell.Exit && state.applesLeft > 0) {
            add(scene.add.image(p.x, p.y + 2, 'padlock-apple'));
          } else if (cell === Cell.ExitKey) {
            add(scene.add.image(p.x, p.y + 2, 'padlock-gold'));
          }
          continue;
        }
        if (cell === Cell.Key) {
          add(scene.add.image(p.x, p.y, 'key').setScale(KENNEY_SCALE));
          continue;
        }
        if (cell === Cell.Lock) {
          // lock blocks connect like terrain: adjacent locks merge into one
          // continuous locked mass (generated at native 36px — no scaling);
          // off-board counts as connected so edge blocks run off-screen
          const lockAt = (lx: number, ly: number) =>
            lx >= 0 && lx < state.width && ly >= 0 && ly < state.height
              ? state.grid[ly]![lx] === Cell.Lock
              : true;
          const open: Open = {
            t: lockAt(x, y - 1),
            b: lockAt(x, y + 1),
            l: lockAt(x - 1, y),
            r: lockAt(x + 1, y),
          };
          add(scene.add.image(p.x, p.y, `lockblock-${maskKey(open)}`));
          continue;
        }
        if (cell === Cell.Spike) {
          // the original Kenney free-standing spikes
          add(scene.add.image(p.x, p.y, 'spike').setScale(KENNEY_SCALE));
          continue;
        }
        if (cell === Cell.SpikeBlock) {
          // per face: merge with neighbouring spike blocks, keep an outlined
          // boundary against other solids/board edges, grow teeth into air
          const face = (sx: number, sy: number): 'm' | 'e' | 'x' => {
            if (sy < 0) return 'x'; // board top: keep the lethal teeth
            if (sy >= state.height || sx < 0 || sx >= state.width) return 'e';
            const c = state.grid[sy]![sx]!;
            if (c === Cell.SpikeBlock) return 'm';
            const solid =
              c === Cell.Wall || c === Cell.Lock || c === Cell.Shed || c === Cell.ExitKey;
            return solid ? 'e' : 'x';
          };
          const fT = face(x, y - 1);
          const fB = face(x, y + 1);
          const fL = face(x - 1, y);
          const fR = face(x + 1, y);
          const key = ensureSpikeBlockTexture(
            scene,
            { t: fT, b: fB, l: fL, r: fR },
            {
              tl: fT === 'm' && fL === 'm' && face(x - 1, y - 1) === 'x',
              tr: fT === 'm' && fR === 'm' && face(x + 1, y - 1) === 'x',
              bl: fB === 'm' && fL === 'm' && face(x - 1, y + 1) === 'x',
              br: fB === 'm' && fR === 'm' && face(x + 1, y + 1) === 'x',
            },
          );
          add(scene.add.image(p.x, p.y, key));
          continue;
        }
        let key: string;
        if (cell === Cell.Wall) {
          key = terrainKey({
            t: !wallAt(x, y - 1),
            b: !wallAt(x, y + 1),
            l: !wallAt(x - 1, y),
            r: !wallAt(x + 1, y),
          });
        } else key = 'crate'; // Cell.Shed
        const img = scene.add.image(p.x, p.y, key).setScale(KENNEY_SCALE);
        if (cell === Cell.Shed && shedAt(x, y)) {
          img.setScale(KENNEY_SCALE * 0.4);
          scene.tweens.add({ targets: img, scale: KENNEY_SCALE, duration: 140, ease: 'Back.Out' });
        }
        add(img);
      }
    }

    // Terrain must not stop dead at the board edge — extend wall rows to the
    // screen edges and below the bottom so landmasses run off-screen.
    const sideTiles = Math.ceil(layout.ox / (TILE * layout.fit)) + 1;
    const extend = (edgeX: number, dir: -1 | 1) => {
      const isEdgeWall = (y: number) =>
        y >= 0 && y < state.height && state.grid[y]![edgeX] === Cell.Wall;
      for (let y = 0; y < state.height; y++) {
        if (!isEdgeWall(y)) continue;
        const key = terrainKey({
          t: !isEdgeWall(y - 1),
          b: y < state.height - 1 && !isEdgeWall(y + 1),
        });
        for (let i = 1; i <= sideTiles; i++) {
          const p = at(edgeX + dir * i, y);
          add(scene.add.image(p.x, p.y, key).setScale(KENNEY_SCALE));
        }
      }
    };
    extend(0, -1);
    extend(state.width - 1, 1);

    const belowPx = this.scene.scale.height - (layout.oy + state.height * TILE * layout.fit);
    const bottomRows = Math.ceil(belowPx / (TILE * layout.fit));
    // Any occupied bottom-row cell gets dirt beneath it — spikes, blocks and
    // doors sitting on the board's last row must not hover over a sky shaft.
    // Empty bottom cells stay open: those are intentional bottomless pits.
    const bottomIsGround = (x: number) => {
      const gx = Math.min(Math.max(x, 0), state.width - 1);
      return state.grid[state.height - 1]![x >= 0 && x < state.width ? x : gx] !== Cell.Empty;
    };
    for (let x = -sideTiles; x < state.width + sideTiles; x++) {
      if (!bottomIsGround(x)) continue;
      for (let i = 1; i <= bottomRows; i++) {
        const p = at(x, state.height - 1 + i);
        add(scene.add.image(p.x, p.y, 'terrain-none').setScale(KENNEY_SCALE));
      }
    }

    // Decorative flora on exposed grass tops — deterministic, never random.
    const DECOS = ['deco-sprout', 'deco-grass', 'deco-tree', 'deco-mushroom'];
    const seed = opts.decoSeed ?? 0;
    for (let y = 1; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        if (state.grid[y]![x] !== Cell.Wall) continue;
        if (state.grid[y - 1]![x] !== Cell.Empty) continue;
        const h = (x * 7349 + y * 131 + seed * 977) % 11;
        if (h > 3) continue;
        const p = at(x, y - 1);
        add(scene.add.image(p.x, p.y, DECOS[h]!).setScale(KENNEY_SCALE));
      }
    }

    // Static snake (editor preview only — the game scene animates its own).
    if (opts.staticSnake) {
      const snake = state.snake;
      for (let i = snake.length - 1; i >= 1; i--) {
        const seg = snake[i]!;
        const open: Open = {};
        open[sideTo(seg, snake[i - 1]!)] = true;
        const next = snake[i + 1];
        if (next) open[sideTo(seg, next)] = true;
        const p = at(seg.x, seg.y);
        add(scene.add.image(p.x, p.y, `body-${maskKey(open)}`));
      }
      const head = snake[0]!;
      const neck = snake[1];
      const front: Side = neck ? sideTo(neck, head) : 'r';
      const p = at(head.x, head.y);
      add(scene.add.image(p.x, p.y, neck ? `head-${front}` : 'head-solo'));
    }
  }
}

/** Which side of `a` faces `b` (adjacent cells). */
export function sideTo(a: Vec, b: Vec): Side {
  if (b.x > a.x) return 'r';
  if (b.x < a.x) return 'l';
  if (b.y > a.y) return 'b';
  return 't';
}
