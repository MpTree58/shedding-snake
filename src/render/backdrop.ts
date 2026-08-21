import Phaser from 'phaser';

export const KENNEY_SCALE = 2; // 18px source tiles → 36px cells

/**
 * Kenney-style backdrop shared by every scene: sky, 3-piece clouds,
 * white tree-line horizon with solid fill below (colors sampled from the
 * pack — see STYLE.md §2/§2.5).
 */
export function drawBackdrop(scene: Phaser.Scene): void {
  const w = scene.scale.width;
  const h = scene.scale.height;

  // clouds are left/mid/right pieces — always composed, never solo
  const cloud = (x: number, y: number) => {
    const seg = 18 * KENNEY_SCALE;
    scene.add.image(x, y, 'cloud-a').setOrigin(0, 0).setScale(KENNEY_SCALE).setDepth(-1);
    scene.add.image(x + seg, y, 'cloud-b').setOrigin(0, 0).setScale(KENNEY_SCALE).setDepth(-1);
    scene.add.image(x + seg * 2, y, 'cloud-c').setOrigin(0, 0).setScale(KENNEY_SCALE).setDepth(-1);
  };
  cloud(70, 70);
  cloud(430, 120);
  cloud(240, 40);

  // horizon band: silhouetted tree-line, solid fill below it
  const F = 24 * KENNEY_SCALE; // 48px background frames
  const horizonY = h - 160;
  const band = ['bg-hill', 'bg-trees', 'bg-bumps', 'bg-trees', 'bg-pines'];
  for (let i = 0; i * F < w; i++) {
    const key = band[i % band.length]!;
    scene.add.image(i * F, horizonY, key).setOrigin(0, 0).setScale(KENNEY_SCALE).setDepth(-2);
    for (let y = horizonY + F; y < h; y += F) {
      scene.add.image(i * F, y, 'bg-fill').setOrigin(0, 0).setScale(KENNEY_SCALE).setDepth(-2);
    }
  }
}
