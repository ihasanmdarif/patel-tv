import Link from "next/link";
import { getActiveProfileId } from "@/lib/active-profile";
import VodBrowser from "@/components/vod/VodBrowser";

export const dynamic = "force-dynamic";

export default async function MoviesPage() {
  const profileId = await getActiveProfileId();
  if (!profileId) {
    return (
      <div className="p-8 text-sm text-muted">
        No source connected yet.{" "}
        <Link href="/settings?tab=sources" className="text-accent hover:underline">
          Add one in Settings
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 sm:p-8">
      <h1 className="font-heading text-2xl font-semibold">Movies</h1>
      <VodBrowser profileId={profileId} wantSeries={false} />
    </div>
  );
}
