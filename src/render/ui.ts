import Phaser from 'phaser';

export const TEXT_RES = 3;
export const INK = '#20344a';

export interface ButtonOpts {
  fontSize?: string;
  minWidth?: number;
  selected?: boolean;
}

/** Kenney-styled text button with hover/selected states. */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: ButtonOpts = {},
): Phaser.GameObjects.Text {
  const btn = scene.add
    .text(x, y, label, {
      fontFamily: '"Kenney Pixel"',
      fontSize: opts.fontSize ?? '22px',
      color: opts.selected ? '#ffe98a' : '#f7f3ea',
      backgroundColor: opts.selected ? '#e07a3f' : '#20344a',
      padding: { x: 14, y: 8 },
      // Always give buttons a fixed width: auto-measured width comes back 0
      // for short strings in the Kenney pixel fonts (canvas metric quirk).
      fixedWidth: opts.minWidth ?? Math.max(44, label.length * 14 + 8),
      align: 'center',
    })
    .setOrigin(0.5)
    .setResolution(TEXT_RES)
    .setDepth(5)
    .setInteractive({ useHandCursor: true });
  btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#39547a' }));
  btn.on('pointerout', () =>
    btn.setStyle({ backgroundColor: opts.selected ? '#e07a3f' : '#20344a' }),
  );
  // Fire on RELEASE, never on press: handlers may open blocking dialogs
  // (window.prompt in SHARE/IMPORT). A dialog opened during pointerdown
  // swallows the pointerup, leaving Phaser's touch pointer stuck "down"
  // forever — every later tap gets ignored. On pointerup the release has
  // already been delivered, so a blocking dialog can't corrupt anything.
  btn.on('pointerdown', (p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
    ev.stopPropagation(); // don't let board-painting handlers see this press
  });
  btn.on('pointerup', (p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
    ev.stopPropagation();
    onClick();
  });
  return btn;
}

const BGM_KEYS = ['bgm-menu', 'bgm-game', 'bgm-editor'];

/**
 * Each scene calls this with its own track; whatever else is playing stops.
 * Browsers block audio before the first user gesture — if locked, the track
 * starts automatically on Phaser's 'unlocked' event.
 */
export function playBgm(scene: Phaser.Scene, key: string): void {
  const sound = scene.sound;
  for (const k of BGM_KEYS) {
    if (k === key) continue;
    const other = sound.get(k);
    if (other && other.isPlaying) other.stop();
  }
  const track = sound.get(key) ?? sound.add(key, { loop: true, volume: 0.15 });
  if (track.isPlaying) return;
  if (sound.locked) {
    sound.once(Phaser.Sound.Events.UNLOCKED, () => {
      if (!track.isPlaying) track.play();
    });
  } else {
    track.play();
  }
}

/** Short-lived toast message at the bottom of the screen. */
export function toast(scene: Phaser.Scene, message: string): void {
  const t = scene.add
    .text(scene.scale.width / 2, scene.scale.height - 60, message, {
      fontFamily: '"Kenney Pixel"',
      fontSize: '18px',
      color: '#ffe98a',
      backgroundColor: '#20344ae6',
      padding: { x: 12, y: 6 },
    })
    .setOrigin(0.5)
    .setResolution(TEXT_RES)
    .setDepth(20);
  scene.tweens.add({
    targets: t,
    alpha: 0,
    delay: 1200,
    duration: 400,
    onComplete: () => t.destroy(),
  });
}
