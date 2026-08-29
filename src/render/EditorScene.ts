import Phaser from 'phaser';
import { parseLevel } from '../core/level';
import { drawBackdrop } from './backdrop';
import { BoardLayout, BoardRenderer, layoutBoard } from './BoardRenderer';
import { TILE } from './textures';
import { INK, TEXT_RES, makeButton, playBgm, toast } from './ui';

const W = 16;
const H = 10;
const DRAFT_KEY = 'shedding-snake.editorDraft';

// toolbar geometry: a horizontally scrollable strip of icon buttons,
// sized so it keeps working when the tool count grows to dozens
const BAR_TOP = 28;
const BAR_H = 66;
const BAR_VIS_W = 480;
const ITEM_W = 76;

interface Tool {
  id: string;
  label: string;
  char?: string; // paintable char; special tools (snake/door) have handlers
  icon?: string; // texture key shown on the button
  overlay?: string; // small texture stamped over the icon (door padlocks)
}

// The strip holds GAME OBJECTS only. Editing utilities (eraser) live in
// their own visually distinct button outside the strip.
const TOOLS: Tool[] = [
  { id: 'wall', label: 'WALL', char: '#', icon: 'terrain-tblr' },
  { id: 'spike', label: 'SPIKE', char: '^', icon: 'spike' },
  { id: 'spikeblock', label: 'SPIKEBLK', char: 'S', icon: 'spikeblock-none' },
  { id: 'apple', label: 'APPLE', char: 'o', icon: 'apple' },
  { id: 'key', label: 'KEY', char: 'k', icon: 'key' },
  { id: 'lock', label: 'LOCK', char: 'L', icon: 'lockblock-none' },
  { id: 'door', label: 'DOOR', icon: 'door', overlay: 'padlock-apple' },
  { id: 'keydoor', label: 'KEYDOOR', icon: 'door', overlay: 'padlock-gold' },
  { id: 'opendoor', label: 'OPENDOOR', icon: 'door' },
  { id: 'snake', label: 'SNAKE', icon: 'head-r' },
];

const ERASE_TOOL: Tool = { id: 'erase', label: 'ERASE', char: '.' };
const ALL_TOOLS = [...TOOLS, ERASE_TOOL];

/**
 * Level editor. The draft grid is ALWAYS a valid level: every mutation is
 * parsed first and reverted if the parser rejects it, so the preview (drawn
 * by the same BoardRenderer as the game) can never break, and TEST can
 * always launch.
 */
export class EditorScene extends Phaser.Scene {
  private rows: string[][] = [];
  private tool = TOOLS[0]!;
  private board!: Phaser.GameObjects.Container;
  private gridLines!: Phaser.GameObjects.Graphics;
  private layout!: BoardLayout;
  private boardRenderer!: BoardRenderer;

  private toolbar!: Phaser.GameObjects.Container;
  private toolBgs = new Map<string, Phaser.GameObjects.Rectangle>();
  private barLeft = 0;
  private barScroll = 0;
  private barMaxScroll = 0;
  private barDragging = false;
  private barPointerDown = false;
  private barDragStartX = 0;
  private barDragStartScroll = 0;
  private arrowL!: Phaser.GameObjects.Text;
  private arrowR!: Phaser.GameObjects.Text;

  constructor() {
    super('editor');
  }

  create(): void {
    drawBackdrop(this);
    playBgm(this, 'bgm-editor');
    this.boardRenderer = new BoardRenderer(this);
    this.board = this.add.container(0, 0);
    this.gridLines = this.add.graphics().setDepth(4);

    this.add
      .text(this.scale.width / 2, 4, 'LEVEL EDITOR', {
        fontFamily: '"Kenney Blocks"',
        fontSize: '18px',
        color: INK,
      })
      .setOrigin(0.5, 0)
      .setResolution(TEXT_RES);

    this.buildToolbar();
    this.add
      .text(
        this.scale.width / 2,
        95,
        'SNAKE: click = place head, click beside the tail to grow  ·  ERASE the tail to shrink',
        { fontFamily: '"Kenney Mini"', fontSize: '10px', color: '#537089' },
      )
      .setOrigin(0.5, 0)
      .setResolution(TEXT_RES);

    // actions
    const actions: [string, () => void][] = [
      ['TEST', () => this.test()],
      ['SAVE', () => this.save()],
      ['LOAD', () => this.loadSaved()],
      ['SHARE', () => this.share()],
      ['IMPORT', () => this.importCode()],
      ['MENU', () => this.scene.start('menu')],
    ];
    const ax0 = this.scale.width / 2 - ((actions.length - 1) * 110) / 2;
    actions.forEach(([label, cb], i) => {
      makeButton(this, ax0 + i * 110, this.scale.height - 26, label, cb, {
        fontSize: '17px',
        minWidth: 96,
      });
    });

    this.rows = this.loadDraft() ?? this.template();
    this.layout = layoutBoard(this, W, H, 104, 60);
    this.rebuild();

    this.bindPointer();
    this.input.keyboard!.on('keydown-ESC', () => this.scene.start('menu'));
  }

  // ---------------------------------------------------------------- toolbar

  private buildToolbar(): void {
    this.barLeft = (this.scale.width - BAR_VIS_W) / 2;
    this.barMaxScroll = Math.max(0, TOOLS.length * ITEM_W - BAR_VIS_W);
    this.toolbar = this.add.container(this.barLeft, BAR_TOP + BAR_H / 2).setDepth(5);

    TOOLS.forEach((tool, i) => {
      const item = this.add.container(i * ITEM_W + ITEM_W / 2, 0);
      const bg = this.add
        .rectangle(0, 0, 68, 58, tool.id === this.tool.id ? 0xe07a3f : 0x20344a)
        .setStrokeStyle(2, 0x434a5f);
      item.add(bg);
      this.toolBgs.set(tool.id, bg);
      if (tool.icon) {
        const icon = this.add.image(0, -9, tool.icon);
        // fit inside 26x26 without squashing non-square sprites
        const s = 26 / Math.max(icon.frame.width, icon.frame.height);
        icon.setDisplaySize(icon.frame.width * s, icon.frame.height * s);
        item.add(icon);
        if (tool.overlay) {
          // padlock stamped on the door, like in-game
          const over = this.add.image(0, -6, tool.overlay);
          const so = 16 / Math.max(over.frame.width, over.frame.height);
          over.setDisplaySize(over.frame.width * so, over.frame.height * so);
          item.add(over);
        }
      }
      item.add(
        this.add
          .text(0, 19, tool.label, {
            fontFamily: '"Kenney Mini"',
            fontSize: '9px',
            color: '#f7f3ea',
          })
          .setOrigin(0.5)
          .setResolution(TEXT_RES),
      );
      this.toolbar.add(item);
    });

    // clip the strip to its visible window
    const maskShape = this.make.graphics({}, false);
    maskShape.fillRect(this.barLeft, BAR_TOP, BAR_VIS_W, BAR_H);
    this.toolbar.setMask(maskShape.createGeometryMask());

    // clickable edge arrows (one item per click) — dragging/wheel also work
    const cy = BAR_TOP + BAR_H / 2;
    const arrowStyle = {
      fontFamily: '"Kenney Pixel"',
      fontSize: '24px',
      color: '#f7f3ea',
      backgroundColor: '#20344a',
      padding: { x: 8, y: 10 },
    };
    this.arrowL = this.add
      .text(this.barLeft - 22, cy, '<', arrowStyle)
      .setOrigin(0.5)
      .setResolution(TEXT_RES)
      .setDepth(6)
      .setInteractive({ useHandCursor: true });
    this.arrowL.on('pointerdown', () => {
      this.barScroll -= ITEM_W;
      this.applyBarScroll();
    });
    this.arrowR = this.add
      .text(this.barLeft + BAR_VIS_W + 22, cy, '>', arrowStyle)
      .setOrigin(0.5)
      .setResolution(TEXT_RES)
      .setDepth(6)
      .setInteractive({ useHandCursor: true });
    this.arrowR.on('pointerdown', () => {
      this.barScroll += ITEM_W;
      this.applyBarScroll();
    });

    // eraser: an EDITING tool, not a game object — its own red button,
    // clearly separated from the object strip
    const ex = this.scale.width - 46;
    const eraserBg = this.add
      .rectangle(ex, cy, 68, 58, 0x20344a)
      .setStrokeStyle(2, 0xdd442c)
      .setDepth(5)
      .setInteractive({ useHandCursor: true });
    this.toolBgs.set(ERASE_TOOL.id, eraserBg);
    this.add
      .text(ex, cy - 9, 'X', {
        fontFamily: '"Kenney Pixel"',
        fontSize: '22px',
        color: '#ff6b6b',
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RES)
      .setDepth(6);
    this.add
      .text(ex, cy + 19, ERASE_TOOL.label, {
        fontFamily: '"Kenney Mini"',
        fontSize: '9px',
        color: '#ff9d8a',
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RES)
      .setDepth(6);
    eraserBg.on('pointerdown', () => this.selectTool(ERASE_TOOL));

    this.applyBarScroll();

    // wheel scrolling anywhere over the bar
    this.input.on(
      'wheel',
      (p: Phaser.Input.Pointer, _o: unknown, dx: number, dy: number) => {
        if (!this.inBar(p)) return;
        this.barScroll += (Math.abs(dx) > Math.abs(dy) ? dx : dy) * 0.6;
        this.applyBarScroll();
      },
    );
  }

  private inBar(p: Phaser.Input.Pointer): boolean {
    return p.y >= BAR_TOP && p.y <= BAR_TOP + BAR_H;
  }

  private applyBarScroll(): void {
    this.barScroll = Phaser.Math.Clamp(this.barScroll, 0, this.barMaxScroll);
    this.toolbar.x = this.barLeft - this.barScroll;
    this.arrowL.setAlpha(this.barScroll > 0 ? 1 : 0.25);
    this.arrowR.setAlpha(this.barScroll < this.barMaxScroll ? 1 : 0.25);
  }

  private selectTool(tool: Tool): void {
    this.tool = tool;
    for (const t of ALL_TOOLS) {
      this.toolBgs.get(t.id)!.setFillStyle(t.id === tool.id ? 0xe07a3f : 0x20344a);
    }
  }

  // ---------------------------------------------------------------- input

  private bindPointer(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.inBar(p)) {
        this.barPointerDown = true;
        this.barDragging = false;
        this.barDragStartX = p.x;
        this.barDragStartScroll = this.barScroll;
        return;
      }
      this.paintAt(p, true);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      if (this.barPointerDown) {
        const dx = p.x - this.barDragStartX;
        if (Math.abs(dx) > 8) this.barDragging = true;
        if (this.barDragging) {
          this.barScroll = this.barDragStartScroll - dx;
          this.applyBarScroll();
        }
        return;
      }
      this.paintAt(p, false);
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.barPointerDown) {
        this.barPointerDown = false;
        if (!this.barDragging && this.inBar(p)) {
          const idx = Math.floor((p.x - this.toolbar.x) / ITEM_W);
          const tool = TOOLS[idx];
          if (tool) this.selectTool(tool);
        }
        this.barDragging = false;
      }
    });
  }

  // ---------------------------------------------------------------- model

  private template(): string[][] {
    const rows = Array.from({ length: H }, () => Array.from({ length: W }, () => '.'));
    const bottom = rows[H - 1]!;
    for (let x = 0; x < W; x++) bottom[x] = '#';
    rows[H - 2]![1] = '2';
    rows[H - 2]![2] = '1';
    rows[H - 2]![3] = 'H';
    rows[H - 2]![13] = 'E';
    return rows;
  }

  private toAscii(): string {
    return '\n' + this.rows.map((r) => r.join('')).join('\n') + '\n';
  }

  private loadDraft(): string[][] | undefined {
    const draft = this.registry.get(DRAFT_KEY) as string | undefined;
    if (!draft) return undefined;
    const rows = draft
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((l) => [...l.padEnd(W, '.')]);
    return rows.length === H ? rows : undefined;
  }

  private storeDraft(): void {
    this.registry.set(DRAFT_KEY, this.toAscii());
  }

  private cellAt(p: Phaser.Input.Pointer): { x: number; y: number } | undefined {
    const lx = (p.x - this.layout.ox) / this.layout.fit;
    const ly = (p.y - this.layout.oy) / this.layout.fit;
    const x = Math.floor(lx / TILE);
    const y = Math.floor(ly / TILE);
    if (x < 0 || x >= W || y < 0 || y >= H) return undefined;
    return { x, y };
  }

  /** Apply a mutation; revert it if the result is not a parseable level. */
  private mutate(fn: (rows: string[][]) => void): void {
    const backup = this.rows.map((r) => [...r]);
    fn(this.rows);
    try {
      parseLevel({ name: 'draft', map: this.toAscii() });
      this.storeDraft();
      this.rebuild();
    } catch (e) {
      this.rows = backup;
      toast(this, String((e as Error).message).slice(0, 60));
    }
  }

  private paintAt(p: Phaser.Input.Pointer, isClick: boolean): void {
    const cell = this.cellAt(p);
    if (!cell) return;
    const { x, y } = cell;
    const current = this.rows[y]![x]!;

    if (this.tool.id === 'door' || this.tool.id === 'keydoor' || this.tool.id === 'opendoor') {
      if (!isClick) return;
      const doorCh = this.tool.id === 'door' ? 'E' : this.tool.id === 'keydoor' ? 'D' : 'O';
      this.mutate((rows) => {
        for (const row of rows) {
          for (let i = 0; i < row.length; i++) if (row[i] === doorCh) row[i] = '.';
        }
        rows[y]![x] = doorCh;
      });
      return;
    }
    if (this.tool.id === 'snake') {
      if (!isClick) return;
      const chain = this.snakeChain();
      const tail = chain[chain.length - 1];
      const adjacentToTail =
        tail && Math.abs(tail.x - x) + Math.abs(tail.y - y) === 1;
      if (adjacentToTail && current === '.') {
        // grow the body one segment along the clicked path
        if (chain.length >= 10) {
          toast(this, 'Max length 10 (H + 9 body segments)');
          return;
        }
        this.mutate((rows) => {
          rows[y]![x] = String(chain.length);
        });
      } else if (current === '.') {
        // start a fresh snake: head only, then click next to it to grow
        this.mutate((rows) => {
          for (const row of rows) {
            for (let i = 0; i < row.length; i++) {
              if (row[i] === 'H' || (row[i]! >= '1' && row[i]! <= '9')) row[i] = '.';
            }
          }
          rows[y]![x] = 'H';
        });
        toast(this, 'Head placed — click next to the tail to grow');
      }
      return;
    }

    // Erasing snake segments: only the tail may be removed (shrinks the
    // snake). Anything else would break the chain — explain instead of
    // surfacing a parser error.
    const isSnakeChar = current === 'H' || (current >= '1' && current <= '9');
    if (isSnakeChar) {
      if (this.tool.id !== 'erase') return; // don't paint over the snake
      const chain = this.snakeChain();
      const tail = chain[chain.length - 1]!;
      if (chain.length > 1 && tail.x === x && tail.y === y) {
        this.mutate((rows) => {
          rows[y]![x] = '.';
        });
      } else if (isClick) {
        toast(this, chain.length === 1
          ? 'A level always needs a head — use SNAKE to move it'
          : 'Erase the snake from its TAIL, or re-place it with SNAKE');
      }
      return;
    }

    const ch = this.tool.char!;
    if (current === ch) return;
    this.mutate((rows) => {
      rows[y]![x] = ch;
    });
  }

  /** Snake segments in order (head first), read from the char grid. */
  private snakeChain(): { x: number; y: number }[] {
    let head: { x: number; y: number } | undefined;
    const body: { order: number; x: number; y: number }[] = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const ch = this.rows[y]![x]!;
        if (ch === 'H') head = { x, y };
        else if (ch >= '1' && ch <= '9') body.push({ order: Number(ch), x, y });
      }
    }
    body.sort((a, b) => a.order - b.order);
    return head ? [head, ...body.map((b) => ({ x: b.x, y: b.y }))] : [];
  }

  private rebuild(): void {
    const state = parseLevel({ name: 'draft', map: this.toAscii() });
    this.boardRenderer.render(this.board, state, this.layout, {
      decoSeed: 99,
      staticSnake: true,
    });
    // grid overlay to make cell boundaries visible while editing
    const g = this.gridLines;
    g.clear();
    g.lineStyle(1, 0x20344a, 0.18);
    const { ox, oy, fit } = this.layout;
    for (let x = 0; x <= W; x++) {
      g.lineBetween(ox + x * TILE * fit, oy, ox + x * TILE * fit, oy + H * TILE * fit);
    }
    for (let y = 0; y <= H; y++) {
      g.lineBetween(ox, oy + y * TILE * fit, ox + W * TILE * fit, oy + y * TILE * fit);
    }
  }

  // ---------------------------------------------------------------- actions

  private test(): void {
    this.storeDraft();
    this.scene.start('game', {
      custom: { name: 'Custom · Test', hint: 'Your level — [ESC] back to editor', map: this.toAscii() },
      returnTo: 'editor',
    });
  }

  private save(): void {
    localStorage.setItem(DRAFT_KEY, this.toAscii());
    toast(this, 'Saved to this browser');
  }

  private loadSaved(): void {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (!saved) {
      toast(this, 'Nothing saved yet');
      return;
    }
    this.registry.set(DRAFT_KEY, saved);
    const rows = this.loadDraft();
    if (rows) {
      this.rows = rows;
      this.rebuild();
      toast(this, 'Loaded');
    }
  }

  /** Level exchange v1: compact codes players can paste anywhere (chat,
   *  comments, forums) — zero backend needed. */
  private share(): void {
    const code = 'SNAKE1.' + btoa(this.toAscii());
    navigator.clipboard
      ?.writeText(code)
      .then(() => toast(this, 'Level code copied — share it anywhere!'))
      .catch(() => toast(this, 'Copy blocked — see console'));
    console.log('[editor] share code:', code, '\nASCII:\n' + this.toAscii());
  }

  private importCode(): void {
    const code = window.prompt('Paste a level code (SNAKE1.…):');
    if (!code) return;
    try {
      const ascii = atob(code.trim().replace(/^SNAKE1\./, ''));
      parseLevel({ name: 'import', map: ascii }); // validate before touching draft
      const rows = ascii
        .split('\n')
        .filter((l) => l.trim().length > 0)
        .map((l) => [...l.padEnd(W, '.').slice(0, W)]);
      while (rows.length < H) rows.push(Array.from({ length: W }, () => '.'));
      this.rows = rows.slice(0, H);
      parseLevel({ name: 'import', map: this.toAscii() }); // still valid after fit-to-grid
      this.storeDraft();
      this.rebuild();
      toast(this, 'Level imported');
    } catch {
      toast(this, 'Invalid level code');
    }
  }
}
