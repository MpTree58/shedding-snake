import Phaser from 'phaser';
import { crazy, initCrazyGames } from './crazygames';
import { progress } from './progress';
import { EditorScene } from './render/EditorScene';
import { GameScene } from './render/GameScene';
import { LevelSelectScene } from './render/LevelSelectScene';
import { MenuScene } from './render/MenuScene';
import { PreloadScene } from './render/PreloadScene';

/** Load the Kenney fonts (CC0) before boot so Phaser text renders them
 *  immediately instead of flashing a fallback font. */
async function loadFonts(): Promise<void> {
  const faces = [
    new FontFace('Kenney Pixel', 'url(assets/fonts/KenneyPixel.ttf)'),
    new FontFace('Kenney Mini', 'url(assets/fonts/KenneyMini.ttf)'),
    new FontFace('Kenney Blocks', 'url(assets/fonts/KenneyBlocks.ttf)'),
  ];
  try {
    const loaded = await Promise.all(faces.map((f) => f.load()));
    // FontFaceSet.add is missing from this TS lib version's DOM types.
    const fontSet = document.fonts as unknown as { add(f: FontFace): void };
    loaded.forEach((f) => fontSet.add(f));
  } catch {
    // Fonts are cosmetic — never block the game on them.
  }
}

Promise.all([loadFonts(), initCrazyGames()]).then(() => {
  // on CrazyGames, campaign progress syncs to the player's account
  const cloudSave = crazy.dataBackend();
  if (cloudSave) progress.setBackend(cloudSave);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 720,
    height: 520,
    backgroundColor: '#dff6f5', // Kenney sky — sampled from bg frame 0, do not guess
    pixelArt: true, // nearest-neighbor scaling — keeps pixel edges crisp
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [PreloadScene, MenuScene, LevelSelectScene, GameScene, EditorScene],
  });
  // dev handle for automated browser tests (harmless in production)
  (window as unknown as { __game: Phaser.Game }).__game = game;
});
