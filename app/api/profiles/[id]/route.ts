import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearCachedToken } from "@/lib/stalker/token-cache";
import { clearCachedBase } from "@/lib/stalker/api-base-cache";
import { getCurrentUser } from "@/lib/session";

type RouteParams = { params: Promise<{ id: string }> };

// Managing sources is admin-only — see app/api/profiles/route.ts.
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const profile = await prisma.profile.findUnique({ where: { id } });
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(profile);
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const {
    name,
    portalUrl,
    macAddress,
    serialNumber,
    notes,
    stbType,
    clientType,
    deviceId,
    deviceId2,
    signature,
    hwVersion,
    hwVersion2,
    prehash,
    imageVersion,
    apiSignature,
    timezone,
  } = body as Record<string, string | undefined>;

  const profile = await prisma.profile
    .update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(portalUrl !== undefined ? { portalUrl } : {}),
        ...(macAddress !== undefined ? { macAddress } : {}),
        ...(serialNumber !== undefined ? { serialNumber: serialNumber || null } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(stbType !== undefined ? { stbType: stbType || null } : {}),
        ...(clientType !== undefined ? { clientType: clientType || null } : {}),
        ...(deviceId !== undefined ? { deviceId: deviceId || null } : {}),
        ...(deviceId2 !== undefined ? { deviceId2: deviceId2 || null } : {}),
        ...(signature !== undefined ? { signature: signature || null } : {}),
        ...(hwVersion !== undefined ? { hwVersion: hwVersion || null } : {}),
        ...(hwVersion2 !== undefined ? { hwVersion2: hwVersion2 || null } : {}),
        ...(prehash !== undefined ? { prehash: prehash || null } : {}),
        ...(imageVersion !== undefined ? { imageVersion: imageVersion || null } : {}),
        ...(apiSignature !== undefined ? { apiSignature: apiSignature || null } : {}),
        ...(timezone !== undefined ? { timezone: timezone || null } : {}),
      },
    })
    .catch(() => null);

  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const identityChanged = [
    portalUrl,
    macAddress,
    serialNumber,
    stbType,
    clientType,
    deviceId,
    deviceId2,
    signature,
    hwVersion,
    hwVersion2,
    prehash,
    imageVersion,
    apiSignature,
    timezone,
  ].some((v) => v !== undefined);
  if (identityChanged) {
    clearCachedToken(id);
    clearCachedBase(id);
  }
  return NextResponse.json(profile);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.profile.delete({ where: { id } }).catch(() => null);
  clearCachedToken(id);
  clearCachedBase(id);
  return NextResponse.json({ ok: true });
}
