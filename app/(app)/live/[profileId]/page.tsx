import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canAccessProfile } from "@/lib/profile-access";
import WatchClient from "@/components/WatchClient";

export default async function LiveProfilePage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const [profile, user] = await Promise.all([
    prisma.profile.findUnique({ where: { id: profileId } }),
    getCurrentUser(),
  ]);
  if (!profile) notFound();
  // Matches app/(app)/page.tsx and watch/page.tsx: a stale/expired session cookie
  // (cookie present, but no matching session row — e.g. after a DB reset) shows up
  // here as !user. Those pages degrade gracefully rather than hard-failing, so do
  // the same here — only enforce the per-user restriction when there's an actual user.
  if (user && !(await canAccessProfile(user, profileId))) notFound();

  return <WatchClient profileId={profile.id} profileName={profile.name} />;
}
