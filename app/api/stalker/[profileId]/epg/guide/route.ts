import { NextRequest, NextResponse } from "next/server";
import { loadProfileConfig } from "@/lib/stalker/load-profile";
import { getFullEpg } from "@/lib/stalker/client";

// getFullEpg already degrades to [] on any portal error — always responds 200 so the
// Guide page can render an explicit "no EPG data" empty state instead of crashing.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const hoursParam = req.nextUrl.searchParams.get("hours");
  const hours = hoursParam ? Number(hoursParam) : 24;

  const config = await loadProfileConfig(profileId);
  if (!config) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const programs = await getFullEpg(config, Number.isFinite(hours) ? hours : 24);
  return NextResponse.json(programs);
}
