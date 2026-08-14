import { redirect } from "next/navigation";
import { getActiveProfileId } from "@/lib/active-profile";
import { prisma } from "@/lib/prisma";
import WatchPageClient from "@/components/WatchPageClient";

export const dynamic = "force-dynamic";

type ContentType = "MOVIE" | "EPISODE";

export default async function WatchPage({
  searchParams,
}: {
  searchParams: Promise<{
    cmd?: string;
    type?: string;
    contentType?: string;
    contentId?: string;
    title?: string;
    seriesId?: string;
    seriesTitle?: string;
  }>;
}) {
  const sp = await searchParams;
  const profileId = await getActiveProfileId();
  if (!profileId) redirect("/settings?tab=sources");
  if (!sp.cmd) redirect("/");

  const contentType: ContentType | null =
    sp.contentType === "MOVIE" || sp.contentType === "EPISODE" ? sp.contentType : null;

  const history =
    contentType && sp.contentId
      ? await prisma.watchHistory.findUnique({
          where: {
            profileId_contentType_contentId: {
              profileId,
              contentType,
              contentId: sp.contentId,
            },
          },
        })
      : null;

  return (
    <WatchPageClient
      profileId={profileId}
      cmd={sp.cmd}
      type={sp.type === "itv" ? "itv" : "vod"}
      contentType={contentType}
      contentId={sp.contentId ?? null}
      title={sp.title ?? "Untitled"}
      seriesId={sp.seriesId ?? null}
      seriesTitle={sp.seriesTitle ?? null}
      resumeSec={history?.positionSec ?? 0}
      durationSec={history?.durationSec ?? null}
    />
  );
}
