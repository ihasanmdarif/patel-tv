"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import VideoPlayer from "./VideoPlayer";
import { buildWatchUrl } from "@/lib/watch-url";
import { loadPlayerPrefs } from "@/lib/player-prefs";

type ContentType = "MOVIE" | "EPISODE" | null;
type SeriesEpisode = { id: string; title: string; cmd: string; seasonId: string };
type SeriesSeason = { id: string; title: string; episodes: SeriesEpisode[] };

const AUTOSAVE_INTERVAL_MS = 10_000;

export default function WatchPageClient({
  profileId,
  cmd,
  type,
  contentType,
  contentId,
  title,
  seriesId,
  seriesTitle,
  logo,
  resumeSec,
  durationSec,
}: {
  profileId: string;
  cmd: string;
  type: "itv" | "vod";
  contentType: ContentType;
  contentId: string | null;
  title: string;
  seriesId: string | null;
  seriesTitle: string | null;
  logo: string | null;
  resumeSec: number;
  durationSec: number | null;
}) {
  const router = useRouter();
  const [player, setPlayer] = useState<{ url: string; kind: "hls" | "ts" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [favorited, setFavorited] = useState(false);
  const [nextEpisode, setNextEpisode] = useState<SeriesEpisode | null>(null);
  const lastSavedAt = useRef(0);

  useEffect(() => {
    const endpoint =
      type === "itv"
        ? `/api/stalker/${profileId}/stream?channelCmd=${encodeURIComponent(cmd)}`
        : `/api/stalker/${profileId}/vod/stream?cmd=${encodeURIComponent(cmd)}`;
    fetch(endpoint)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to resolve stream");
        setPlayer(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to resolve stream"));
  }, [profileId, cmd, type]);

  useEffect(() => {
    if (!contentType || !contentId) return;
    fetch(`/api/favorites?profileId=${profileId}&contentType=MOVIE`)
      .then((res) => res.json())
      .then((data: Array<{ contentId: string }>) => {
        setFavorited(data.some((f) => f.contentId === contentId));
      })
      .catch(() => {});
  }, [profileId, contentType, contentId]);

  // Best-effort "up next" — only meaningful for episodes; degrades silently if the
  // portal doesn't expose season/episode data (getSeriesInfo already returns []).
  useEffect(() => {
    if (!seriesId || contentType !== "EPISODE") return;
    fetch(`/api/stalker/${profileId}/vod/series/${seriesId}`)
      .then((res) => res.json())
      .then((seasons: SeriesSeason[]) => {
        const episodes = seasons.flatMap((s) => s.episodes);
        const currentIndex = episodes.findIndex((e) => e.id === contentId);
        if (currentIndex >= 0 && currentIndex < episodes.length - 1) {
          setNextEpisode(episodes[currentIndex + 1]);
        }
      })
      .catch(() => {});
  }, [profileId, seriesId, contentType, contentId]);

  function saveProgress(positionSec: number, totalDurationSec: number) {
    if (!contentType || !contentId) return;
    void fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId,
        contentType,
        contentId,
        seriesId,
        title,
        seriesTitle,
        logo,
        cmd,
        positionSec: Math.floor(positionSec),
        durationSec: Math.floor(totalDurationSec),
      }),
    });
  }

  function handleProgress(currentTime: number, duration: number) {
    const now = Date.now();
    if (now - lastSavedAt.current < AUTOSAVE_INTERVAL_MS) return;
    lastSavedAt.current = now;
    saveProgress(currentTime, duration);
  }

  function handleEnded() {
    if (nextEpisode && loadPlayerPrefs().autoplayNextEpisode) {
      router.push(
        buildWatchUrl({
          cmd: nextEpisode.cmd,
          type: "vod",
          contentType: "EPISODE",
          contentId: nextEpisode.id,
          title: nextEpisode.title,
          seriesId,
          seriesTitle,
          logo,
        })
      );
    }
  }

  async function toggleFavorite() {
    if (!contentType || !contentId) return;
    const next = !favorited;
    setFavorited(next);
    if (next) {
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, contentType: "MOVIE", contentId, cmd, title, logo }),
      });
    } else {
      await fetch(
        `/api/favorites?profileId=${profileId}&contentType=MOVIE&contentId=${contentId}`,
        { method: "DELETE" }
      );
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 bg-black p-4 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-lg font-semibold text-foreground">{title}</h1>
          {seriesTitle && <p className="text-sm text-muted">{seriesTitle}</p>}
        </div>
        {contentType && contentId && (
          <button
            onClick={toggleFavorite}
            className={`rounded-[10px] px-3 py-1.5 text-sm font-medium transition ${
              favorited ? "bg-accent-dim text-accent" : "border border-surface-border text-muted"
            }`}
          >
            {favorited ? "★ Favorited" : "☆ Favorite"}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {!error && !player && <p className="text-sm text-muted">Resolving stream...</p>}
      {player && (
        <VideoPlayer
          src={player.url}
          kind={player.kind}
          startAt={resumeSec}
          onProgress={handleProgress}
          onEnded={handleEnded}
        />
      )}

      {durationSec != null && durationSec > 0 && resumeSec > 0 && (
        <p className="text-xs text-muted">
          Resuming from {Math.floor(resumeSec / 60)}m {resumeSec % 60}s
        </p>
      )}

      {nextEpisode && (
        <button
          onClick={handleEnded}
          className="self-start rounded-[10px] bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover"
        >
          Next: {nextEpisode.title}
        </button>
      )}
    </div>
  );
}
