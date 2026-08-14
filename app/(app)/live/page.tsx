import { redirect } from "next/navigation";
import { getActiveProfileId } from "@/lib/active-profile";

export default async function LiveIndexPage() {
  const profileId = await getActiveProfileId();
  redirect(profileId ? `/live/${profileId}` : "/settings?tab=sources");
}
