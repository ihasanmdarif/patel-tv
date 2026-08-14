import { NextRequest, NextResponse } from "next/server";
import { loadProfileConfig } from "@/lib/stalker/load-profile";
import { getEpg } from "@/lib/stalker/client";

// getEpg already degrades to [] on any portal error (EPG support is portal-dependent
// and unverified) — always responds 200 so the Live/Guide UI treats "no data" as a
// first-class state, not an error.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) {
    return NextResponse.json({ error: "channelId is required" }, { status: 400 });
  }

  const config = await loadProfileConfig(profileId);
  if (!config) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const programs = await getEpg(config, channelId);
  return NextResponse.json(programs);
}
