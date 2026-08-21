import { LevelDef, parseLevel } from './level';
import { move, shed } from './rules';
import { DirName, GameEvent, GameState, cloneState } from './types';

export type Action =
  | { type: 'move'; dir: DirName }
  | { type: 'shed' }
  | { type: 'undo' }
  | { type: 'restart' };

export type ChangeListener = (state: GameState, events: GameEvent[]) => void;

/**
 * Orchestrates rule steps, undo history and notifications.
 * Observer pattern: the renderer subscribes via onChange and never pokes at
 * the rules directly — the engine is the single entry point for actions.
 */
export class GameEngine {
  private history: GameState[] = [];
  private listeners: ChangeListener[] = [];
  state: GameState;

  constructor(private levelDef: LevelDef) {
    this.state = parseLevel(levelDef);
  }

  get level(): LevelDef {
    return this.levelDef;
  }

  onChange(fn: ChangeListener): void {
    this.listeners.push(fn);
  }

  dispatch(action: Action): void {
    switch (action.type) {
      case 'move':
      case 'shed': {
        const result =
          action.type === 'move'
            ? move(this.state, action.dir)
            : shed(this.state);
        const changed = result.events.some((e) => e.type !== 'blocked');
        if (changed) {
          // Undo restores the state as it was before this action.
          this.history.push(cloneState(this.state));
          this.state = result.state;
        }
        this.notify(result.events);
        break;
      }
      case 'undo': {
        const prev = this.history.pop();
        if (prev) {
          this.state = prev;
          this.notify([]);
        }
        break;
      }
      case 'restart': {
        this.history = [];
        this.state = parseLevel(this.levelDef);
        this.notify([]);
        break;
      }
    }
  }

  private notify(events: GameEvent[]): void {
    for (const fn of this.listeners) fn(this.state, events);
  }
}
