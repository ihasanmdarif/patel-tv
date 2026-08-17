import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import ProfilesClient from "@/components/ProfilesClient";
import SettingsTabs from "@/components/settings/SettingsTabs";
import PlayerPrefsForm from "@/components/settings/PlayerPrefsForm";
import AdminDashboard from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";

  let sources: React.ReactNode;
  let admin: React.ReactNode;

  if (isAdmin && user) {
    const [profiles, historyRows, restrictions, accessGrants] = await Promise.all([
      prisma.profile.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.watchHistory.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          userId: true,
          title: true,
          seriesTitle: true,
          contentType: true,
          positionSec: true,
          updatedAt: true,
        },
      }),
      prisma.profileRestriction.findMany({ select: { userId: true } }),
      prisma.profileAccess.findMany({ select: { userId: true, profileId: true } }),
    ]);

    sources = (
      <ProfilesClient
        initialProfiles={profiles.map((p) => ({
          id: p.id,
          name: p.name,
          portalUrl: p.portalUrl,
          macAddress: p.macAddress,
          serialNumber: p.serialNumber,
          stbType: p.stbType,
          clientType: p.clientType,
          deviceId: p.deviceId,
          deviceId2: p.deviceId2,
          signature: p.signature,
          hwVersion: p.hwVersion,
          hwVersion2: p.hwVersion2,
          prehash: p.prehash,
          imageVersion: p.imageVersion,
          apiSignature: p.apiSignature,
          timezone: p.timezone,
          notes: p.notes,
        }))}
      />
    );

    // Single source of truth for both the per-user total and the history list below it,
    // so the two can't drift apart.
    const watchSeconds: Record<string, number> = {};
    const historyByUser: Record<string, typeof historyRows> = {};
    for (const row of historyRows) {
      watchSeconds[row.userId] = (watchSeconds[row.userId] ?? 0) + row.positionSec;
      (historyByUser[row.userId] ??= []).push(row);
    }

    // A key present (even []) means restricted; an absent key means unrestricted — see
    // lib/profile-access.ts. Seed restricted users first so one with zero grants (a
    // deliberate "deny everything" state) still gets an [] entry rather than none.
    const allowedProfileIdsByUser: Record<string, string[]> = {};
    for (const r of restrictions) allowedProfileIdsByUser[r.userId] = [];
    for (const grant of accessGrants) {
      (allowedProfileIdsByUser[grant.userId] ??= []).push(grant.profileId);
    }

    admin = (
      <AdminDashboard
        currentUserId={user.id}
        watchSeconds={watchSeconds}
        historyByUser={historyByUser}
        profiles={profiles.map((p) => ({ id: p.id, name: p.name }))}
        allowedProfileIdsByUser={allowedProfileIdsByUser}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="font-heading text-2xl font-semibold">Settings</h1>
      <p className="mt-1.5 text-sm text-muted">
        Manage IPTV portal sources and player preferences.
      </p>
      <div className="mt-6">
        <Suspense>
          <SettingsTabs sources={sources} player={<PlayerPrefsForm />} admin={admin} />
        </Suspense>
      </div>
    </div>
  );
}
