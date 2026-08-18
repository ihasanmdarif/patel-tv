"use client";

import { useEffect, useRef, useState } from "react";
import VideoPlayer from "./VideoPlayer";
import { setFocus } from "@noriginmedia/norigin-spatial-navigation";
import { FocusableButton } from "@/components/spatial/FocusableButton";
import { FocusableLink } from "@/components/spatial/FocusableLink";
import { FocusableSection } from "@/components/spatial/FocusableSection";
import { useNativeFieldKeys } from "@/components/spatial/useNativeFieldKeys";

const CHANNEL_LIST_FOCUS_KEY = "LIVE_CHANNEL_LIST";

type Genre = { id: string; title: string };
type Channel = {
  id: string;
  name: string;
  number: string | null;
  cmd: string;
};

function IconArrowLeft(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// Live TV has no resume point, so watch time is tracked as periodic deltas (via
// VideoPlayer's timeupdate-driven onProgress) accumulated into a running total, flushed
// to /api/history roughly this often — matching the VOD autosave cadence.
const CHANNEL_FLUSH_THRESHOLD_SEC = 10;

type ChannelWatchState = { channel: Channel; lastTick: number | null; accumulated: number };

export default function WatchClient({
  profileId,
  profileName,
}: {
  profileId: string;
  profileName: string;
}) {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [genresError, setGenresError] = useState<string | null>(null);
  const [loadingGenres, setLoadingGenres] = useState(true);

  // undefined = nothing picked yet (no fetch); null = "All genres" explicitly picked;
  // string = a specific genre id.
  const [selectedGenre, setSelectedGenre] = useState<string | null | undefined>(undefined);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(false);

  const [player, setPlayer] = useState<{ url: string; kind: "hls" | "ts" } | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [search, setSearch] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const channelWatchRef = useRef<ChannelWatchState | null>(null);
  const nativeFieldProps = useNativeFieldKeys();

  useEffect(() => {
    fetch(`/api/favorites?profileId=${profileId}&contentType=CHANNEL`)
      .then((res) => res.json())
      .then((data: Array<{ contentId: string }>) => setFavoriteIds(new Set(data.map((f) => f.contentId))))
      .catch(() => {});
  }, [profileId]);

  async function toggleFavorite(channel: Channel) {
    const isFav = favoriteIds.has(channel.id);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(channel.id);
      else next.add(channel.id);
      return next;
    });
    if (isFav) {
      await fetch(
        `/api/favorites?profileId=${profileId}&contentType=CHANNEL&contentId=${channel.id}`,
        { method: "DELETE" }
      );
    } else {
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          contentType: "CHANNEL",
          contentId: channel.id,
          cmd: channel.cmd,
          title: channel.name,
        }),
      });
    }
  }

  const visibleChannels = channels.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    fetch(`/api/stalker/${profileId}/genres`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load genres");
        setGenres(data);
      })
      .catch((err) => setGenresError(err.message))
      .finally(() => setLoadingGenres(false));
  }, [profileId]);

  useEffect(() => {
    // Nothing picked yet — don't fetch the full channel list until the user chooses a
    // genre (or explicitly picks "All genres"). selectedGenre never reverts to undefined
    // once set, so channels just stays at its initial [] here.
    if (selectedGenre === undefined) return;
    let cancelled = false;
    // Re-fires whenever the selected genre changes, so the loading flag must reset synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingChannels(true);
    setChannelsError(null);
    // "*" is the portal's own catch-all genre id; omitting the param entirely hits a much
    // slower unfiltered listing path on some Stalker portals.
    const qs = `?genreId=${encodeURIComponent(selectedGenre ?? "*")}`;
    fetch(`/api/stalker/${profileId}/channels${qs}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load channels");
        // A slower, stale request (e.g. from a genre picked before this one) can resolve
        // after a newer one — ignore it so it can't clobber the current selection's results.
        if (!cancelled) setChannels(data);
      })
      .catch((err) => {
        if (!cancelled) setChannelsError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingChannels(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profileId, selectedGenre]);

  function flushChannelWatch(channel: Channel, elapsedSec: number) {
    if (elapsedSec <= 0) return;
    void fetch("/api/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId,
        contentType: "CHANNEL",
        contentId: channel.id,
        title: channel.name,
        cmd: channel.cmd,
        elapsedSec,
      }),
    }).catch(() => {});
  }

  function flushPendingChannelWatch() {
    const state = channelWatchRef.current;
    if (state && state.accumulated > 0) {
      flushChannelWatch(state.channel, Math.floor(state.accumulated));
    }
    channelWatchRef.current = null;
  }

  // Fires on every VideoPlayer timeupdate tick (i.e. only while actually playing) —
  // measures wall-clock time between ticks rather than trusting currentTime/duration,
  // since those are meaningless for a live stream.
  function handleChannelProgress() {
    const state = channelWatchRef.current;
    if (!state) return;
    const now = Date.now();
    if (state.lastTick == null) {
      state.lastTick = now;
      return;
    }
    // Cap a single tick's delta so a backgrounded/suspended tab waking up can't
    // silently inflate watch hours with a multi-minute jump.
    state.accumulated += Math.min((now - state.lastTick) / 1000, 30);
    state.lastTick = now;
    if (state.accumulated >= CHANNEL_FLUSH_THRESHOLD_SEC) {
      const toFlush = Math.floor(state.accumulated);
      state.accumulated -= toFlush;
      flushChannelWatch(state.channel, toFlush);
    }
  }

  useEffect(() => {
    return () => flushPendingChannelWatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flush-on-unmount only, reads live refs
  }, []);

  async function playChannel(channel: Channel) {
    flushPendingChannelWatch();
    channelWatchRef.current = { channel, lastTick: null, accumulated: 0 };
    setActiveChannelId(channel.id);
    setStreamError(null);
    setPlayer(null);
    setResolving(true);
    try {
      const res = await fetch(
        `/api/stalker/${profileId}/stream?channelCmd=${encodeURIComponent(channel.cmd)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to resolve stream");
      setPlayer(data);
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : "Failed to resolve stream");
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-surface-border bg-surface px-4 py-3">
        <FocusableLink
          href="/profiles"
          className="flex shrink-0 items-center gap-1 text-sm text-muted transition hover:text-accent"
        >
          <IconArrowLeft className="h-4 w-4" />
          Profiles
        </FocusableLink>
        <div className="h-4 w-px shrink-0 bg-surface-border" />
        <h1 className="truncate text-sm font-semibold">{profileName}</h1>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <FocusableSection
          as="aside"
          className="flex w-full shrink-0 flex-row gap-1 overflow-x-auto border-b border-surface-border bg-surface/60 p-2 md:w-56 md:flex-col md:gap-0 md:overflow-y-auto md:border-b-0 md:border-r md:py-2"
        >
          {process.env.NODE_ENV !== "development" && (
            <FocusableButton
              onActivate={() => setSelectedGenre(null)}
              className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition md:mx-2 md:whitespace-normal ${
                selectedGenre === null
                  ? "bg-accent/10 text-accent"
                  : "text-foreground hover:bg-surface-border/50"
              }`}
            >
              All genres
            </FocusableButton>
          )}
          {loadingGenres && (
            <p className="flex shrink-0 items-center gap-2 px-5 py-2 text-sm text-muted">
              <Spinner /> Loading genres...
            </p>
          )}
          {genresError && <p className="shrink-0 px-5 py-2 text-sm text-danger">{genresError}</p>}
          {genres.map((g) => (
            <FocusableButton
              key={g.id}
              onActivate={() => setSelectedGenre(g.id)}
              className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition md:mx-2 md:whitespace-normal ${
                selectedGenre === g.id
                  ? "bg-accent/10 font-medium text-accent"
                  : "text-foreground hover:bg-surface-border/50"
              }`}
            >
              {g.title}
            </FocusableButton>
          ))}
        </FocusableSection>

        <main className="flex flex-1 flex-col overflow-hidden md:flex-row">
          <div className="flex max-h-64 w-full shrink-0 flex-col border-b border-surface-border md:h-auto md:max-h-none md:w-72 md:border-b-0 md:border-r">
            <div className="p-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search channels..."
                {...nativeFieldProps}
                className="w-full rounded-[10px] border border-surface-border bg-bg-tertiary px-3 py-1.5 text-sm outline-none transition focus:border-accent"
              />
            </div>
            <FocusableSection as="div" focusKey={CHANNEL_LIST_FOCUS_KEY} className="flex-1 overflow-y-auto pb-2">
              {selectedGenre === undefined && !loadingChannels && (
                <p className="px-4 py-2 text-sm text-muted">Choose a genre to see channels.</p>
              )}
              {loadingChannels && (
                <p className="flex items-center gap-2 px-4 py-2 text-sm text-muted">
                  <Spinner /> Loading channels...
                </p>
              )}
              {channelsError && <p className="px-4 py-2 text-sm text-danger">{channelsError}</p>}
              {visibleChannels.map((c) => {
                const isActive = activeChannelId === c.id;
                const isFav = favoriteIds.has(c.id);
                return (
                  <FocusableSection
                    key={c.id}
                    as="div"
                    className={`group flex w-full items-center gap-2 border-l-[3px] px-3 py-2 text-sm transition ${
                      isActive
                        ? "border-accent bg-accent-dim font-medium text-accent"
                        : "border-transparent hover:bg-bg-hover"
                    }`}
                  >
                    <FocusableButton
                      onActivate={() => playChannel(c)}
                      className="flex flex-1 items-center gap-2 overflow-hidden text-left"
                    >
                      <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded bg-bg-tertiary">
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-muted">
                          {c.name.slice(0, 1).toUpperCase()}
                        </div>
                      </div>
                      {c.number && <span className="shrink-0 text-xs text-muted">{c.number}</span>}
                      <span className="truncate">{c.name}</span>
                    </FocusableButton>
                    <FocusableButton
                      onActivate={() => toggleFavorite(c)}
                      aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
                      scrollIntoViewOnFocus={false}
                      className={`shrink-0 transition ${isFav ? "text-accent" : "text-muted opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"}`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill={isFav ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="h-3.5 w-3.5"
                      >
                        <path d="M12 20.5s-7-4.35-9.5-8.6C.7 8.2 2.4 4.5 6 4.5c2 0 3.5 1.1 6 3.5 2.5-2.4 4-3.5 6-3.5 3.6 0 5.3 3.7 3.5 7.4C19 16.15 12 20.5 12 20.5Z" />
                      </svg>
                    </FocusableButton>
                  </FocusableSection>
                );
              })}
            </FocusableSection>
          </div>

          <div className="flex min-h-[220px] flex-1 items-center justify-center bg-black p-4">
            {resolving ? (
              <p className="flex items-center gap-2 text-sm text-zinc-400">
                <Spinner /> Resolving stream...
              </p>
            ) : player ? (
              <VideoPlayer
                key={activeChannelId}
                src={player.url}
                kind={player.kind}
                onProgress={handleChannelProgress}
                onBack={() => {
                  flushPendingChannelWatch();
                  setActiveChannelId(null);
                  setPlayer(null);
                  setFocus(CHANNEL_LIST_FOCUS_KEY);
                }}
              />
            ) : streamError ? (
              <p className="text-sm text-danger">{streamError}</p>
            ) : (
              <p className="text-sm text-zinc-400">Select a channel to start watching.</p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
