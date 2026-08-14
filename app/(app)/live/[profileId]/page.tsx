import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import WatchClient from "@/components/WatchClient";

export default async function LiveProfilePage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const profile = await prisma.profile.findUnique({ where: { id: profileId } });
  if (!profile) notFound();

  return <WatchClient profileId={profile.id} profileName={profile.name} />;
}
