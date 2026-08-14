"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buildWatchUrl } from "@/lib/watch-url";

// Portal logo files are frequently missing/broken (dead links from the provider, not a
// fetch bug on our end) — hide the <img> on error so the letter tile underneath shows
// through instead of a broken-image icon.
function hideOnError(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = "none";
}

type SeriesEpisode = { id: string; title: string; cmd: string; seasonId: string };
type SeriesSeason = { id: string; title: string; episodes: SeriesEpisode[] };

export default function SeriesDetail({
  profileId,
  vodId,
  title,
  logo,
}: {
  profileId: string;
  vodId: string;
  title: string;
  logo: string | null;
}) {
  const [seasons, setSeasons] = useState<SeriesSeason[] | null>(null);
  const [openSeasonId, setOpenSeasonId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/stalker/${profileId}/vod/series/${vodId}`)
      .then((res) => res.json())
      .then((data: SeriesSeason[]) => {
        setSeasons(Array.isArray(data) ? data : []);
        if (data?.[0]) setOpenSeasonId(data[0].id);
      })
      .catch(() => setSeasons([]));
  }, [profileId, vodId]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <div
          className="relative h-28 w-20 shrink-0 overflow-hidden bg-bg-tertiary"
          style={{ borderRadius: "var(--radius-md)" }}
        >
          <div className="flex h-full w-full items-center justify-center text-xl text-muted">
            {title.slice(0, 1).toUpperCase()}
          </div>
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element -- portal-hosted logo, arbitrary host
            <img
              src={logo}
              alt=""
              onError={hideOnError}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
        </div>
        <h1 className="font-heading text-2xl font-semibold">{title}</h1>
      </div>

      {seasons === null && <p className="text-sm text-muted">Loading episodes...</p>}
      {seasons !== null && seasons.length === 0 && (
        <p className="text-sm text-muted">
          No episode data available for this title on this portal.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {seasons?.map((season) => (
          <div key={season.id} className="rounded-lg border border-surface-border" style={{ borderRadius: "var(--radius-md)" }}>
            <button
              onClick={() => setOpenSeasonId(openSeasonId === season.id ? null : season.id)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
            >
              {season.title}
              <span className="text-muted">{season.episodes.length} episodes</span>
            </button>
            {openSeasonId === season.id && (
              <div className="flex flex-col border-t border-surface-border">
                {season.episodes.map((ep) => (
                  <Link
                    key={ep.id}
                    href={buildWatchUrl({
                      cmd: ep.cmd,
                      type: "vod",
                      contentType: "EPISODE",
                      contentId: ep.id,
                      title: ep.title,
                      seriesId: vodId,
                      seriesTitle: title,
                      logo,
                    })}
                    className="px-4 py-2.5 text-sm transition hover:bg-bg-hover"
                  >
                    {ep.title}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
