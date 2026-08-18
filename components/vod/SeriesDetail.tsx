"use client";

import { useEffect, useState } from "react";
import { buildWatchUrl } from "@/lib/watch-url";
import { FocusableButton } from "@/components/spatial/FocusableButton";
import { FocusableLink } from "@/components/spatial/FocusableLink";
import { FocusableSection } from "@/components/spatial/FocusableSection";

type SeriesEpisode = { id: string; title: string; cmd: string; seasonId: string };
type SeriesSeason = { id: string; title: string; episodes: SeriesEpisode[] };

export default function SeriesDetail({
  profileId,
  vodId,
  title,
}: {
  profileId: string;
  vodId: string;
  title: string;
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
          className="relative h-32 w-24 shrink-0 overflow-hidden bg-bg-tertiary"
          style={{ borderRadius: "var(--radius-md)" }}
        >
          <div className="flex h-full w-full items-center justify-center text-2xl text-muted">
            {title.slice(0, 1).toUpperCase()}
          </div>
        </div>
        <h1 className="font-heading text-2xl font-semibold">{title}</h1>
      </div>

      {seasons === null && <p className="text-sm text-muted">Loading episodes...</p>}
      {seasons !== null && seasons.length === 0 && (
        <p className="text-sm text-muted">
          No episode data available for this title on this portal.
        </p>
      )}

      <FocusableSection as="div" className="flex flex-col gap-2">
        {seasons?.map((season) => (
          <div key={season.id} className="rounded-lg border border-surface-border" style={{ borderRadius: "var(--radius-md)" }}>
            <FocusableButton
              onActivate={() => setOpenSeasonId(openSeasonId === season.id ? null : season.id)}
              className="flex w-full items-center justify-between px-4 py-4 text-left text-base font-medium"
            >
              {season.title}
              <span className="text-sm text-muted">{season.episodes.length} episodes</span>
            </FocusableButton>
            {openSeasonId === season.id && (
              <FocusableSection as="div" className="flex flex-col border-t border-surface-border">
                {season.episodes.map((ep) => (
                  <FocusableLink
                    key={ep.id}
                    href={buildWatchUrl({
                      cmd: ep.cmd,
                      type: "vod",
                      contentType: "EPISODE",
                      contentId: ep.id,
                      title: ep.title,
                      seriesId: vodId,
                      seriesTitle: title,
                    })}
                    className="px-4 py-3.5 text-base transition hover:bg-bg-hover"
                  >
                    {ep.title}
                  </FocusableLink>
                ))}
              </FocusableSection>
            )}
          </div>
        ))}
      </FocusableSection>
    </div>
  );
}
