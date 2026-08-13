import { NextRequest, NextResponse } from "next/server";
import { loadProfileConfig } from "@/lib/stalker/load-profile";
import { resolveStream, StalkerError } from "@/lib/stalker/client";

export const dynamic = "force-dynamic";

const STB_USER_AGENT =
  "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3";

function buildProxyUrl(profileId: string, target: string): string {
  return `/api/stalker/${profileId}/proxy?rawUrl=${encodeURIComponent(target)}`;
}

// HLS playlists reference segment/key/variant URIs as plain lines or #EXT-X-KEY/-MAP URI="..."
// attributes; both need rewriting to route back through this proxy so the browser never talks
// to the portal directly (CORS + auth cookies wouldn't survive a direct request anyway).
function rewritePlaylist(text: string, baseUrl: string, profileId: string): string {
  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/, (_m, uri: string) => {
          const abs = new URL(uri, baseUrl).toString();
          return `URI="${buildProxyUrl(profileId, abs)}"`;
        });
      }
      const abs = new URL(trimmed, baseUrl).toString();
      return buildProxyUrl(profileId, abs);
    })
    .join("\n");
}

const PRIVATE_HOST_PATTERN =
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1|169\.254\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/i;

function isSafeTarget(url: URL): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (PRIVATE_HOST_PATTERN.test(url.hostname)) return false;
  return true;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const channelCmd = req.nextUrl.searchParams.get("channelCmd");
  const rawUrl = req.nextUrl.searchParams.get("rawUrl");
  if (!channelCmd && !rawUrl) {
    return NextResponse.json({ error: "channelCmd or rawUrl is required" }, { status: 400 });
  }

  const config = await loadProfileConfig(profileId);
  if (!config) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  let targetUrl: URL;
  if (channelCmd) {
    try {
      const resolved = await resolveStream(config, channelCmd);
      targetUrl = new URL(resolved.url);
    } catch (err) {
      const status = err instanceof StalkerError ? 502 : 500;
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json({ error: message }, { status });
    }
  } else {
    try {
      targetUrl = new URL(rawUrl!);
    } catch {
      return NextResponse.json({ error: "Invalid rawUrl" }, { status: 400 });
    }
  }

  if (!isSafeTarget(targetUrl)) {
    return NextResponse.json({ error: "Refusing to proxy this target" }, { status: 403 });
  }

  const upstreamHeaders: Record<string, string> = { "User-Agent": STB_USER_AGENT };
  const range = req.headers.get("range");
  if (range) upstreamHeaders.Range = range;

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl.toString(), {
      headers: upstreamHeaders,
      cache: "no-store",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Upstream stream fetch failed: ${message}` }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: `Upstream stream fetch failed (${upstream.status})` },
      { status: 502 }
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  const isPlaylist = targetUrl.pathname.endsWith(".m3u8") || contentType.includes("mpegurl");

  if (isPlaylist) {
    const text = await upstream.text();
    const rewritten = rewritePlaylist(text, targetUrl.toString(), profileId);
    return new Response(rewritten, {
      status: upstream.status,
      headers: { "content-type": "application/vnd.apple.mpegurl" },
    });
  }

  const headers = new Headers();
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has("content-type")) headers.set("content-type", "video/mp2t");

  return new Response(upstream.body, { status: upstream.status, headers });
}
