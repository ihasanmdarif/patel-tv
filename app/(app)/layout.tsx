import { prisma } from "@/lib/prisma";
import { getActiveProfileId } from "@/lib/active-profile";
import { ProfileProvider } from "@/components/ProfileContext";
import Navbar from "@/components/Navbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [profiles, activeProfileId] = await Promise.all([
    prisma.profile.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true } }),
    getActiveProfileId(),
  ]);

  return (
    <ProfileProvider profiles={profiles} activeProfileId={activeProfileId}>
      <Navbar />
      <main className="flex flex-1 flex-col">{children}</main>
    </ProfileProvider>
  );
}
