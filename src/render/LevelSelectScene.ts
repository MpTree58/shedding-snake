import Phaser from 'phaser';
import { LEVELS } from '../levels';
import { progress } from '../progress';
import { drawBackdrop } from './backdrop';
import { INK, TEXT_RES, makeButton } from './ui';

/**
 * Campaign level select: levels unlock strictly in order — beat one to open
 * the next. Locked entries show a padlock and don't react.
 */
export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('levelselect');
  }

  create(): void {
    drawBackdrop(this);
    const cx = this.scale.width / 2;

    this.add
      .text(cx, 60, 'SELECT LEVEL', {
        fontFamily: '"Kenney Blocks"',
        fontSize: '30px',
        color: INK,
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RES);

    const cols = 3;
    const cellW = 150;
    const cellH = 110;
    const gridW = cols * cellW;
    const rows = Math.ceil(LEVELS.length / cols);
    const x0 = cx - gridW / 2 + cellW / 2;
    const y0 = 150;

    for (let i = 0; i < LEVELS.length; i++) {
      const x = x0 + (i % cols) * cellW;
      const y = y0 + Math.floor(i / cols) * cellH;
      const unlocked = progress.isUnlocked(i);
      const beaten = i <= progress.highestCompleted();

      const card = this.add
        .rectangle(x, y, 126, 86, unlocked ? 0x20344a : 0x8b97a8)
        .setStrokeStyle(2, 0x434a5f);
      if (unlocked) {
        card.setInteractive({ useHandCursor: true });
        card.on('pointerover', () => card.setFillStyle(0x39547a));
        card.on('pointerout', () => card.setFillStyle(0x20344a));
        card.on('pointerdown', () =>
          this.scene.start('game', { levelIndex: i, returnTo: 'levelselect' }),
        );
      }

      this.add
        .text(x, y - 16, String(i + 1), {
          fontFamily: '"Kenney Blocks"',
          fontSize: '26px',
          color: unlocked ? '#ffe98a' : '#e3e8ee',
        })
        .setOrigin(0.5)
        .setResolution(TEXT_RES);

      if (unlocked) {
        this.add
          .text(x, y + 18, LEVELS[i]!.name.replace(/^\d+ · /, '') + (beaten ? '  ✓' : ''), {
            fontFamily: '"Kenney Mini"',
            fontSize: '10px',
            color: beaten ? '#51cf66' : '#f7f3ea',
          })
          .setOrigin(0.5)
          .setResolution(TEXT_RES);
      } else {
        this.add.image(x, y + 18, 'padlock-gold');
      }
    }

    makeButton(this, cx, y0 + rows * cellH + 30, 'MENU', () => this.scene.start('menu'), {
      fontSize: '18px',
      minWidth: 140,
    });
    this.input.keyboard!.on('keydown-ESC', () => this.scene.start('menu'));
  }
}
