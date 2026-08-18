"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
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

function IconChevronUp(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M6 15l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronDown(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Classic STB channel/genre lists hint at overflow with fading chevrons at the scroll
// edges rather than a visible scrollbar — this tracks whether a list is scrolled away
// from its top/bottom so those chevrons can be shown only when there's more to see.
function useScrollEdges(ref: RefObject<HTMLElement | null>, deps: unknown[]) {
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function update() {
      if (!el) return;
      setAtTop(el.scrollTop <= 1);
      setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight <= 1);
    }
    update();
    el.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps controls re-measuring when list content changes
  }, deps);

  return { atTop, atBottom };
}

function ScrollEdgeChevrons({ atTop, atBottom }: { atTop: boolean; atBottom: boolean }) {
  return (
    <>
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 flex h-7 items-start justify-center bg-gradient-to-b from-surface to-transparent transition-opacity ${
          atTop ? "opacity-0" : "opacity-100"
        }`}
      >
        <IconChevronUp className="mt-0.5 h-4 w-4 text-muted" />
      </div>
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 flex h-7 items-end justify-center bg-gradient-to-t from-surface to-transparent transition-opacity ${
          atBottom ? "opacity-0" : "opacity-100"
        }`}
      >
        <IconChevronDown className="mb-0.5 h-4 w-4 text-muted" />
      </div>
    </>
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
  const genreListRef = useRef<HTMLDivElement>(null);
  const channelListRef = useRef<HTMLDivElement>(null);

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
  const genreEdges = useScrollEdges(genreListRef, [genres.length]);
  const channelEdges = useScrollEdges(channelListRef, [visibleChannels.length]);

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

      <div className="flex flex-1 flex-col gap-3 overflow-hidden p-3 md:flex-row">
        <div className="relative flex w-full shrink-0 overflow-hidden rounded-2xl border border-surface-border/60 bg-surface/70 md:w-56 md:flex-col">
          <FocusableSection
            as="div"
            containerRef={genreListRef}
            className="flex w-full flex-row gap-1 overflow-x-auto p-2 md:flex-col md:gap-0.5 md:overflow-y-auto md:py-3"
          >
            {process.env.NODE_ENV !== "development" && (
              <FocusableButton
                onActivate={() => setSelectedGenre(null)}
                focusClassName=""
                className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-base font-medium transition focus:bg-foreground focus:text-background md:mx-2 md:whitespace-normal ${
                  selectedGenre === null ? "text-accent" : "text-foreground hover:bg-bg-hover"
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
                focusClassName=""
                className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-base transition focus:bg-foreground focus:text-background md:mx-2 md:whitespace-normal ${
                  selectedGenre === g.id ? "font-medium text-accent" : "text-foreground hover:bg-bg-hover"
                }`}
              >
                {g.title}
              </FocusableButton>
            ))}
          </FocusableSection>
          <ScrollEdgeChevrons atTop={genreEdges.atTop} atBottom={genreEdges.atBottom} />
        </div>

        <main className="flex flex-1 flex-col gap-3 overflow-hidden md:flex-row">
          <div className="flex max-h-80 w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-surface-border/60 bg-surface/70 md:h-auto md:max-h-none md:w-80">
            <div className="p-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search channels..."
                {...nativeFieldProps}
                className="w-full rounded-[10px] border border-surface-border bg-bg-tertiary px-3 py-1.5 text-sm outline-none transition focus:border-accent"
              />
            </div>
            <div className="relative flex-1 overflow-hidden">
              <FocusableSection
                as="div"
                focusKey={CHANNEL_LIST_FOCUS_KEY}
                containerRef={channelListRef}
                className="flex h-full flex-col overflow-y-auto pb-2"
              >
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
                        className={`group mx-2 my-0.5 flex items-center gap-3 rounded-lg px-3 py-3 text-base transition focus-within:bg-foreground focus-within:text-background ${
                          isActive ? "text-accent" : "hover:bg-bg-hover"
                        }`}
                      >
                        <FocusableButton
                          onActivate={() => playChannel(c)}
                          focusClassName=""
                          className="flex flex-1 items-center gap-3 overflow-hidden text-left"
                        >
                          {c.number && (
                            <span
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold tabular-nums ${
                                isActive ? "bg-accent text-accent-foreground" : "bg-bg-tertiary text-muted"
                              }`}
                            >
                              {c.number}
                            </span>
                          )}
                          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded bg-bg-tertiary">
                            <div className="flex h-full w-full items-center justify-center text-xs text-muted">
                              {c.name.slice(0, 1).toUpperCase()}
                            </div>
                          </div>
                          <span className="truncate font-medium">{c.name}</span>
                        </FocusableButton>
                        <FocusableButton
                          onActivate={() => toggleFavorite(c)}
                          aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
                          scrollIntoViewOnFocus={false}
                          focusClassName=""
                          className={`shrink-0 transition ${
                            isFav
                              ? "text-accent group-focus-within:text-accent"
                              : "text-muted opacity-0 group-hover:opacity-100 group-focus-within:text-background group-focus-within:opacity-100"
                          }`}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill={isFav ? "currentColor" : "none"}
                            stroke="currentColor"
                            strokeWidth="1.8"
                            className="h-4 w-4"
                          >
                            <path d="M12 20.5s-7-4.35-9.5-8.6C.7 8.2 2.4 4.5 6 4.5c2 0 3.5 1.1 6 3.5 2.5-2.4 4-3.5 6-3.5 3.6 0 5.3 3.7 3.5 7.4C19 16.15 12 20.5 12 20.5Z" />
                          </svg>
                        </FocusableButton>
                      </FocusableSection>
                    );
                  })}
              </FocusableSection>
              <ScrollEdgeChevrons atTop={channelEdges.atTop} atBottom={channelEdges.atBottom} />
            </div>
          </div>

          <div className="flex min-h-[220px] flex-1 items-center justify-center rounded-2xl bg-black p-4">
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
