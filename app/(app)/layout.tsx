import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveProfileId } from "@/lib/active-profile";
import { getCurrentUser } from "@/lib/session";
import { getAllowedProfileIds } from "@/lib/profile-access";
import { ProfileProvider } from "@/components/ProfileContext";
import { SpatialNavProvider } from "@/components/spatial/SpatialNavProvider";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // A stale/invalid session cookie leaves `user` null here without clearing the
  // cookie itself — every other protected route bounces to /login in that case,
  // but this shared layout didn't, so pages under it rendered a half-authed shell
  // (profiles unfiltered, downstream calls assuming a logged-in user) that just
  // hung instead of failing cleanly. Gate here too.
  if (!user) redirect("/login");

  const [allProfiles, activeProfileId] = await Promise.all([
    prisma.profile.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true } }),
    getActiveProfileId(),
  ]);
  const allowed = await getAllowedProfileIds(user);
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
