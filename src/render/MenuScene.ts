import Phaser from 'phaser';
import { drawBackdrop } from './backdrop';
import { INK, TEXT_RES, makeButton, playBgm } from './ui';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  create(): void {
    drawBackdrop(this);
    playBgm(this, 'bgm-menu');
    const cx = this.scale.width / 2;

    this.add
      .text(cx, 90, 'SHEDDING SNAKE', {
        fontFamily: '"Kenney Blocks"',
        fontSize: '44px',
        color: INK,
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RES);
    this.add
      .text(cx, 132, 'a gravity snake puzzle', {
        fontFamily: '"Kenney Pixel"',
        fontSize: '20px',
        color: '#537089',
      })
      .setOrigin(0.5)
      .setResolution(TEXT_RES);

    // mascot: our meme-face snake, big — tail cap, body, head (complete!)
    // integer scale + integer spacing, or nearest-neighbor leaves seam lines
    const seg = 36 * 2;
    this.add.image(cx - seg, 210, 'body-r').setScale(2); // tail: closed left end
    this.add.image(cx, 210, 'body-lr').setScale(2);
    this.add.image(cx + seg, 210, 'head-r').setScale(2);

    makeButton(this, cx, 310, 'PLAY', () => {
      this.scene.start('levelselect');
    }, { fontSize: '26px', minWidth: 220 });

    makeButton(this, cx, 370, 'LEVEL EDITOR', () => {
      this.scene.start('editor');
    }, { fontSize: '22px', minWidth: 220 });
  }
}
