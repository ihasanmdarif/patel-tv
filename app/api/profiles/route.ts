import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// Managing sources (portal URL, MAC address, device identity) is admin-only — a
// restricted viewer editing/deleting a Profile would bypass their own access grants.
export async function GET() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const profiles = await prisma.profile.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(profiles);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

  if (!name || !portalUrl || !macAddress) {
    return NextResponse.json(
      { error: "name, portalUrl, and macAddress are required" },
      { status: 400 }
    );
  }

  const profile = await prisma.profile.create({
    data: {
      name,
      portalUrl,
      macAddress,
      serialNumber: serialNumber || null,
      notes: notes || null,
      stbType: stbType || null,
      clientType: clientType || null,
      deviceId: deviceId || null,
      deviceId2: deviceId2 || null,
      signature: signature || null,
      hwVersion: hwVersion || null,
      hwVersion2: hwVersion2 || null,
      prehash: prehash || null,
      imageVersion: imageVersion || null,
      apiSignature: apiSignature || null,
      timezone: timezone || null,
    },
  });
  return NextResponse.json(profile, { status: 201 });
}
