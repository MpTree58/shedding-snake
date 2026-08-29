import { describe, expect, it } from 'vitest';
import { solve } from '../src/core/solver';
import { LEVELS } from '../src/levels';

describe('campaign levels', () => {
  it('every level is solvable', () => {
    for (const level of LEVELS) {
      const sol = solve(level, { maxStates: 800_000 });
      expect(sol, `${level.name} must be solvable`).not.toBeNull();
      console.log(`${level.name}: min ${sol!.length} moves`);
    }
  });

  it('the finale requires the shed mechanic', () => {
    const finale = LEVELS[LEVELS.length - 1]!;
    const withoutShed = solve(finale, { maxStates: 800_000, allowShed: false });
    expect(withoutShed, 'finale must be impossible without shedding').toBeNull();
  });
});
