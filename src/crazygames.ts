import { SaveBackend } from './progress';

/**
 * CrazyGames SDK v3 wrapper (docs.crazygames.com/sdk/intro, /sdk/game,
 * /sdk/data, /sdk/video-ads).
 *
 * Design rules:
 * - The game must run IDENTICALLY without the SDK (local dev, other hosts):
 *   every call degrades to a no-op when the SDK is absent/disabled.
 * - `environment` is "local" | "crazygames" | "disabled"; on "disabled"
 *   every SDK method throws, so we simply never store the handle.
 * - v3 core is promise-based (must await init); the ad API uses callbacks.
 */

// minimal structural typing for the parts we use
interface CGSdk {
  environment: 'local' | 'crazygames' | 'disabled';
  init(): Promise<void>;
  game: {
    loadingStart(): void;
    loadingStop(): void;
    gameplayStart(): void;
    gameplayStop(): void;
    happytime(): void;
    // optional: absent on older SDK builds
    addSettingsChangeListener?(cb: (s: { muteAudio?: boolean }) => void): void;
  };
  data: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
  };
  ad: {
    requestAd(
      type: 'midgame' | 'rewarded',
      callbacks: {
        adStarted?: () => void;
        adFinished?: () => void;
        adError?: (error: unknown) => void;
      },
    ): void;
  };
}

let sdk: CGSdk | undefined;
let lastMidgameAt = 0;
const MIDGAME_COOLDOWN_MS = 180_000; // be polite: one midgame ad per 3 min max

/** Call once before the game boots (loading screen). Safe to call anywhere. */
export async function initCrazyGames(): Promise<void> {
  const cg = (window as unknown as { CrazyGames?: { SDK: CGSdk } }).CrazyGames;
  if (!cg?.SDK) return; // script blocked or not included — standalone mode
  try {
    await cg.SDK.init();
    if (cg.SDK.environment === 'disabled') return;
    sdk = cg.SDK;
    console.log(`[crazygames] SDK ready, environment: ${sdk.environment}`);
  } catch (e) {
    console.warn('[crazygames] init failed — running standalone', e);
    sdk = undefined;
  }
}

const safe = (fn: () => void): void => {
  try {
    fn();
  } catch {
    /* SDK hiccups must never break the game */
  }
};

export const crazy = {
  available(): boolean {
    return sdk !== undefined;
  },
  loadingStart(): void {
    safe(() => sdk?.game.loadingStart());
  },
  loadingStop(): void {
    safe(() => sdk?.game.loadingStop());
  },
  gameplayStart(): void {
    safe(() => sdk?.game.gameplayStart());
  },
  gameplayStop(): void {
    safe(() => sdk?.game.gameplayStop());
  },
  /** Sparingly, on real achievements (level clear). */
  happytime(): void {
    safe(() => sdk?.game.happytime());
  },

  /** Platform mute from the CrazyGames player UI (settings change listener).
   *  QA: this must take priority over in-game audio settings. No-op when the
   *  SDK is absent or predates addSettingsChangeListener. */
  onMuteChange(cb: (muted: boolean) => void): void {
    safe(() => sdk?.game.addSettingsChangeListener?.((s) => cb(!!s.muteAudio)));
  },

  /** Cloud-save backend for Progress; undefined when SDK is unavailable. */
  dataBackend(): SaveBackend | undefined {
    if (!sdk) return undefined;
    const cg = sdk;
    return {
      get(key: string): string | null {
        try {
          return cg.data.getItem(key);
        } catch {
          return null;
        }
      },
      set(key: string, value: string): void {
        safe(() => cg.data.setItem(key, value));
      },
    };
  },

  /**
   * Midgame ad at a natural break (between levels). Respects a cooldown;
   * `onPause`/`onResume` MUST mute/unmute audio and halt/resume the game
   * (QA requirement). Resolves immediately when no ad plays.
   */
  maybeMidgameAd(onPause: () => void, onResume: () => void): void {
    if (!sdk) return;
    const now = Date.now();
    if (now - lastMidgameAt < MIDGAME_COOLDOWN_MS) return;
    lastMidgameAt = now;
    let paused = false;
    const finish = (): void => {
      if (paused) onResume();
      paused = false;
    };
    try {
      sdk.ad.requestAd('midgame', {
        adStarted: () => {
          paused = true;
          onPause();
        },
        adFinished: finish,
        adError: finish,
      });
    } catch {
      finish();
    }
  },
};
