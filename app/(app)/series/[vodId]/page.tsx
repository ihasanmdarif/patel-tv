import { redirect } from "next/navigation";
import { getActiveProfileId } from "@/lib/active-profile";
import SeriesDetail from "@/components/vod/SeriesDetail";

export default async function SeriesDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ vodId: string }>;
  searchParams: Promise<{ title?: string }>;
}) {
  const [{ vodId }, { title }] = await Promise.all([params, searchParams]);
  const profileId = await getActiveProfileId();
  if (!profileId) redirect("/settings?tab=sources");

  return (
    <div className="p-6 sm:p-8">
      <SeriesDetail profileId={profileId} vodId={vodId} title={title ?? "Series"} />
    </div>
  );
}
