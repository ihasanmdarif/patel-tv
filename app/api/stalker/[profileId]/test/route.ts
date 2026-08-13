import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadProfileConfig } from "@/lib/stalker/load-profile";
import { testConnection, StalkerError } from "@/lib/stalker/client";
import { clearCachedToken } from "@/lib/stalker/token-cache";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const config = await loadProfileConfig(profileId);
  if (!config) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Always re-verify from a clean session rather than trusting a cached token.
  clearCachedToken(profileId);

  try {
    const result = await testConnection(config);
    await prisma.profile.update({
      where: { id: profileId },
      data: { lastConnectedAt: new Date() },
    });
    return NextResponse.json({ ok: true, genreCount: result.genreCount });
  } catch (err) {
    const status = err instanceof StalkerError ? 502 : 500;
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
