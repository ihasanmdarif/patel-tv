import "server-only";

// This app can deploy to Vercel (serverless — no persistent disk, no long-lived
// child processes), so it never spawns ffmpeg itself. Instead it calls out to a
// separately-deployed remux-service (see remux-service/) over HTTP — same pattern
// as this repo's existing stalker-proxy.mjs reference shim, just for the remux job
// instead of the portal auth handshake.

function requireConfig(): { baseUrl: string; token: string } {
  const baseUrl = process.env.REMUX_SERVICE_URL;
  const token = process.env.REMUX_SERVICE_TOKEN;
  if (!baseUrl || !token) {
    throw new Error(
      "REMUX_SERVICE_URL and REMUX_SERVICE_TOKEN must be set to play raw MPEG-TS streams"
    );
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), token };
}

export async function createSession(sourceUrl: string): Promise<string> {
  const { baseUrl, token } = requireConfig();
  const res = await fetch(`${baseUrl}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sourceUrl }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Remux service returned ${res.status}`);
  return data.sessionId as string;
}

export async function removeSession(sessionId: string): Promise<void> {
  const { baseUrl, token } = requireConfig();
  await fetch(`${baseUrl}/sessions/${sessionId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

// Proxies a single session file (.m3u8/.ts) from the remote remux service, forwarding
// Range so segment byte-range requests still work end to end.
export async function fetchSessionFile(
  sessionId: string,
  file: string,
  range: string | null
): Promise<Response> {
  const { baseUrl, token } = requireConfig();
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (range) headers.Range = range;
  return fetch(`${baseUrl}/sessions/${sessionId}/${file}`, { headers, cache: "no-store" });
}
