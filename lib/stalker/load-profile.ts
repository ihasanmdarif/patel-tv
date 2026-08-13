import { prisma } from "@/lib/prisma";
import type { StalkerProfileConfig } from "./types";

export async function loadProfileConfig(
  profileId: string
): Promise<StalkerProfileConfig | null> {
  const profile = await prisma.profile.findUnique({ where: { id: profileId } });
  if (!profile) return null;
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
