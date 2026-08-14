import { redirect } from "next/navigation";
import { getActiveProfileId } from "@/lib/active-profile";
import EpgGuide from "@/components/EpgGuide";

export const dynamic = "force-dynamic";

export default async function GuidePage() {
  const profileId = await getActiveProfileId();
  if (!profileId) redirect("/settings?tab=sources");

  return <EpgGuide profileId={profileId} />;
}
