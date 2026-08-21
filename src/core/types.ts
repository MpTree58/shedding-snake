/** Grid coordinate. Origin top-left; y grows downward (gravity = +y). */
export interface Vec {
  x: number;
  y: number;
}

export type DirName = 'up' | 'down' | 'left' | 'right';

export const DIRS: Record<DirName, Vec> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** Static content of one grid cell. The snake lives on top of this layer. */
export enum Cell {
  Empty = 0,
  Wall = 1,
  Spike = 2,
  Apple = 3,
  Exit = 4,
  /** A block created by shedding the snake's tail. Solid, permanent, never falls. */
  Shed = 5,
  /** Collectible; each key opens one lock block. */
  Key = 6,
  /** Solid until the snake spends a key on it. */
  Lock = 7,
  /** Door locked with a padlock: solid; bump it with a key to open. */
  ExitKey = 8,
  /** An unlocked door: entering it wins regardless of apples. */
  ExitOpen = 9,
  /**
   * Solid block with spikes on its top face. Connects like terrain.
   * Bumping its side is harmless (it's a wall); RESTING on top kills.
   */
  SpikeBlock = 10,
}

export type Status = 'playing' | 'dead' | 'won';
export type DeathCause = 'spike' | 'fall';

/**
 * Everything that changes during play. Pure data — no methods — so it can be
 * deep-cloned for undo history and serialized for save games / replays.
 */
export interface GameState {
  width: number;
  height: number;
  /** grid[y][x] — static layer (walls, spikes, apples, exit, shed blocks). */
  grid: Cell[][];
  /** Snake segments, head first. Each segment occupies one cell. */
  snake: Vec[];
  status: Status;
  deathCause?: DeathCause;
  applesLeft: number;
  keysHeld: number;
  moves: number;
}

/** Events emitted by a rule step, consumed by the renderer for feedback/animation. */
export type GameEvent =
  | { type: 'moved'; dir: DirName }
  | { type: 'ate'; at: Vec }
  | { type: 'key'; at: Vec }
  | { type: 'unlock'; at: Vec }
  | { type: 'blocked' }
  | { type: 'fell'; cells: number }
  | { type: 'shed'; at: Vec }
  | { type: 'died'; cause: DeathCause }
  | { type: 'won' };

export function vecEq(a: Vec, b: Vec): boolean {
  return a.x === b.x && a.y === b.y;
}

export function cloneState(s: GameState): GameState {
  return {
    ...s,
    grid: s.grid.map((row) => [...row]),
    snake: s.snake.map((v) => ({ ...v })),
  };
}
