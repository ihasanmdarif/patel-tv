import { NextRequest, NextResponse } from "next/server";
import { fetchSessionFile } from "@/lib/remux/remote-client";

export const dynamic = "force-dynamic";

// Proxies the .m3u8 playlist and .ts segments an active remux session is writing to
// disk on the separately-deployed remux-service — this app (deployable to Vercel)
// never touches that disk directly, it just streams the bytes through so the
// browser only ever talks to this app's own origin.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; file: string[] }> }
) {
  const { sessionId, file } = await params;
  const fileName = file.join("/");

  let upstream: Response;
  try {
    upstream = await fetchSessionFile(sessionId, fileName, req.headers.get("range"));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Remux service unreachable: ${message}` }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const status = upstream.status === 404 ? 404 : 502;
    return NextResponse.json({ error: `Remux service returned ${upstream.status}` }, { status });
  }

  const headers = new Headers();
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "cache-control"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }

  return new Response(upstream.body, { status: upstream.status, headers });
}
