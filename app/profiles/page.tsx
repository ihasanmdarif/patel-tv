import { prisma } from "@/lib/prisma";
import ProfilesClient from "@/components/ProfilesClient";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function ProfilesPage() {
  const profiles = await prisma.profile.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">IPTV Profiles</h1>
          <p className="mt-1.5 text-sm text-muted">
            Store your Stalker portal URL and MAC address to browse and watch channels.
          </p>
        </div>
        <LogoutButton />
      </div>
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
    </div>
  );
}
