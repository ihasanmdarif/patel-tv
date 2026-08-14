import { NextRequest, NextResponse } from "next/server";
import { loadProfileConfig } from "@/lib/stalker/load-profile";
import { getSeriesInfo } from "@/lib/stalker/client";

// getSeriesInfo already degrades to [] on any portal error (season/episode param
// shape is portal-specific and unverified) — this route always responds 200 so the
// Series detail UI can render an empty state instead of an error banner.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ profileId: string; vodId: string }> }
) {
  const { profileId, vodId } = await params;
  const config = await loadProfileConfig(profileId);
  if (!config) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const seasons = await getSeriesInfo(config, vodId);
  return NextResponse.json(seasons);
}
