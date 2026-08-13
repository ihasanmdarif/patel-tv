import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadProfileConfig } from "@/lib/stalker/load-profile";
import { getGenres, StalkerError } from "@/lib/stalker/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const config = await loadProfileConfig(profileId);
  if (!config) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  try {
    const genres = await getGenres(config);
    await prisma.profile.update({
      where: { id: profileId },
      data: { lastConnectedAt: new Date() },
    });
    return NextResponse.json(genres);
  } catch (err) {
    const status = err instanceof StalkerError ? 502 : 500;
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status });
  }
}
