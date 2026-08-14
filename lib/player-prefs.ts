export type PlayerPrefs = {
  arrowKeysChangeChannel: boolean;
  autoplayNextEpisode: boolean;
  defaultVolume: number; // 0-100
};

export const DEFAULT_PLAYER_PREFS: PlayerPrefs = {
  arrowKeysChangeChannel: true,
  autoplayNextEpisode: true,
  defaultVolume: 100,
};

const STORAGE_KEY = "patel_tv_player_prefs";

// Single-user app — no server-side prefs model needed, localStorage is enough.
export function loadPlayerPrefs(): PlayerPrefs {
  if (typeof window === "undefined") return DEFAULT_PLAYER_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PLAYER_PREFS;
    return { ...DEFAULT_PLAYER_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PLAYER_PREFS;
  }
}

export function savePlayerPrefs(prefs: PlayerPrefs): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
