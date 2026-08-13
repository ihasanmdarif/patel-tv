"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import VideoPlayer from "./VideoPlayer";

type Genre = { id: string; title: string };
type Channel = {
  id: string;
  name: string;
  number: string | null;
  cmd: string;
  logo: string | null;
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

  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(false);

  const [player, setPlayer] = useState<{ url: string; kind: "hls" | "ts" } | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

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
    // Re-fires whenever the selected genre changes, so the loading flag must reset synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingChannels(true);
    setChannelsError(null);
    const qs = selectedGenre ? `?genreId=${encodeURIComponent(selectedGenre)}` : "";
    fetch(`/api/stalker/${profileId}/channels${qs}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load channels");
        setChannels(data);
      })
      .catch((err) => setChannelsError(err.message))
      .finally(() => setLoadingChannels(false));
  }, [profileId, selectedGenre]);

  async function playChannel(channel: Channel) {
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
        <Link
          href="/profiles"
          className="flex items-center gap-1 text-sm text-muted transition hover:text-accent"
        >
          <IconArrowLeft className="h-4 w-4" />
          Profiles
        </Link>
        <div className="h-4 w-px bg-surface-border" />
        <h1 className="text-sm font-semibold">{profileName}</h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-56 flex-col overflow-y-auto border-r border-surface-border bg-surface/60 py-2">
          <button
            onClick={() => setSelectedGenre(null)}
            className={`mx-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
              selectedGenre === null
                ? "bg-accent/10 text-accent"
                : "text-foreground hover:bg-surface-border/50"
            }`}
          >
            All genres
          </button>
          {loadingGenres && (
            <p className="flex items-center gap-2 px-5 py-2 text-sm text-muted">
              <Spinner /> Loading genres...
            </p>
          )}
          {genresError && <p className="px-5 py-2 text-sm text-danger">{genresError}</p>}
          {genres.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelectedGenre(g.id)}
              className={`mx-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                selectedGenre === g.id
                  ? "bg-accent/10 font-medium text-accent"
                  : "text-foreground hover:bg-surface-border/50"
              }`}
            >
              {g.title}
            </button>
          ))}
        </aside>

        <main className="flex flex-1 overflow-hidden">
          <div className="w-72 overflow-y-auto border-r border-surface-border py-2">
            {loadingChannels && (
              <p className="flex items-center gap-2 px-4 py-2 text-sm text-muted">
                <Spinner /> Loading channels...
              </p>
            )}
            {channelsError && <p className="px-4 py-2 text-sm text-danger">{channelsError}</p>}
            {channels.map((c) => (
              <button
                key={c.id}
                onClick={() => playChannel(c)}
                className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition ${
                  activeChannelId === c.id
                    ? "bg-accent/10 font-medium text-accent"
                    : "hover:bg-surface-border/50"
                }`}
              >
                {c.number && <span className="w-6 shrink-0 text-xs text-muted">{c.number}</span>}
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-1 items-center justify-center bg-black p-4">
            {resolving ? (
              <p className="flex items-center gap-2 text-sm text-zinc-400">
                <Spinner /> Resolving stream...
              </p>
            ) : player ? (
              <VideoPlayer key={activeChannelId} src={player.url} kind={player.kind} />
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
