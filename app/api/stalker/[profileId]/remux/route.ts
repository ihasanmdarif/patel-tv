import { NextRequest, NextResponse } from "next/server";
import { loadProfileConfig } from "@/lib/stalker/load-profile";
import { resolveStream, StalkerError } from "@/lib/stalker/client";
import { isSafeTarget } from "@/lib/net/safe-target";
import { createSession } from "@/lib/remux/remote-client";

export const dynamic = "force-dynamic";

// Creates an on-disk FFmpeg-backed HLS session for a raw-MPEG-TS channel/VOD item —
// the fix for Safari not supporting mpegts.js/MSE playback of raw TS. Reuses
// resolveStream() (the single-use create_link call) and the same SSRF guard the
// stream proxy already enforces, then hands back a same-origin .m3u8 URL that plays
// through the ordinary hls.js path.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const config = await loadProfileConfig(profileId);
  if (!config) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  let body: { cmd?: string; type?: "itv" | "vod" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.cmd) return NextResponse.json({ error: "cmd is required" }, { status: 400 });

  try {
    const resolved = await resolveStream(config, body.cmd, body.type === "vod" ? "vod" : "itv");
    const sourceUrl = new URL(resolved.url);
    if (!isSafeTarget(sourceUrl)) {
      return NextResponse.json({ error: "Refusing to remux this target" }, { status: 403 });
    }
    const sessionId = await createSession(sourceUrl.toString());
    return NextResponse.json({
      sessionId,
      url: `/api/stalker/${profileId}/remux/${sessionId}/stream.m3u8`,
      kind: "hls",
    });
  } catch (err) {
    const status = err instanceof StalkerError ? 502 : 500;
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status });
  }
}
