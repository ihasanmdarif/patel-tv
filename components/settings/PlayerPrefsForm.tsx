"use client";

import { useEffect, useState } from "react";
import { DEFAULT_PLAYER_PREFS, loadPlayerPrefs, savePlayerPrefs, type PlayerPrefs } from "@/lib/player-prefs";

export default function PlayerPrefsForm() {
  const [prefs, setPrefs] = useState<PlayerPrefs>(DEFAULT_PLAYER_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Reads localStorage, which isn't available during SSR — must happen client-side on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefs(loadPlayerPrefs());
    setLoaded(true);
  }, []);

  function update(next: Partial<PlayerPrefs>) {
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    savePlayerPrefs(merged);
  }

  if (!loaded) return null;

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-surface-border bg-surface p-5" style={{ borderRadius: "var(--radius-lg)" }}>
      <label className="flex items-center justify-between gap-4 text-sm">
        <span>
          Arrow keys change channel
          <span className="block text-xs text-muted">Use ↑/↓ on the Live page to tune channels</span>
        </span>
        <input
          type="checkbox"
          checked={prefs.arrowKeysChangeChannel}
          onChange={(e) => update({ arrowKeysChangeChannel: e.target.checked })}
          className="h-4 w-4 accent-[var(--accent)]"
        />
      </label>
      <label className="flex items-center justify-between gap-4 text-sm">
        <span>
          Autoplay next episode
          <span className="block text-xs text-muted">Automatically continue to the next episode in a series</span>
        </span>
        <input
          type="checkbox"
          checked={prefs.autoplayNextEpisode}
          onChange={(e) => update({ autoplayNextEpisode: e.target.checked })}
          className="h-4 w-4 accent-[var(--accent)]"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span>Default volume ({prefs.defaultVolume}%)</span>
        <input
          type="range"
          min={0}
          max={100}
          value={prefs.defaultVolume}
          onChange={(e) => update({ defaultVolume: Number(e.target.value) })}
        />
      </label>
    </div>
  );
}
