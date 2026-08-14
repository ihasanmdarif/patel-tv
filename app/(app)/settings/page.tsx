import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import ProfilesClient from "@/components/ProfilesClient";
import SettingsTabs from "@/components/settings/SettingsTabs";
import PlayerPrefsForm from "@/components/settings/PlayerPrefsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profiles = await prisma.profile.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="font-heading text-2xl font-semibold">Settings</h1>
      <p className="mt-1.5 text-sm text-muted">
        Manage IPTV portal sources and player preferences.
      </p>
      <div className="mt-6">
        <Suspense>
          <SettingsTabs
            sources={
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
            }
            player={<PlayerPrefsForm />}
          />
        </Suspense>
      </div>
    </div>
  );
}
