import Phaser from 'phaser';
import { crazy } from '../crazygames';
import { GameEngine } from '../core/engine';
import { LevelDef } from '../core/level';
import { DirName, GameEvent, GameState } from '../core/types';
import { LEVELS } from '../levels';
import { progress } from '../progress';
import { drawBackdrop } from './backdrop';
import { BoardLayout, BoardRenderer, cellCenter, layoutBoard, sideTo } from './BoardRenderer';
import { Open, Side, maskKey } from './textures';
import { INK, TEXT_RES, playBgm } from './ui';

const MOVE_MS = 80;
const FALL_MS = 170;

export interface GameSceneData {
  levelIndex?: number;
  custom?: LevelDef;
  returnTo?: 'menu' | 'editor' | 'levelselect';
}

/**
 * Thin rendering shell over the pure logic core.
 * It only: forwards input to the engine, and redraws whatever state the
 * engine reports. No game rules live here (see docs/team/06 §8 军规).
 */
export class GameScene extends Phaser.Scene {
  private engine!: GameEngine;
  private levelIndex = 0;
  private custom?: LevelDef;
  private returnTo: 'menu' | 'editor' | 'levelselect' = 'menu';
  private boardRenderer!: BoardRenderer;
  private layout!: BoardLayout;
  private board!: Phaser.GameObjects.Container;
  private snakeLayer!: Phaser.GameObjects.Container;
  private snakeSprites: Phaser.GameObjects.Image[] = [];
  private hudTitle!: Phaser.GameObjects.Text;
  private hudInfo!: Phaser.GameObjects.Text;
  private hudHint!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Text;
  private swipeStart?: { x: number; y: number };

  constructor() {
    super('game');
  }

  init(data: GameSceneData): void {
    this.levelIndex = data.levelIndex ?? 0;
    this.custom = data.custom;
    this.returnTo = data.returnTo ?? 'menu';
  }

  create(): void {
    this.snakeSprites = []; // scene instances are reused — always reset state
    drawBackdrop(this);
    this.boardRenderer = new BoardRenderer(this);

    // creation order = z-order: tiles below, snake above
    this.board = this.add.container(0, 0);
    this.snakeLayer = this.add.container(0, 0);

    const w = this.scale.width;
    this.hudTitle = this.add
      .text(w / 2, 8, '', { fontFamily: '"Kenney Blocks"', fontSize: '20px', color: INK })
      .setOrigin(0.5, 0)
      .setResolution(TEXT_RES);
    this.hudHint = this.add
      .text(w / 2, 34, '', { fontFamily: '"Kenney Pixel"', fontSize: '18px', color: '#537089' })
      .setOrigin(0.5, 0)
      .setResolution(TEXT_RES);
    this.hudInfo = this.add
      .text(w / 2, this.scale.height - 24, '', {
        fontFamily: '"Kenney Mini"',
        fontSize: '13px',
        color: '#f7f3ea', // light — this line sits on the dirt fill
      })
      .setOrigin(0.5, 0)
      .setResolution(TEXT_RES)
      .setDepth(5);
    this.overlay = this.add
      .text(w / 2, this.scale.height / 2, '', {
        fontFamily: '"Kenney Pixel"',
        fontSize: '26px',
        color: '#ffe98a',
        backgroundColor: '#20344ae6',
        padding: { x: 16, y: 10 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setResolution(TEXT_RES)
      .setVisible(false);

    playBgm(this, 'bgm-game');
    this.bindInput();
    this.startLevel();
  }

  private levelDef(): LevelDef {
    return this.custom ?? LEVELS[this.levelIndex]!;
  }

  private startLevel(): void {
    this.engine = new GameEngine(this.levelDef());
    this.engine.onChange((state, events) => this.render(state, events));
    this.render(this.engine.state, []);
    crazy.gameplayStart();
  }

  private gotoLevel(index: number): void {
    if (this.custom) return; // no campaign navigation in custom/editor mode
    this.levelIndex = Phaser.Math.Wrap(index, 0, LEVELS.length);
    this.startLevel();
  }

  private advance(): void {
    if (this.custom) {
      this.exit();
      return;
    }
    if (this.levelIndex + 1 >= LEVELS.length) {
      this.scene.start('levelselect'); // campaign finished — back to the map
      return;
    }
    this.levelIndex++;
    // between levels = the natural break for a midgame ad (cooldown inside);
    // QA rules: mute + halt while the ad plays, resume right after
    crazy.maybeMidgameAd(
      () => {
        this.sound.mute = true;
      },
      () => {
        this.sound.mute = false;
      },
    );
    this.startLevel();
  }

  private exit(): void {
    crazy.gameplayStop();
    this.scene.start(this.returnTo);
  }

  private sfx(key: string, volume = 0.5): void {
    this.sound.play(key, { volume });
  }

  private bindInput(): void {
    const dirKeys: Record<string, DirName> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      KeyW: 'up',
      KeyS: 'down',
      KeyA: 'left',
      KeyD: 'right',
    };

    this.input.keyboard!.on('keydown', (ev: KeyboardEvent) => {
      if (ev.code === 'Escape') {
        this.exit();
        return;
      }
      if (ev.code === 'KeyM') {
        this.sound.mute = !this.sound.mute;
        return;
      }
      if (this.engine.state.status === 'won') {
        this.advance();
        return;
      }
      const dir = dirKeys[ev.code];
      if (dir) this.engine.dispatch({ type: 'move', dir });
      else if (ev.code === 'KeyX') this.engine.dispatch({ type: 'shed' });
      else if (ev.code === 'KeyZ') {
        this.sfx('sfx-undo', 0.3);
        this.engine.dispatch({ type: 'undo' });
        crazy.gameplayStart(); // undoing out of a death overlay resumes play
      } else if (ev.code === 'KeyR') {
        this.engine.dispatch({ type: 'restart' });
        crazy.gameplayStart();
      }
      else if (ev.code === 'KeyN') this.gotoLevel(this.levelIndex + 1);
      else if (ev.code === 'KeyP') this.gotoLevel(this.levelIndex - 1);
    });

    // Basic swipe support for phones; on-screen buttons come later.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.swipeStart = { x: p.x, y: p.y };
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.swipeStart) return;
      const dx = p.x - this.swipeStart.x;
      const dy = p.y - this.swipeStart.y;
      this.swipeStart = undefined;
      if (this.engine.state.status === 'won') {
        this.advance();
        return;
      }
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) {
        this.engine.dispatch({ type: 'shed' }); // tap = shed
        return;
      }
      const dir: DirName =
        Math.abs(dx) > Math.abs(dy)
          ? dx > 0
            ? 'right'
            : 'left'
          : dy > 0
            ? 'down'
            : 'up';
      this.engine.dispatch({ type: 'move', dir });
    });
  }

  private render(state: GameState, events: GameEvent[]): void {
    this.layout = layoutBoard(this, state.width, state.height);
    this.boardRenderer.render(this.board, state, this.layout, {
      decoSeed: this.custom ? 99 : this.levelIndex,
      events,
    });
    this.snakeLayer
      .setPosition(this.layout.ox, this.layout.oy)
      .setScale(this.layout.fit);

    // snake: persistent, connection-aware sprites — tweened, not teleported
    const snake = state.snake;
    const snap = events.length === 0; // level load / undo / restart
    const hasFall = events.some((e) => e.type === 'fell');
    while (this.snakeSprites.length < snake.length) {
      const img = this.add.image(0, 0, 'body-lr');
      this.snakeLayer.add(img);
      this.snakeSprites.push(img);
    }
    while (this.snakeSprites.length > snake.length) {
      this.snakeSprites.pop()!.destroy();
    }
    for (let i = 0; i < snake.length; i++) {
      const seg = snake[i]!;
      const spr = this.snakeSprites[i]!;
      let key: string;
      if (i === 0) {
        const neck = snake[1];
        const front: Side = neck ? sideTo(neck, seg) : 'r';
        const dead = state.status === 'dead' ? '-dead' : '';
        key = neck ? `head-${front}${dead}` : `head-solo${dead}`;
      } else {
        const open: Open = {};
        open[sideTo(seg, snake[i - 1]!)] = true;
        const next = snake[i + 1];
        if (next) open[sideTo(seg, next)] = true;
        key = `body-${maskKey(open)}`;
      }
      spr.setTexture(key);
      const p = cellCenter(seg.x, seg.y);
      this.tweens.killTweensOf(spr);
      if (snap) {
        spr.setPosition(p.x, p.y);
      } else {
        this.tweens.add({
          targets: spr,
          x: p.x,
          y: p.y,
          duration: hasFall ? FALL_MS : MOVE_MS,
          ease: hasFall ? 'Quad.In' : 'Linear',
        });
      }
    }
    const headImg = this.snakeSprites[0]!;

    // feedback: sounds + juice per event
    for (const ev of events) {
      switch (ev.type) {
        case 'moved':
          this.sfx('sfx-move', 0.15);
          break;
        case 'ate':
          this.sfx('sfx-eat', 0.5);
          this.tweens.add({ targets: headImg, scale: 1.35, yoyo: true, duration: 90 });
          if (state.applesLeft === 0 && state.status === 'playing') {
            this.sfx('sfx-open', 0.45); // the door just opened
          }
          break;
        case 'key':
          this.sfx('sfx-eat', 0.45);
          break;
        case 'unlock':
          this.sfx('sfx-open', 0.5);
          break;
        case 'shed':
          this.sfx('sfx-shed', 0.5);
          break;
        case 'blocked':
          this.sfx('sfx-blocked', 0.2);
          break;
        case 'fell':
          if (ev.cells > 1) this.cameras.main.shake(80, 0.004);
          break;
        case 'died':
          this.sfx('sfx-die', 0.5);
          this.cameras.main.shake(150, 0.008);
          crazy.gameplayStop(); // death overlay = gameplay break
          break;
        case 'won':
          this.sfx('sfx-win', 0.55);
          if (!this.custom) progress.markCompleted(this.levelIndex);
          crazy.happytime(); // level clear — a real celebration moment
          crazy.gameplayStop(); // overlay = gameplay break
          break;
      }
    }

    // HUD + overlays
    const level = this.levelDef();
    this.hudTitle.setText(level.name);
    this.hudHint.setText(level.hint ?? '');
    const keys = state.keysHeld > 0 ? `  keys ${state.keysHeld}` : '';
    this.hudInfo.setText(
      `moves ${state.moves}  length ${state.snake.length}  apples ${state.applesLeft}${keys}  ` +
        `[X]shed [Z]undo [R]restart [M]mute [ESC]menu`,
    );

    if (state.status === 'dead') {
      this.overlay
        .setText(
          state.deathCause === 'spike'
            ? 'OUCH! Impaled.\n[Z] undo   [R] restart'
            : 'You fell off the world.\n[Z] undo   [R] restart',
        )
        .setVisible(true);
    } else if (state.status === 'won') {
      this.overlay
        .setText(
          this.custom
            ? 'LEVEL CLEAR!\npress any key to go back'
            : 'LEVEL CLEAR!\npress any key',
        )
        .setVisible(true);
    } else {
      this.overlay.setVisible(false);
    }
  }
}
