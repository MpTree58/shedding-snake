import { LevelDef, parseLevel } from './level';
import { move, shed } from './rules';
import { DirName, GameState } from './types';

export type Action = DirName | 'shed';
const ACTIONS: Action[] = ['left', 'right', 'up', 'down', 'shed'];

function serialize(s: GameState): string {
  // mutable state only: grid cells (apples/locks/doors/sheds change), snake, keys
  let g = '';
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) g += s.grid[y]![x]!;
  }
  return g + '|' + s.snake.map((p) => p.x + ',' + p.y).join(';') + '|' + s.keysHeld;
}

/**
 * Breadth-first search over game states → a SHORTEST solution (or null).
 * Used by tests to guarantee every campaign level is solvable and to measure
 * difficulty (minimum move count). Small boards keep the state space tame.
 */
export function solve(
  def: LevelDef,
  opts: { maxStates?: number; allowShed?: boolean } = {},
): Action[] | null {
  const maxStates = opts.maxStates ?? 500_000;
  const allowShed = opts.allowShed ?? true;
  const start = parseLevel(def);
  const seen = new Set<string>([serialize(start)]);
  let frontier: { s: GameState; path: Action[] }[] = [{ s: start, path: [] }];

  while (frontier.length > 0 && seen.size < maxStates) {
    const next: typeof frontier = [];
    for (const { s, path } of frontier) {
      for (const a of ACTIONS) {
        if (a === 'shed' && !allowShed) continue;
        const r = a === 'shed' ? shed(s) : move(s, a);
        if (r.state === s) continue; // blocked — state unchanged
        if (r.state.status === 'dead') continue;
        if (r.state.status === 'won') return [...path, a];
        const k = serialize(r.state);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ s: r.state, path: [...path, a] });
      }
    }
    frontier = next;
  }
  return null;
}
