import Phaser from 'phaser';

/**
 * One switchboard for every mute source. Effective mute = platform OR user
 * OR ad. CrazyGames QA: the platform's muteAudio setting must take priority
 * over in-game audio settings — and clearing one source must restore the
 * others (e.g. an ad ending must not unmute a user who pressed M).
 */
let platformMuted = false;
let userMuted = false;
let adMuted = false;
let apply: () => void = () => {};

export const audio = {
  bind(game: Phaser.Game): void {
    apply = () => {
      game.sound.mute = platformMuted || userMuted || adMuted;
    };
    apply();
  },
  setPlatformMuted(m: boolean): void {
    platformMuted = m;
    apply();
  },
  setAdMuted(m: boolean): void {
    adMuted = m;
    apply();
  },
  toggleUser(): void {
    userMuted = !userMuted;
    apply();
  },
};
