import Phaser from 'phaser';

/**
 * Self-made art: ONLY the snake (our meme-face IP) and the apple.
 * Drawn at the Kenney logical grid (18x18 px, rendered 2x = 36px) with the
 * palette sampled from the Kenney Pixel Platformer tiles — see STYLE.md.
 *
 * Snake segments are connection-aware like the terrain autotiles: outlines
 * are drawn only on sides NOT connected to a neighbouring segment, so the
 * snake reads as one continuous body instead of a row of boxes.
 */

const PX = 2; // screen pixels per logical pixel (18 * 2 = 36)
export const TILE = 36;

// Palette sampled from Kenney tiles (see STYLE.md §2)
const OUTLINE = 0x434a5f;
const GREEN = 0x36e377;
const GREEN_SHADE = 0x2eb082;
const WHITE = 0xffffff;
const PUPIL = 0x20344a;
const RED = 0xdd442c;
const STEM = 0x9f5a52;

export interface Open {
  t?: boolean;
  b?: boolean;
  l?: boolean;
  r?: boolean;
}

export type Side = 't' | 'b' | 'l' | 'r';

export function maskKey(open: Open): string {
  return (
    `${open.t ? 't' : ''}${open.b ? 'b' : ''}${open.l ? 'l' : ''}${open.r ? 'r' : ''}` ||
    'none'
  );
}

/** All body-segment connection shapes that can occur (caps, straights, bends). */
export const BODY_MASKS: Open[] = [
  { t: true },
  { b: true },
  { l: true },
  { r: true },
  { t: true, b: true },
  { l: true, r: true },
  { t: true, l: true },
  { t: true, r: true },
  { b: true, l: true },
  { b: true, r: true },
];

class Painter {
  private g: Phaser.GameObjects.Graphics;
  constructor(private scene: Phaser.Scene) {
    this.g = scene.add.graphics();
  }
  px(x: number, y: number, color: number): void {
    this.g.fillStyle(color, 1);
    this.g.fillRect(x * PX, y * PX, PX, PX);
  }
  save(key: string): void {
    this.g.generateTexture(key, 18 * PX, 18 * PX);
    this.g.destroy();
  }
}

interface BlockPalette {
  fill: number;
  shade: number;
  outline: number;
}

/**
 * Connection-aware rounded block: outline on closed sides only, corner
 * pixels cut where two closed sides meet (Kenney-style radius-1 rounding),
 * bottom shade band. Shared by the snake body and the lock-block family —
 * anything that must read as ONE continuous mass when tiled.
 */
function drawBlockBase(p: Painter, open: Open, pal: BlockPalette): void {
  const cT = !open.t;
  const cB = !open.b;
  const cL = !open.l;
  const cR = !open.r;
  for (let y = 0; y < 18; y++) {
    for (let x = 0; x < 18; x++) {
      // rounded corners: skip the very corner pixel between two closed sides
      if (
        (x === 0 && y === 0 && cT && cL) ||
        (x === 17 && y === 0 && cT && cR) ||
        (x === 0 && y === 17 && cB && cL) ||
        (x === 17 && y === 17 && cB && cR)
      ) {
        continue;
      }
      const onOutline =
        (y === 0 && cT) || (y === 17 && cB) || (x === 0 && cL) || (x === 17 && cR);
      if (onOutline) {
        p.px(x, y, pal.outline);
        continue;
      }
      // shade along the bottom, consistent light-from-above
      const bellyTop = 13;
      const inBelly = y >= bellyTop && y <= (cB ? 16 : 17);
      p.px(x, y, inBelly ? pal.shade : pal.fill);
    }
  }
}

const SNAKE_PAL: BlockPalette = { fill: GREEN, shade: GREEN_SHADE, outline: OUTLINE };

function drawSegmentBase(p: Painter, open: Open): void {
  drawBlockBase(p, open, SNAKE_PAL);
}

function drawFace(p: Painter, front: Side, dead: boolean): void {
  // Big upright Kenney-style eyes regardless of travel direction.
  const eyes: [number, number][] = [
    [4, 4],
    [11, 4],
  ];
  for (const [ex, ey] of eyes) {
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 4; x++) p.px(ex + x, ey + y, WHITE);
    }
    if (dead) {
      // X-eyes
      p.px(ex, ey, PUPIL);
      p.px(ex + 3, ey, PUPIL);
      p.px(ex + 1, ey + 1, PUPIL);
      p.px(ex + 2, ey + 1, PUPIL);
      p.px(ex + 1, ey + 2, PUPIL);
      p.px(ex + 2, ey + 2, PUPIL);
      p.px(ex, ey + 3, PUPIL);
      p.px(ex + 3, ey + 3, PUPIL);
    } else {
      p.px(ex + 1, ey + 2, PUPIL);
      p.px(ex + 2, ey + 2, PUPIL);
      p.px(ex + 1, ey + 3, PUPIL);
      p.px(ex + 2, ey + 3, PUPIL);
    }
  }
  // Tongue pokes out of the mouth on the travel side (longer when dead).
  const len = dead ? 3 : 2;
  if (front === 'r') {
    for (let i = 0; i < len; i++) {
      p.px(15 + i, 11, RED);
      p.px(15 + i, 12, RED);
    }
  } else if (front === 'l') {
    for (let i = 0; i < len; i++) {
      p.px(2 - i, 11, RED);
      p.px(2 - i, 12, RED);
    }
  } else if (front === 't') {
    for (let i = 0; i < len; i++) {
      p.px(8, 2 - i, RED);
      p.px(9, 2 - i, RED);
    }
  } else {
    for (let i = 0; i < len; i++) {
      p.px(8, 15 + i, RED);
      p.px(9, 15 + i, RED);
    }
  }
}

function drawApple(p: Painter): void {
  // 18x18 apple with Kenney outline + palette
  const body: [number, number, number][] = [
    // x, y, width — outline rows first
    [5, 4, 8],
  ];
  void body;
  // outline ring
  for (let x = 5; x <= 12; x++) {
    p.px(x, 4, OUTLINE);
    p.px(x, 15, OUTLINE);
  }
  for (let y = 5; y <= 14; y++) {
    p.px(4, y, OUTLINE);
    p.px(13, y, OUTLINE);
  }
  // fill
  for (let y = 5; y <= 14; y++) {
    for (let x = 5; x <= 12; x++) p.px(x, y, RED);
  }
  // shine
  p.px(6, 6, WHITE);
  p.px(7, 6, WHITE);
  p.px(6, 7, WHITE);
  // stem + leaf
  p.px(8, 3, STEM);
  p.px(8, 2, STEM);
  p.px(9, 2, GREEN_SHADE);
  p.px(10, 2, GREEN);
  p.px(10, 1, GREEN);
}

function drawPadlock(p: Painter, body: number, opts: { leaf?: boolean } = {}): void {
  const O = 0x6f3e43; // key-family outline, sampled from tile 0027
  const rows = [
    '..OOO..',
    '.O...O.',
    '.O...O.',
    'OOOOOOO',
    'OBBBBBO',
    'OBBOBBO',
    'OBBOBBO',
    'OBBBBBO',
    'OOOOOOO',
  ];
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === 'O') p.px(x, y, O);
      else if (ch === 'B') p.px(x, y, body);
    });
  });
  if (opts.leaf) {
    // a leaf + shine turn the red padlock into an "apple lock"
    p.px(4, 0, GREEN);
    p.px(5, 0, GREEN_SHADE);
    p.px(2, 4, WHITE);
  }
}

/** All 16 t/b/l/r connection combinations. */
function allMasks(): Open[] {
  const masks: Open[] = [];
  for (const t of [false, true]) {
    for (const b of [false, true]) {
      for (const l of [false, true]) {
        for (const r of [false, true]) {
          masks.push({ t, b, l, r });
        }
      }
    }
  }
  return masks;
}

// wood palette sampled from the Kenney crates
const WOOD = 0xcb815e;
const WOOD_DARK = 0x9f5a52;
const GOLD = 0xf4b41b;
const DARK = 0x434a5f;
const METAL = 0x8b97a8;

/**
 * Lock block detail, design "L3 · plank crate" (团队选定):
 * plank seams + a dark keyhole plate with a golden keyhole ring.
 * One keyhole per cell — each cell costs one key.
 */
function drawLockDetail(p: Painter, open: Open): void {
  const KEYPLATE = 0x6f3e43; // key-family dark, sampled from tile 0027
  // plank seams: run edge-to-edge on connected sides so the wood grain
  // continues across merged blocks; inset one pixel on exposed sides
  for (const y of [6, 12]) {
    const x0 = open.l ? 0 : 2;
    const x1 = open.r ? 17 : 15;
    for (let x = x0; x <= x1; x++) {
      if (x >= 6 && x <= 11 && y >= 5 && y <= 12) continue; // under the plate
      p.px(x, y, WOOD_DARK);
    }
  }
  // keyhole plate + golden keyhole (ring + slot)
  for (let y = 5; y <= 12; y++) {
    for (let x = 6; x <= 11; x++) p.px(x, y, KEYPLATE);
  }
  p.px(8, 7, GOLD);
  p.px(9, 7, GOLD);
  p.px(7, 8, GOLD);
  p.px(10, 8, GOLD);
  p.px(8, 9, GOLD);
  p.px(9, 9, GOLD);
  p.px(8, 10, GOLD);
  p.px(9, 10, GOLD);
}

/** Per-face state of a spike block:
 *  'm' merge (another spike block — seamless), 'e' edged (flush against a
 *  solid or the board edge — outlined, no teeth), 'x' exposed (outline,
 *  base bar and teeth). */
export type SpikeFace = 'm' | 'e' | 'x';
export interface SpikeFaces {
  t: SpikeFace;
  b: SpikeFace;
  l: SpikeFace;
  r: SpikeFace;
}

/**
 * Spike block, design "K3 · 基座环绕" (团队选定):
 * teeth grow on every face exposed to passable space; faces embedded
 * against other solids keep a clean outline boundary (no teeth); faces
 * against other spike blocks merge seamlessly. Tooth shape and colors are
 * transplanted pixel-for-pixel from the stock Kenney spike (tile 0068).
 */
function drawSpikeBlockTex(p: Painter, f: SpikeFaces): void {
  // Kenney spike-family palette, sampled from tile 0068
  const SPK_B = 0xdce1e7; // highlight
  const SPK_C = 0x959ab1; // lit flank
  const SPK_D = 0x747a90; // base metal
  const CORE = 0x566c86;
  const CORE_SHADE = 0x3b4252;
  const DEPTH = 5; // spike zone thickness on exposed faces
  const inset = (s: SpikeFace) => (s === 'x' ? DEPTH : 0);

  // core body: full-bleed on merged/edged faces, inset behind teeth
  const x0 = inset(f.l);
  const x1 = 17 - inset(f.r);
  const y0 = inset(f.t);
  const y1 = 17 - inset(f.b);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const oT = f.t !== 'm' && y === y0;
      const oB = f.b !== 'm' && y === y1;
      const oL = f.l !== 'm' && x === x0;
      const oR = f.r !== 'm' && x === x1;
      if ((oT && oL) || (oT && oR) || (oB && oL) || (oB && oR)) {
        continue; // radius-1 corner between two outlined faces
      }
      const edge = oT || oB || oL || oR;
      p.px(x, y, edge ? DARK : y >= y1 - 2 && f.b !== 'm' ? CORE_SHADE : CORE);
    }
  }

  // Kenney tooth (6w x 3h, pointing up) + rotations
  const TOOTH = ['..AA..', '.ABBA.', 'ACCBBA'];
  const TH = TOOTH.length;
  const TW = TOOTH[0]!.length;
  const COLOR: Record<string, number> = { A: DARK, B: SPK_B, C: SPK_C };
  const stamp = (ox: number, oy: number, rot: 't' | 'b' | 'l' | 'r'): void => {
    for (let y = 0; y < TH; y++) {
      for (let x = 0; x < TW; x++) {
        const ch = TOOTH[y]![x]!;
        if (ch === '.') continue;
        let tx: number;
        let ty: number;
        if (rot === 't') {
          tx = x;
          ty = y;
        } else if (rot === 'b') {
          tx = x;
          ty = TH - 1 - y;
        } else if (rot === 'l') {
          tx = y;
          ty = x;
        } else {
          tx = TH - 1 - y;
          ty = x;
        }
        p.px(ox + tx, oy + ty, COLOR[ch]!);
      }
    }
  };

  // teeth + base bar (D bar with a C rim) only on exposed ('x') faces
  const faces: ('t' | 'b' | 'l' | 'r')[] = [];
  if (f.t === 'x') faces.push('t');
  if (f.b === 'x') faces.push('b');
  if (f.l === 'x') faces.push('l');
  if (f.r === 'x') faces.push('r');
  for (const side of faces) {
    const horizontal = side === 't' || side === 'b';
    const along0 = horizontal ? inset(f.l) : inset(f.t);
    const along1 = 17 - (horizontal ? inset(f.r) : inset(f.b));
    const span = along1 - along0 + 1;
    const n = Math.floor(span / TW);
    const pad = along0 + Math.floor((span - n * TW) / 2);
    for (let i = 0; i < n; i++) {
      const o = pad + i * TW;
      if (side === 't') stamp(o, 0, 't');
      else if (side === 'b') stamp(o, 18 - TH, 'b');
      else if (side === 'l') stamp(0, o, 'l');
      else stamp(18 - TH, o, 'r');
    }
    // base bar: D outer + C rim (C, not the bright B — a softer frame)
    for (let a = along0; a <= along1; a++) {
      if (side === 't') {
        p.px(a, 3, SPK_D);
        p.px(a, 4, SPK_C);
      } else if (side === 'b') {
        p.px(a, 14, SPK_D);
        p.px(a, 13, SPK_C);
      } else if (side === 'l') {
        p.px(3, a, SPK_D);
        p.px(4, a, SPK_C);
      } else {
        p.px(14, a, SPK_D);
        p.px(13, a, SPK_C);
      }
    }
  }
}

export function createTextures(scene: Phaser.Scene): void {
  // apple
  const ap = new Painter(scene);
  drawApple(ap);
  ap.save('apple');

  // door padlocks: gold = needs a key, apple-red = eat every apple
  const goldLock = new Painter(scene);
  drawPadlock(goldLock, 0xf4b41b);
  goldLock.save('padlock-gold');
  const appleLock = new Painter(scene);
  drawPadlock(appleLock, RED, { leaf: true });
  appleLock.save('padlock-apple');

  // lock blocks: full 16-state connection family (like the terrain), so
  // stacked locks read as one continuous locked mass — one keyhole per cell
  const lockPal: BlockPalette = { fill: WOOD, shade: WOOD_DARK, outline: DARK };
  for (const open of allMasks()) {
    const p = new Painter(scene);
    drawBlockBase(p, open, lockPal);
    drawLockDetail(p, open);
    p.save(`lockblock-${maskKey(open)}`);
  }

  // spike blocks: 81-state family — each face merges with a neighbouring
  // spike block, sits edged against another solid, or grows teeth into air
  const FACE_STATES: SpikeFace[] = ['m', 'e', 'x'];
  for (const ft of FACE_STATES) {
    for (const fb of FACE_STATES) {
      for (const fl of FACE_STATES) {
        for (const fr of FACE_STATES) {
          const p = new Painter(scene);
          drawSpikeBlockTex(p, { t: ft, b: fb, l: fl, r: fr });
          p.save(`spikeblock-${ft}${fb}${fl}${fr}`);
        }
      }
    }
  }

  // body segments for every connection shape
  for (const open of BODY_MASKS) {
    const p = new Painter(scene);
    drawSegmentBase(p, open);
    p.save(`body-${maskKey(open)}`);
  }

  // heads: open toward the neck, face pointing the travel direction
  const opposite: Record<Side, Side> = { t: 'b', b: 't', l: 'r', r: 'l' };
  for (const front of ['t', 'b', 'l', 'r'] as Side[]) {
    for (const dead of [false, true]) {
      const p = new Painter(scene);
      drawSegmentBase(p, { [opposite[front]]: true });
      drawFace(p, front, dead);
      p.save(`head-${front}${dead ? '-dead' : ''}`);
    }
  }
  // single-cell snake (no neck): fully closed head facing right
  for (const dead of [false, true]) {
    const p = new Painter(scene);
    drawSegmentBase(p, {});
    drawFace(p, 'r', dead);
    p.save(`head-solo${dead ? '-dead' : ''}`);
  }
}
