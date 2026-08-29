import Phaser from 'phaser';
import { crazy } from '../crazygames';
import { createTextures } from './textures';

/** Loads every asset once, generates the snake/apple textures, then hands
 *  off to the menu. All other scenes assume assets exist. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('preload');
  }

  preload(): void {
    crazy.loadingStart();
    const images = [
      'terrain-tblr', 'terrain-tbl', 'terrain-tb', 'terrain-tbr',
      'terrain-tlr', 'terrain-tl', 'terrain-t', 'terrain-tr',
      'terrain-lr', 'terrain-l', 'terrain-none', 'terrain-r',
      'terrain-blr', 'terrain-bl', 'terrain-b', 'terrain-br',
      'spike', 'crate', 'door', 'door-lintel', 'key', 'lock',
      'cloud-a', 'cloud-b', 'cloud-c',
      'bg-hill', 'bg-trees', 'bg-bumps', 'bg-pines', 'bg-fill',
      'deco-sprout', 'deco-grass', 'deco-tree', 'deco-mushroom',
    ];
    for (const key of images) this.load.image(key, `assets/tiles/${key}.png`);

    const sfx: Record<string, string> = {
      'sfx-eat': 'pluck_001',
      'sfx-move': 'tick_001',
      'sfx-shed': 'drop_002',
      'sfx-die': 'error_004',
      'sfx-win': 'confirmation_001',
      'sfx-blocked': 'bong_001',
      'sfx-undo': 'back_001',
      'sfx-open': 'open_001',
      'sfx-land': 'land_001',
    };
    for (const [key, file] of Object.entries(sfx)) {
      this.load.audio(key, `assets/audio/${file}.mp3`);
    }
    // one track per context: menu / gameplay / editor
    this.load.audio('bgm-menu', 'assets/audio/bgm-menu.mp3');
    this.load.audio('bgm-game', 'assets/audio/bgm-game.mp3');
    this.load.audio('bgm-editor', 'assets/audio/bgm-editor.mp3');
  }

  create(): void {
    createTextures(this);
    crazy.loadingStop();
    this.scene.start('menu');
  }
}
