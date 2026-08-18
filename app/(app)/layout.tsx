import { prisma } from "@/lib/prisma";
import { getActiveProfileId } from "@/lib/active-profile";
import { getCurrentUser } from "@/lib/session";
import { getAllowedProfileIds } from "@/lib/profile-access";
import { ProfileProvider } from "@/components/ProfileContext";
import { SpatialNavProvider } from "@/components/spatial/SpatialNavProvider";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [allProfiles, activeProfileId, user] = await Promise.all([
    prisma.profile.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true } }),
    getActiveProfileId(),
    getCurrentUser(),
  ]);
  const allowed = user ? await getAllowedProfileIds(user) : null;
  const profiles = allowed === null ? allProfiles : allProfiles.filter((p) => allowed.includes(p.id));

  return (
    <ProfileProvider profiles={profiles} activeProfileId={activeProfileId}>
      <SpatialNavProvider>
        <div className="flex min-h-screen flex-1">
          <Sidebar />
          <main className="flex min-w-0 flex-1 flex-col">{children}</main>
        </div>
      </SpatialNavProvider>
    </ProfileProvider>
  );
}
