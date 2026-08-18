"use client";

import { useEffect, useState } from "react";
import { FocusableButton } from "@/components/spatial/FocusableButton";
import { FocusableSection } from "@/components/spatial/FocusableSection";

type Channel = { id: string; name: string; number: string | null };
type EpgProgram = { id: string; title: string; startTimestamp: number; stopTimestamp: number };

const EPG_CONCURRENCY = 5;

function formatTime(ts: number): string {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function EpgGuide({ profileId }: { profileId: string }) {
  const [page, setPage] = useState(1);
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [pageSize, setPageSize] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [epgByChannel, setEpgByChannel] = useState<Record<string, EpgProgram[]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Re-fires whenever the page changes, so stale channel/EPG state must reset synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChannels(null);
    setEpgByChannel({});
    fetch(`/api/stalker/${profileId}/channels?genreId=*&page=${page}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load channels");
        if (cancelled) return;
        setChannels(data.items);
        setPageSize(data.pageSize);
        setTotalItems(data.totalItems);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load channels");
      });
    return () => {
      cancelled = true;
    };
  }, [profileId, page]);

  useEffect(() => {
    if (!channels) return;
    let cancelled = false;

    async function loadEpg() {
      const queue = [...channels!];
      async function worker() {
        for (;;) {
          const channel = queue.shift();
          if (!channel) return;
          try {
            const res = await fetch(`/api/stalker/${profileId}/epg?channelId=${channel.id}`);
            const data: EpgProgram[] = await res.json();
            if (!cancelled) {
              setEpgByChannel((prev) => ({ ...prev, [channel.id]: Array.isArray(data) ? data : [] }));
            }
          } catch {
            if (!cancelled) setEpgByChannel((prev) => ({ ...prev, [channel.id]: [] }));
          }
        }
      }
      await Promise.all(Array.from({ length: EPG_CONCURRENCY }, worker));
    }

    void loadEpg();
    return () => {
      cancelled = true;
    };
  }, [channels, profileId]);

  if (error) return <p className="p-6 text-sm text-danger">{error}</p>;
  if (!channels) return <p className="p-6 text-sm text-muted">Loading guide...</p>;

  const hasAnyEpg = Object.values(epgByChannel).some((programs) => programs.length > 0);
  const totalPages = pageSize > 0 ? Math.ceil(totalItems / pageSize) : page;
  const canGoPrev = page > 1;
  const canGoNext = channels.length >= pageSize && page < totalPages;

  return (
    <div className="flex flex-col gap-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold">Guide</h1>
        <FocusableSection as="div" className="flex items-center gap-3 text-sm">
          <FocusableButton
            onActivate={() => setPage((p) => p - 1)}
            disabled={!canGoPrev}
            className="rounded-lg border border-surface-border px-3 py-1.5 font-medium transition enabled:hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Prev
          </FocusableButton>
          <span className="text-muted">
            Page {page} of {totalPages}
          </span>
          <FocusableButton
            onActivate={() => setPage((p) => p + 1)}
            disabled={!canGoNext}
            className="rounded-lg border border-surface-border px-3 py-1.5 font-medium transition enabled:hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </FocusableButton>
        </FocusableSection>
      </div>
      {Object.keys(epgByChannel).length >= channels.length && !hasAnyEpg && (
        <p className="text-sm text-muted">
          This portal isn&apos;t returning programme data — showing channels without a schedule.
        </p>
      )}
      <div className="flex flex-col divide-y divide-surface-border rounded-2xl border border-surface-border" style={{ borderRadius: "var(--radius-lg)" }}>
        {channels.map((channel) => {
          const programs = epgByChannel[channel.id];
          return (
            <div key={channel.id} className="flex items-center gap-4 px-4 py-4">
              <div className="flex w-48 shrink-0 items-center gap-3 overflow-hidden">
                {channel.number && (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-bg-tertiary text-sm font-semibold tabular-nums text-muted">
                    {channel.number}
                  </span>
                )}
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded bg-bg-tertiary">
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted">
                    {channel.name.slice(0, 1).toUpperCase()}
                  </div>
                </div>
                <div className="truncate text-base font-medium">{channel.name}</div>
              </div>
              <div className="flex flex-1 gap-3 overflow-x-auto text-sm text-muted">
                {programs === undefined && <span>Loading...</span>}
                {programs?.length === 0 && <span>No programme data</span>}
                {programs?.map((p) => (
                  <span key={p.id} className="shrink-0 rounded-full bg-bg-tertiary px-3 py-1.5">
                    {formatTime(p.startTimestamp)} · {p.title}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
