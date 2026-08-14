import "server-only";
import { resolveStream } from "@/lib/stalker/client";
import type { StalkerProfileConfig, ResolvedStream } from "@/lib/stalker/types";
import { isSafeTarget } from "@/lib/net/safe-target";
import { createSession } from "./remote-client";

// Single place stream/route.ts and vod/stream/route.ts call through to resolve a
// channel/VOD cmd into something the browser can actually play. Raw MPEG-TS (kind
// "ts") never reaches the browser — Safari's MediaSource can't play it — it gets
// remuxed to HLS server-side first, so callers only ever see kind:"hls".
export async function resolvePlayableStream(
  profileId: string,
  config: StalkerProfileConfig,
  cmd: string,
  type: "itv" | "vod" = "itv"
): Promise<ResolvedStream> {
  const resolved = await resolveStream(config, cmd, type);
  if (resolved.kind === "hls") {
    return {
      url: `/api/stalker/${profileId}/proxy?type=${type}&channelCmd=${encodeURIComponent(cmd)}`,
      kind: "hls",
    };
  }

  const sourceUrl = new URL(resolved.url);
  if (!isSafeTarget(sourceUrl)) {
    throw new Error("Refusing to remux this target");
  }
  const sessionId = await createSession(sourceUrl.toString());
  return {
    url: `/api/stalker/${profileId}/remux/${sessionId}/stream.m3u8`,
    kind: "hls",
  };
}
