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
  if (!profile || !user || !(await canAccessProfile(user, profileId))) notFound();

  return <WatchClient profileId={profile.id} profileName={profile.name} />;
}
