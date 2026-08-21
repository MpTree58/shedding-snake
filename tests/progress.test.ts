import { describe, expect, it } from 'vitest';
import { Progress, SaveBackend } from '../src/progress';

class FakeBackend implements SaveBackend {
  private store = new Map<string, string>();
  get(k: string): string | null {
    return this.store.get(k) ?? null;
  }
  set(k: string, v: string): void {
    this.store.set(k, v);
  }
}

describe('campaign progress', () => {
  it('only level 0 is unlocked at first', () => {
    const p = new Progress(new FakeBackend());
    expect(p.isUnlocked(0)).toBe(true);
    expect(p.isUnlocked(1)).toBe(false);
  });

  it('each completion unlocks exactly the next level', () => {
    const p = new Progress(new FakeBackend());
    p.markCompleted(0);
    expect(p.isUnlocked(1)).toBe(true);
    expect(p.isUnlocked(2)).toBe(false);
  });

  it('progress never regresses when replaying old levels', () => {
    const p = new Progress(new FakeBackend());
    p.markCompleted(3);
    p.markCompleted(0); // replaying level 1 must not lock levels again
    expect(p.highestCompleted()).toBe(3);
    expect(p.isUnlocked(4)).toBe(true);
  });
});
