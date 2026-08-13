import { createHash } from "node:crypto";
import { getCachedToken, setCachedToken, clearCachedToken } from "./token-cache";
import { getCachedBase, setCachedBase } from "./api-base-cache";
import type { StalkerProfileConfig, Genre, Channel, ResolvedStream } from "./types";

const STB_USER_AGENT =
  "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3";

function sha256Upper(input: string): string {
  return createHash("sha256").update(input).digest("hex").toUpperCase();
}

// device_id/device_id2/signature are NOT derivable from mac/sn on portals that bind a
// session to the exact device identity captured off the real STB — sha256(sn) etc. produces
// a value that simply doesn't match what the portal has on file, and the request is rejected
// with "Device conflict". Use the stored value when the profile has one; fall back to a
// derived (but likely portal-specific-wrong) value only so lenient portals still get *something*.
function deviceId(config: StalkerProfileConfig): string | null {
  if (config.deviceId) return config.deviceId;
  return config.serialNumber ? sha256Upper(config.serialNumber) : null;
}

function deviceId2(config: StalkerProfileConfig): string | null {
  if (config.deviceId2) return config.deviceId2;
  return config.macAddress ? sha256Upper(config.macAddress) : null;
}

function signature(config: StalkerProfileConfig): string | null {
  if (config.signature) return config.signature;
  return config.serialNumber ? sha256Upper(config.serialNumber + config.macAddress) : null;
}

// Only mac/stb_lang/timezone ride in the Cookie header — device identity goes in the
// get_profile query params instead (confirmed against live portal traffic).
function buildCookie(config: StalkerProfileConfig): string {
  const timezone = config.timezone || "UTC";
  return `mac=${encodeURIComponent(config.macAddress)}; stb_lang=en; timezone=${timezone}`;
}

export class StalkerError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "StalkerError";
    this.status = status;
  }
}

// A Stalker/Ministra STB's "Portal URL" (e.g. http://host/stalker_portal/c/) points at
// the JS client; the actual API lives one directory up, at server/load.php. Users often
// paste just the bare domain, so if the path doesn't already look like a portal base,
// follow the server's own redirect (e.g. tv.example.com -> tv.example.com/stalker_portal/c/)
// to discover the real base instead of guessing.
async function resolveApiUrl(config: StalkerProfileConfig): Promise<URL> {
  const cached = getCachedBase(config.id);
  if (cached) return new URL(cached);

  const parsed = new URL(config.portalUrl);
  let pathname = parsed.pathname.replace(/\/+$/, "");

  if (pathname.endsWith("/server/load.php")) {
    setCachedBase(config.id, parsed.toString());
    return parsed;
  }

  if (!pathname.endsWith("/c")) {
    try {
      const probe = await fetch(parsed.toString(), { redirect: "follow", cache: "no-store" });
      const finalPath = new URL(probe.url).pathname.replace(/\/+$/, "");
      if (finalPath.endsWith("/c")) pathname = finalPath;
    } catch {
      // Ignore network errors here; fall through to the bare-domain heuristic below.
    }
  }

  if (pathname.endsWith("/c")) {
    pathname = pathname.slice(0, -"/c".length);
  }

  const apiUrl = new URL(parsed.toString());
  apiUrl.pathname = `${pathname}/server/load.php`;
  apiUrl.search = "";
  setCachedBase(config.id, apiUrl.toString());
  return apiUrl;
}

async function stalkerRequest(
  config: StalkerProfileConfig,
  params: Record<string, string>,
  token: string | null
): Promise<unknown> {
  const url = await resolveApiUrl(config);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("JsHttpRequest", "1-xml");

  const headers: Record<string, string> = {
    "User-Agent": STB_USER_AGENT,
    "X-User-Agent": "Model: MAG250; Link: WiFi",
    Accept: "*/*",
    Cookie: buildCookie(config),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url.toString(), { headers, cache: "no-store" });
  const text = await res.text();
  if (!res.ok) {
    throw new StalkerError(`Portal request failed (${res.status})`, res.status);
  }

  // Some portals answer session/auth failures with a plain-text body ("Authorization failed.")
  // and still return HTTP 200, so a JSON.parse crash here would hide that message.
  let parsed: { js?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new StalkerError(`Portal returned a non-JSON response: ${text.slice(0, 200).trim()}`);
  }

  if (parsed.js === undefined) {
    throw new StalkerError("Portal returned no data (session likely invalid)");
  }

  // Blocked/conflicting devices come back as {"js":{"status":1,"msg":"..."}} with HTTP 200.
  const js = parsed.js as { status?: number; msg?: string };
  if (js && typeof js === "object" && js.msg && js.status) {
    throw new StalkerError(js.msg);
  }

  return parsed.js;
}

async function handshake(config: StalkerProfileConfig): Promise<string> {
  const params: Record<string, string> = { type: "stb", action: "handshake", token: "" };
  if (config.prehash) params.prehash = config.prehash;
  const js = (await stalkerRequest(config, params, null)) as { token?: string };
  if (!js.token) throw new StalkerError("Handshake did not return a token");
  return js.token;
}

async function getValidToken(
  config: StalkerProfileConfig,
  forceRefresh = false
): Promise<string> {
  if (!forceRefresh) {
    const cached = getCachedToken(config.id);
    if (cached) return cached;
  }
  const token = await handshake(config);
  // get_profile finalizes the session and, on portals that bind a session to a physical
  // device, is where "Device conflict - Serial Number mismatch" gets thrown if any of this
  // doesn't match what that device already registered. Send everything a real STB sends.
  const profileParams: Record<string, string> = {
    type: "stb",
    action: "get_profile",
    stb_type: config.stbType || "MAG250",
    client_type: config.clientType || "STB",
    video_out: "hdmi",
    num_banks: "1",
    hd: "1",
    api_signature: config.apiSignature || "203",
    auth_second_step: "0",
    not_valid_token: "0",
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  if (config.serialNumber) profileParams.sn = config.serialNumber;
  const did = deviceId(config);
  if (did) profileParams.device_id = did;
  const did2 = deviceId2(config);
  if (did2) profileParams.device_id2 = did2;
  const sig = signature(config);
  if (sig) profileParams.signature = sig;
  if (config.hwVersion) profileParams.hw_version = config.hwVersion;
  if (config.hwVersion2) profileParams.hw_version_2 = config.hwVersion2;
  if (config.imageVersion) profileParams.image_version = config.imageVersion;
  if (config.prehash) profileParams.prehash = config.prehash;
  await stalkerRequest(config, profileParams, token);
  setCachedToken(config.id, token);
  return token;
}

async function callWithRetry<T>(
  config: StalkerProfileConfig,
  fn: (token: string) => Promise<T>
): Promise<T> {
  try {
    const token = await getValidToken(config);
    return await fn(token);
  } catch (err) {
    if (!(err instanceof StalkerError)) throw err;
    clearCachedToken(config.id);
    const freshToken = await getValidToken(config, true);
    return await fn(freshToken);
  }
}

export async function testConnection(
  config: StalkerProfileConfig
): Promise<{ genreCount: number }> {
  return callWithRetry(config, async (token) => {
    const js = (await stalkerRequest(
      config,
      { type: "itv", action: "get_genres" },
      token
    )) as Array<unknown>;
    return { genreCount: js.length };
  });
}

export async function getGenres(config: StalkerProfileConfig): Promise<Genre[]> {
  return callWithRetry(config, async (token) => {
    const js = (await stalkerRequest(
      config,
      { type: "itv", action: "get_genres" },
      token
    )) as Array<{ id: string | number; title: string }>;
    return js.map((g) => ({ id: String(g.id), title: g.title }));
  });
}

type RawChannel = {
  id: string | number;
  name: string;
  number?: string | number;
  cmd: string;
  logo?: string;
  tv_genre_id?: string | number;
};

function toChannel(c: RawChannel): Channel {
  return {
    id: String(c.id),
    name: c.name,
    number: c.number != null ? String(c.number) : null,
    cmd: c.cmd,
    logo: c.logo ?? null,
    genreId: c.tv_genre_id != null ? String(c.tv_genre_id) : null,
  };
}

async function fetchChannelPage(
  config: StalkerProfileConfig,
  token: string,
  page: number,
  genreId?: string
): Promise<{ data: RawChannel[]; totalItems?: number }> {
  const params: Record<string, string> = {
    type: "itv",
    action: "get_ordered_list",
    p: String(page),
    force_ch_link_check: "0",
  };
  if (genreId) params.genre = genreId;

  const js = (await stalkerRequest(config, params, token)) as {
    data: RawChannel[];
    total_items?: number;
  };
  return { data: js.data ?? [], totalItems: js.total_items };
}

// The unfiltered/"All" listing can span 100+ pages; fetching them one at a time turns into a
// minute-plus wait. Fetch the first page to learn the page size and total count, then fetch the
// rest concurrently (bounded, so we don't hammer the portal) instead of walking pages serially.
const PAGE_FETCH_CONCURRENCY = 8;
const MAX_PAGES = 1000; // safety net against an unexpected payload shape looping forever

export async function getChannels(
  config: StalkerProfileConfig,
  genreId?: string
): Promise<Channel[]> {
  return callWithRetry(config, async (token) => {
    const first = await fetchChannelPage(config, token, 1, genreId);
    const channels = first.data.map(toChannel);
    const pageSize = first.data.length;
    const totalItems = first.totalItems ?? pageSize;

    if (pageSize === 0 || channels.length >= totalItems) return channels;

    const totalPages = Math.min(Math.ceil(totalItems / pageSize), MAX_PAGES);
    const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);

    const results: RawChannel[][] = new Array(remainingPages.length);
    let next = 0;
    async function worker() {
      for (;;) {
        const i = next++;
        if (i >= remainingPages.length) return;
        const { data } = await fetchChannelPage(config, token, remainingPages[i], genreId);
        results[i] = data;
        if (data.length === 0) return; // portal ran out of pages early
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(PAGE_FETCH_CONCURRENCY, remainingPages.length) }, worker)
    );

    for (const data of results) {
      if (!data) continue;
      for (const c of data) channels.push(toChannel(c));
    }
    return channels;
  });
}

export async function resolveStream(
  config: StalkerProfileConfig,
  channelCmd: string
): Promise<ResolvedStream> {
  return callWithRetry(config, async (token) => {
    const js = (await stalkerRequest(
      config,
      { type: "itv", action: "create_link", cmd: channelCmd, force_ch_link_check: "0" },
      token
    )) as { cmd?: string };
    if (!js.cmd) throw new StalkerError("Portal did not return a stream link");
    // Stalker wraps the real URL, e.g. "ffmpeg http://host/stream.ts"; strip the launcher prefix.
    const url = js.cmd.replace(/^ffmpeg\s+/i, "").trim();
    const kind = url.includes(".m3u8") ? "hls" : "ts";
    return { url, kind };
  });
}
