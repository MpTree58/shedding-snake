import { describe, expect, it } from 'vitest';
import { GameEngine } from '../src/core/engine';
import { parseLevel } from '../src/core/level';
import { move, shed } from '../src/core/rules';
import { Cell } from '../src/core/types';

const lvl = (map: string) => parseLevel({ name: 'test', map });

describe('parseLevel', () => {
  it('parses snake head-first with ordered body', () => {
    const s = lvl(`
.21H.
#####
`);
    expect(s.snake).toEqual([
      { x: 3, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 0 },
    ]);
  });

  it('rejects a disconnected snake', () => {
    expect(() => lvl(`
.1.H.
#####
`)).toThrow(/not adjacent/);
  });
});

describe('movement', () => {
  it('moves head and drags tail', () => {
    const s = lvl(`
.1H..
#####
`);
    const { state } = move(s, 'right');
    expect(state.snake).toEqual([
      { x: 3, y: 0 },
      { x: 2, y: 0 },
    ]);
  });

  it('is blocked by walls and by its own body', () => {
    const s = lvl(`
#1H..
#####
`);
    expect(move(s, 'left').events).toEqual([{ type: 'blocked' }]);
    // own body: head trying to move back onto the neck
    const vertical = lvl(`
.H...
.1...
#####
`);
    expect(move(vertical, 'down').events).toEqual([{ type: 'blocked' }]);
  });

  it('eating an apple grows the snake by one', () => {
    const s = lvl(`
.1Ho.
#####
`);
    const { state } = move(s, 'right');
    expect(state.snake.length).toBe(3);
    expect(state.applesLeft).toBe(0);
    expect(state.grid[0]![3]).toBe(Cell.Empty);
  });
});

describe('exit', () => {
  it('stays closed while apples remain', () => {
    const s = lvl(`
.1HEo
#####
`);
    const { state } = move(s, 'right');
    expect(state.status).toBe('playing'); // walked through a closed door
  });

  it('opens when all apples are eaten', () => {
    const s = lvl(`
.1HE.
#####
`);
    const { state, events } = move(s, 'right');
    expect(state.status).toBe('won');
    expect(events.at(-1)).toEqual({ type: 'won' });
  });
});

describe('gravity', () => {
  it('falls until landing on solid ground', () => {
    const s = lvl(`
.1H..
.....
.....
#####
`);
    const { state, events } = move(s, 'right');
    expect(state.snake[0]).toEqual({ x: 3, y: 2 });
    expect(events).toContainEqual({ type: 'fell', cells: 2 });
  });

  it('any body segment over solid ground is enough support', () => {
    // Head hangs over the gap; tail stays on the ledge — no fall.
    const s = lvl(`
21H..
##...
`);
    const { state } = move(s, 'right'); // tail still above the wall at x1
    expect(state.status).toBe('playing');
    expect(state.snake[0]!.y).toBe(0);
  });

  it('falling off the board is death', () => {
    const s = lvl(`
21H..
##...
`);
    const a = move(s, 'right'); // tail above the ledge — supported
    const b = move(a.state, 'right'); // whole snake past the ledge
    expect(b.state.status).toBe('dead');
    expect(b.state.deathCause).toBe('fall');
  });

  it('falling into spikes is death, but hanging above them is safe', () => {
    const hover = lvl(`
.1H..
##^..
`);
    // Head is directly above a spike but the snake is supported: safe.
    expect(hover.status).toBe('playing');
    const s = lvl(`
.1H..
##...
..^..
#####
`);
    const { state } = move(s, 'right');
    expect(state.status).toBe('dead');
    expect(state.deathCause).toBe('spike');
  });
});

describe('falling head eats and collects', () => {
  it('eats an apple the head lands on mid-fall and grows', () => {
    const s = lvl(`
.1H..
.....
...o.
.....
#####
`);
    const { state, events } = move(s, 'right');
    expect(state.applesLeft).toBe(0);
    expect(state.snake.length).toBe(3);
    expect(events).toContainEqual({ type: 'ate', at: { x: 3, y: 2 } });
    expect(state.status).toBe('playing');
    expect(state.snake[0]!.y).toBe(3); // landed on the floor
  });

  it('collects a key the head falls through', () => {
    const s = lvl(`
.1H..
.....
...k.
#####
`);
    const { state } = move(s, 'right');
    expect(state.keysHeld).toBe(1);
  });
});

describe('lock & key', () => {
  it('locks block movement without a key and support the snake', () => {
    const s = lvl(`
.1HL.
#####
`);
    expect(move(s, 'right').events).toEqual([{ type: 'blocked' }]);
  });

  it('a key opens a lock; both are consumed', () => {
    const s = lvl(`
.1HkL.
######
`);
    const a = move(s, 'right'); // grab key
    expect(a.state.keysHeld).toBe(1);
    const b = move(a.state, 'right'); // open lock and enter its cell
    expect(b.state.keysHeld).toBe(0);
    expect(b.state.snake[0]).toEqual({ x: 4, y: 0 });
    expect(b.events).toContainEqual({ type: 'unlock', at: { x: 4, y: 0 } });
  });

  it('a shed block and a lock both count as solid ground', () => {
    const s = lvl(`
.1H..
..L..
.....
#####
`);
    const { state } = move(s, 'right'); // head above the lock: supported
    expect(state.status).toBe('playing');
    expect(state.snake[0]!.y).toBe(0);
  });
});

describe('open door (O)', () => {
  it('can be placed directly and wins on entry even with apples left', () => {
    const s = lvl(`
.1HO.o
######
`);
    const { state } = move(s, 'right');
    expect(state.status).toBe('won');
    expect(state.applesLeft).toBe(1);
  });
});

describe('spike block', () => {
  it('deliberately pushing into it from any direction kills', () => {
    const s = lvl(`
.1HS.
#####
`);
    const r = move(s, 'right');
    expect(r.state.status).toBe('dead');
    expect(r.state.deathCause).toBe('spike');
    expect(r.state.snake[0]).toEqual({ x: 2, y: 0 }); // impaled in place
  });

  it('landing on top of one is death', () => {
    const s = lvl(`
21H..
##...
..S..
..###
`);
    const a = move(s, 'right'); // tail leaves the ledge…
    const b = move(a.state, 'right'); // …snake drops onto the spike block
    expect(b.state.status).toBe('dead');
    expect(b.state.deathCause).toBe('spike');
  });

  it('hanging a segment above the teeth is SAFE while safe ground carries you', () => {
    const s = lvl(`
.1H..
###S#
`);
    const { state } = move(s, 'right'); // head above S, neck on safe wall
    expect(state.status).toBe('playing');
  });

  it('bridging across it with safe support elsewhere is safe too', () => {
    const s = lvl(`
21H..
##S##
`);
    const { state } = move(s, 'right');
    expect(state.status).toBe('playing');
  });

  it('dies when spikes are the ONLY thing holding it up', () => {
    const s = lvl(`
.1H..
##SS.
`);
    const { state } = move(s, 'right'); // both segments now rest on teeth
    expect(state.status).toBe('dead');
    expect(state.deathCause).toBe('spike');
  });
});

describe('key door (ExitKey)', () => {
  it('is solid: blocked without a key', () => {
    const s = lvl(`
.1HD.
#####
`);
    expect(move(s, 'right').events).toEqual([{ type: 'blocked' }]);
  });

  it('bumping with a key unlocks it in place (snake does not move)', () => {
    const s = lvl(`
.1HkD.
######
`);
    const a = move(s, 'right'); // grab key
    const b = move(a.state, 'right'); // bump the locked door
    expect(b.state.keysHeld).toBe(0);
    expect(b.state.grid[0]![4]).toBe(Cell.ExitOpen);
    expect(b.state.snake[0]).toEqual({ x: 3, y: 0 }); // stayed put
    expect(b.events).toContainEqual({ type: 'unlock', at: { x: 4, y: 0 } });
  });

  it('entering an unlocked door wins even with apples left', () => {
    const s = lvl(`
.1HkD.o
#######
`);
    const a = move(s, 'right'); // key
    const b = move(a.state, 'right'); // unlock
    const c = move(b.state, 'right'); // enter
    expect(c.state.status).toBe('won');
    expect(c.state.applesLeft).toBe(1); // apples were never required
  });
});

describe('shed — the signature mechanic', () => {
  it('freezes the tail into a solid block and shortens the snake', () => {
    const s = lvl(`
.21H.
#####
`);
    const { state, events } = shed(s);
    expect(state.snake.length).toBe(2);
    expect(state.grid[0]![1]).toBe(Cell.Shed);
    expect(events[0]).toEqual({ type: 'shed', at: { x: 1, y: 0 } });
  });

  it('a shed block left mid-air becomes a permanent foothold', () => {
    // Vertical snake hanging from a ledge: shed the bottom segment, the
    // block freezes in mid-air and now supports the rest of the snake.
    const s = lvl(`
#H...
#1...
#2...
.....
`);
    const { state } = shed(s);
    expect(state.grid[2]![1]).toBe(Cell.Shed); // frozen where the tail was
    expect(state.status).toBe('playing'); // supported by own shed block
    expect(state.snake.length).toBe(2);
  });

  it('cannot shed below length 2', () => {
    const s = lvl(`
.1H..
#####
`);
    const once = shed(s);
    expect(once.state.snake.length).toBe(1);
    const twice = shed(once.state);
    expect(twice.events).toEqual([{ type: 'blocked' }]);
  });
});

describe('engine (undo/restart)', () => {
  it('undo restores the exact previous state, including after death', () => {
    const engine = new GameEngine({
      name: 't',
      map: `
21H..
##...
`,
    });
    engine.dispatch({ type: 'move', dir: 'right' });
    engine.dispatch({ type: 'move', dir: 'right' }); // falls off — dead
    expect(engine.state.status).toBe('dead');
    engine.dispatch({ type: 'undo' });
    expect(engine.state.status).toBe('playing');
    expect(engine.state.snake[0]).toEqual({ x: 3, y: 0 });
  });

  it('blocked actions do not pollute undo history', () => {
    const engine = new GameEngine({
      name: 't',
      map: `
#1H..
#####
`,
    });
    engine.dispatch({ type: 'move', dir: 'left' }); // blocked
    engine.dispatch({ type: 'move', dir: 'right' });
    engine.dispatch({ type: 'undo' });
    expect(engine.state.snake[0]).toEqual({ x: 2, y: 0 }); // back to start
    engine.dispatch({ type: 'undo' }); // history empty — no-op
    expect(engine.state.snake[0]).toEqual({ x: 2, y: 0 });
  });
});
