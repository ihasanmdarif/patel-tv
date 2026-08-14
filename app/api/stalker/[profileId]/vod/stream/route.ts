import { NextRequest, NextResponse } from "next/server";
import { loadProfileConfig } from "@/lib/stalker/load-profile";
import { StalkerError } from "@/lib/stalker/client";
import { resolvePlayableStream } from "@/lib/remux/resolve";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const cmd = req.nextUrl.searchParams.get("cmd");
  if (!cmd) {
    return NextResponse.json({ error: "cmd is required" }, { status: 400 });
  }

  const config = await loadProfileConfig(profileId);
  if (!config) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  try {
    const resolved = await resolvePlayableStream(profileId, config, cmd, "vod");
    return NextResponse.json(resolved);
  } catch (err) {
    const status = err instanceof StalkerError ? 502 : 500;
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status });
  }
}
