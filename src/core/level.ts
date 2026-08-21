import { Cell, GameState, Vec } from './types';

/**
 * ASCII level format (pattern borrowed from the snakefall / M-FF-M snakebird
 * open-source clones — human-readable, hand-editable, trivially diffable):
 *
 *   .  empty          #  wall
 *   ^  spike          o  apple
 *   E  exit           H  snake head
 *   k  key            L  lock block (solid until a key is spent on it)
 *   D  key-locked door (bump with a key to open)
 *   O  open door (no lock: entering wins regardless of apples)
 *   S  spike block (solid, connects like terrain, deadly to rest on)
 *   1..9  snake body segments, in order from the head outward
 *
 * The apple door (E) only opens once all apples are eaten; the key door (D)
 * opens when bumped while holding a key. Both then become plain open doors.
 */
export interface LevelDef {
  name: string;
  hint?: string;
  map: string;
}

export function parseLevel(def: LevelDef): GameState {
  const lines = def.map
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);
  const height = lines.length;
  const width = Math.max(...lines.map((l) => l.length));

  const grid: Cell[][] = [];
  let head: Vec | undefined;
  const body: { order: number; at: Vec }[] = [];
  let applesLeft = 0;

  for (let y = 0; y < height; y++) {
    const row: Cell[] = [];
    const line = lines[y] ?? '';
    for (let x = 0; x < width; x++) {
      const ch = line[x] ?? '.';
      switch (ch) {
        case '#':
          row.push(Cell.Wall);
          break;
        case '^':
          row.push(Cell.Spike);
          break;
        case 'o':
          row.push(Cell.Apple);
          applesLeft++;
          break;
        case 'E':
          row.push(Cell.Exit);
          break;
        case 'k':
          row.push(Cell.Key);
          break;
        case 'L':
          row.push(Cell.Lock);
          break;
        case 'D':
          row.push(Cell.ExitKey);
          break;
        case 'O':
          row.push(Cell.ExitOpen);
          break;
        case 'S':
          row.push(Cell.SpikeBlock);
          break;
        case 'H':
          head = { x, y };
          row.push(Cell.Empty);
          break;
        case '.':
          row.push(Cell.Empty);
          break;
        default: {
          if (ch >= '1' && ch <= '9') {
            body.push({ order: Number(ch), at: { x, y } });
            row.push(Cell.Empty);
          } else {
            throw new Error(`Level "${def.name}": unknown char '${ch}' at ${x},${y}`);
          }
        }
      }
    }
    grid.push(row);
  }

  if (!head) throw new Error(`Level "${def.name}": no head (H) found`);
  body.sort((a, b) => a.order - b.order);
  const snake: Vec[] = [head, ...body.map((b) => b.at)];

  // Guard against level typos: every segment must touch the previous one.
  for (let i = 1; i < snake.length; i++) {
    const a = snake[i - 1]!;
    const b = snake[i]!;
    if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) !== 1) {
      throw new Error(`Level "${def.name}": segment ${i} not adjacent to segment ${i - 1}`);
    }
  }

  return {
    width,
    height,
    grid,
    snake,
    status: 'playing',
    applesLeft,
    keysHeld: 0,
    moves: 0,
  };
}
