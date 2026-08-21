/**
 * Campaign progress: which levels the player has beaten and may enter.
 *
 * Storage is behind a tiny SaveBackend interface on purpose:
 * - today: localStorage (works on CrazyGames too — the game runs in an
 *   iframe with its own origin storage);
 * - at CrazyGames SDK integration: swap in a backend built on the SDK's
 *   data module, which mirrors the localStorage API and additionally syncs
 *   to the player's CrazyGames account across devices when they're logged
 *   in. Only `setBackend` needs to be called — nothing else changes.
 */
export interface SaveBackend {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

class LocalStorageBackend implements SaveBackend {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null; // private mode / storage blocked — progress just won't persist
    }
  }
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }
}

const KEY = 'shedding-snake.progress';

export class Progress {
  constructor(private backend: SaveBackend = new LocalStorageBackend()) {}

  setBackend(backend: SaveBackend): void {
    this.backend = backend;
  }

  /** Index of the highest COMPLETED level, or -1 if none. */
  highestCompleted(): number {
    const raw = this.backend.get(KEY);
    if (!raw) return -1;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : -1;
  }

  /** Level 0 is always open; each win opens the next one. */
  isUnlocked(index: number): boolean {
    return index <= this.highestCompleted() + 1;
  }

  markCompleted(index: number): void {
    if (index > this.highestCompleted()) {
      this.backend.set(KEY, String(index));
    }
  }
}

/** Shared instance used by the scenes. */
export const progress = new Progress();
