import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getActiveProfileId } from "@/lib/active-profile";
import { loadProfileConfig } from "@/lib/stalker/load-profile";
import { getVodCategories, getVodItems } from "@/lib/stalker/client";
import { buildWatchUrl } from "@/lib/watch-url";
import Rail, { type RailCard } from "@/components/home/Rail";

export const dynamic = "force-dynamic";

// Portal VOD listings have no reliable "recently added" ordering — this is a
// best-effort rail using the first category's items, degrading to nothing (not an
// error) if the portal doesn't support vod or the call fails.
async function getRecentVod(
  config: NonNullable<Awaited<ReturnType<typeof loadProfileConfig>>>,
  wantSeries: boolean
): Promise<RailCard[]> {
  try {
    const categories = await getVodCategories(config);
    const first = categories.find((c) => c.id !== "*") ?? categories[0];
    if (!first) return [];
    const items = await getVodItems(config, first.id);
    return items
      .filter((i) => i.isSeries === wantSeries)
      .slice(0, 12)
      .map((i) => ({
        key: i.id,
        title: i.name,
        subtitle: i.year ?? undefined,
        logo: i.logo,
        href: buildWatchUrl({
          cmd: i.cmd,
          type: "vod",
          contentType: wantSeries ? "EPISODE" : "MOVIE",
          contentId: i.id,
          title: i.name,
          logo: i.logo,
        }),
      }));
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const profileId = await getActiveProfileId();

  if (!profileId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <h1 className="font-heading text-2xl font-semibold">Welcome to patel-tv</h1>
        <p className="max-w-sm text-sm text-muted">
          Add an IPTV portal source to start browsing live channels, movies, and series.
        </p>
        <Link
          href="/settings?tab=sources"
          className="rounded-[10px] bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover"
        >
          Add a source
        </Link>
      </div>
    );
  }

  const [favorites, history, config] = await Promise.all([
    prisma.favorite.findMany({
      where: { profileId },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.watchHistory.findMany({
      where: { profileId },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
    loadProfileConfig(profileId),
  ]);

  const favoriteCards: RailCard[] = favorites.map((f) => ({
    key: f.id,
    title: f.title,
    logo: f.logo,
    href:
      f.contentType === "CHANNEL"
        ? `/live/${profileId}`
        : buildWatchUrl({
            cmd: f.cmd ?? "",
            type: "vod",
            contentType: f.contentType === "MOVIE" ? "MOVIE" : "EPISODE",
            contentId: f.contentId,
            title: f.title,
            logo: f.logo,
          }),
  }));

  const historyCards: RailCard[] = history.map((h) => ({
    key: h.id,
    title: h.title,
    subtitle: h.seriesTitle ?? undefined,
    logo: h.logo,
    progressPct: h.durationSec ? (h.positionSec / h.durationSec) * 100 : undefined,
    href: buildWatchUrl({
      cmd: h.cmd,
      type: "vod",
      contentType: h.contentType === "MOVIE" ? "MOVIE" : "EPISODE",
      contentId: h.contentId,
      title: h.title,
      seriesId: h.seriesId,
      seriesTitle: h.seriesTitle,
      logo: h.logo,
    }),
  }));

  const [recentMovies, recentSeries] = config
    ? await Promise.all([getRecentVod(config, false), getRecentVod(config, true)])
    : [[], []];

  const nothingToShow =
    favoriteCards.length === 0 &&
    historyCards.length === 0 &&
    recentMovies.length === 0 &&
    recentSeries.length === 0;

  return (
    <div className="flex flex-col gap-8 p-6 sm:p-8">
      <Rail title="Continue Watching" cards={historyCards} />
      <Rail title="Favorites" cards={favoriteCards} />
      <Rail title="Recently Added Movies" cards={recentMovies} />
      <Rail title="Recently Added Series" cards={recentSeries} />
      {nothingToShow && (
        <p className="text-sm text-muted">
          Nothing here yet —{" "}
          <Link href={`/live/${profileId}`} className="text-accent hover:underline">
            browse live channels
          </Link>{" "}
          or favorite something to see it here.
        </p>
      )}
    </div>
  );
}
