import "server-only";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canAccessProfile } from "@/lib/profile-access";
import type { StalkerProfileConfig } from "./types";

// Single chokepoint for every /api/stalker/[profileId]/* route (and the home page's VOD
// rails) — enforcing the per-user profile restriction here means none of those callers
// need their own access check; a disallowed profileId just looks like "not found".
export async function loadProfileConfig(
  profileId: string
): Promise<StalkerProfileConfig | null> {
  const profile = await prisma.profile.findUnique({ where: { id: profileId } });
  if (!profile) return null;
  const user = await getCurrentUser();
  if (!user || !(await canAccessProfile(user, profileId))) return null;
  return {
    id: profile.id,
    portalUrl: profile.portalUrl,
    macAddress: profile.macAddress,
    serialNumber: profile.serialNumber,
    stbType: profile.stbType,
    clientType: profile.clientType,
    deviceId: profile.deviceId,
    deviceId2: profile.deviceId2,
    signature: profile.signature,
    hwVersion: profile.hwVersion,
    hwVersion2: profile.hwVersion2,
    prehash: profile.prehash,
    imageVersion: profile.imageVersion,
    apiSignature: profile.apiSignature,
    timezone: profile.timezone,
  };
}
