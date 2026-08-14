import { prisma } from "@/lib/prisma";
import { getActiveProfileId } from "@/lib/active-profile";
import { ProfileProvider } from "@/components/ProfileContext";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [profiles, activeProfileId] = await Promise.all([
    prisma.profile.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true } }),
    getActiveProfileId(),
  ]);

  return (
    <ProfileProvider profiles={profiles} activeProfileId={activeProfileId}>
      <div className="flex min-h-screen flex-1">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </ProfileProvider>
  );
}
