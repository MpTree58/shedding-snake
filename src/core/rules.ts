import { Cell, DIRS, DirName, GameEvent, GameState, cloneState, vecEq } from './types';

/**
 * Pure rule functions: (state, action) -> { state', events }.
 * Never mutate the input state; the returned state is a fresh clone.
 * This module must stay free of any rendering/Phaser imports so the whole
 * game logic can be ported to other shells (TikTok Minis, WeChat) untouched.
 */

export interface StepResult {
  state: GameState;
  events: GameEvent[];
}

function isSolid(cell: Cell): boolean {
  return (
    cell === Cell.Wall ||
    cell === Cell.Shed ||
    cell === Cell.Lock ||
    cell === Cell.ExitKey || // a padlocked door is as solid as a wall
    cell === Cell.SpikeBlock // solid too — but resting on top of one kills
  );
}

function cellAt(s: GameState, x: number, y: number): Cell {
  if (x < 0 || x >= s.width || y < 0 || y >= s.height) return Cell.Empty;
  return s.grid[y]![x]!;
}

function occupiedBySnake(s: GameState, v: { x: number; y: number }): boolean {
  return s.snake.some((seg) => vecEq(seg, v));
}

/** Move the head one cell in `dir`; body follows. */
export function move(state: GameState, dir: DirName): StepResult {
  if (state.status !== 'playing') return { state, events: [] };

  const d = DIRS[dir];
  const head = state.snake[0]!;
  const target = { x: head.x + d.x, y: head.y + d.y };

  // Off the sides/top of the board, into solids, spikes, or own body: blocked.
  if (
    target.x < 0 ||
    target.x >= state.width ||
    target.y < 0 ||
    target.y >= state.height
  ) {
    return { state, events: [{ type: 'blocked' }] };
  }
  const targetCell = cellAt(state, target.x, target.y);
  // Deliberately pushing into a spike block from any direction impales the
  // snake — the one aggressive act that kills instantly. (Hanging near one
  // is safe; see applyGravity for the weight-based rule.)
  if (targetCell === Cell.SpikeBlock) {
    const s = cloneState(state);
    s.status = 'dead';
    s.deathCause = 'spike';
    s.moves++;
    return { state: s, events: [{ type: 'died', cause: 'spike' }] };
  }
  // Bumping a padlocked door with a key unlocks it (the snake stays put;
  // the door becomes a plain open door you can enter next move).
  if (targetCell === Cell.ExitKey && state.keysHeld > 0) {
    const s = cloneState(state);
    s.keysHeld--;
    s.grid[target.y]![target.x] = Cell.ExitOpen;
    s.moves++;
    const events: GameEvent[] = [{ type: 'unlock', at: target }];
    // the door was solid support — opening it may drop the snake
    applyGravity(s, events);
    return { state: s, events };
  }
  // A lock block opens (and is entered) if the snake holds a key.
  const unlocking = targetCell === Cell.Lock && state.keysHeld > 0;
  if ((isSolid(targetCell) && !unlocking) || targetCell === Cell.Spike) {
    return { state, events: [{ type: 'blocked' }] };
  }
  if (occupiedBySnake(state, target)) {
    return { state, events: [{ type: 'blocked' }] };
  }

  const s = cloneState(state);
  const events: GameEvent[] = [];
  s.snake.unshift(target);
  s.moves++;

  if (targetCell === Cell.Apple) {
    s.grid[target.y]![target.x] = Cell.Empty;
    s.applesLeft--;
    events.push({ type: 'moved', dir }, { type: 'ate', at: target });
    // Eating: tail is NOT removed — that's how the snake grows.
  } else if (targetCell === Cell.Key) {
    s.grid[target.y]![target.x] = Cell.Empty;
    s.keysHeld++;
    s.snake.pop();
    events.push({ type: 'moved', dir }, { type: 'key', at: target });
  } else if (unlocking) {
    s.grid[target.y]![target.x] = Cell.Empty;
    s.keysHeld--;
    s.snake.pop();
    events.push({ type: 'moved', dir }, { type: 'unlock', at: target });
  } else {
    s.snake.pop();
    events.push({ type: 'moved', dir });
  }

  // Apple door opens only when all apples are eaten; an unlocked door
  // (ExitOpen) always wins on entry.
  if (
    (targetCell === Cell.Exit && s.applesLeft === 0) ||
    targetCell === Cell.ExitOpen
  ) {
    s.status = 'won';
    events.push({ type: 'won' });
    return { state: s, events };
  }

  applyGravity(s, events);
  return { state: s, events };
}

/**
 * Shed the tail: the last segment freezes into a permanent solid block
 * (Cell.Shed) at its current position, and the snake shortens by one.
 * Body = health = building material — the game's signature mechanic.
 */
export function shed(state: GameState): StepResult {
  if (state.status !== 'playing') return { state, events: [] };
  if (state.snake.length < 2) return { state, events: [{ type: 'blocked' }] };

  const s = cloneState(state);
  const events: GameEvent[] = [];
  const tail = s.snake.pop()!;
  s.grid[tail.y]![tail.x] = Cell.Shed;
  s.moves++;
  events.push({ type: 'shed', at: tail });

  applyGravity(s, events);
  return { state: s, events };
}

/**
 * Gravity, resolved after every action, one cell at a time:
 * - if any segment rests on a solid cell (wall/shed block), the snake stands;
 * - otherwise it falls one cell — unless that fall would push a segment into
 *   a spike (death) — and the check repeats;
 * - falling completely off the bottom of the board is death;
 * - if the head passes through an open exit mid-fall, that's a win.
 * Segments hanging *above* spikes are safe; only falling INTO them kills.
 */
function applyGravity(s: GameState, events: GameEvent[]): void {
  let fell = 0;
  const maxIter = s.height * 2 + 4; // safety bound
  for (let i = 0; i < maxIter; i++) {
    // Weight-based support (Snakebird semantics): safe solids CARRY the
    // snake; spike blocks stop the fall but impale. A snake held by at
    // least one safe support may hang segments above spike teeth freely —
    // it only dies when spikes are ALL that keeps it up.
    let safeSupport = false;
    let spikeSupport = false;
    for (const seg of s.snake) {
      const below = { x: seg.x, y: seg.y + 1 };
      if (occupiedBySnake(s, below)) continue; // own body is not support
      if (below.y >= s.height) continue;
      const cell = cellAt(s, below.x, below.y);
      if (cell === Cell.SpikeBlock) spikeSupport = true;
      else if (isSolid(cell)) safeSupport = true;
    }
    if (safeSupport) break; // carried by safe ground — hanging over teeth is fine
    if (spikeSupport) {
      // nothing safe holds the snake: its weight lands on the teeth
      s.status = 'dead';
      s.deathCause = 'spike';
      if (fell > 0) events.push({ type: 'fell', cells: fell });
      events.push({ type: 'died', cause: 'spike' });
      return;
    }

    // Would any segment fall into a spike?
    const impaled = s.snake.some(
      (seg) => cellAt(s, seg.x, seg.y + 1) === Cell.Spike,
    );
    if (impaled) {
      s.status = 'dead';
      s.deathCause = 'spike';
      events.push({ type: 'died', cause: 'spike' });
      break;
    }

    // Fall one cell.
    for (const seg of s.snake) seg.y++;
    fell++;

    // The head still eats/collects what it lands on while falling —
    // "my head touched the apple" must always mean "I ate the apple".
    const head = s.snake[0]!;
    const headCell = cellAt(s, head.x, head.y);
    if (headCell === Cell.Apple) {
      s.grid[head.y]![head.x] = Cell.Empty;
      s.applesLeft--;
      // Grow: duplicate the tail in place; the overlap resolves on the
      // next regular move (standard snake growth trick).
      s.snake.push({ ...s.snake[s.snake.length - 1]! });
      events.push({ type: 'ate', at: { ...head } });
    } else if (headCell === Cell.Key) {
      s.grid[head.y]![head.x] = Cell.Empty;
      s.keysHeld++;
      events.push({ type: 'key', at: { ...head } });
    }

    // Head passing through an open exit while falling counts as a win.
    const fallCell = cellAt(s, head.x, head.y);
    if (
      (s.applesLeft === 0 && fallCell === Cell.Exit) ||
      fallCell === Cell.ExitOpen
    ) {
      s.status = 'won';
      events.push({ type: 'fell', cells: fell }, { type: 'won' });
      return;
    }

    // Entirely below the board: gone.
    if (s.snake.every((seg) => seg.y >= s.height)) {
      s.status = 'dead';
      s.deathCause = 'fall';
      events.push({ type: 'fell', cells: fell }, { type: 'died', cause: 'fall' });
      return;
    }
  }
  if (fell > 0) events.push({ type: 'fell', cells: fell });
}
