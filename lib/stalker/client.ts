import { createHash } from "node:crypto";
import { getCachedToken, setCachedToken, clearCachedToken } from "./token-cache";
import { getCachedBase, setCachedBase } from "./api-base-cache";
import { STB_USER_AGENT } from "./user-agent";
import type {
  StalkerProfileConfig,
  Genre,
  Channel,
  ResolvedStream,
  VodCategory,
  VodItem,
  SeriesSeason,
  SeriesEpisode,
  EpgProgram,
} from "./types";

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
// Shared by itv (getChannels) and vod (getVodItems) — same get_ordered_list pagination shape.
const PAGE_FETCH_CONCURRENCY = 8;
const MAX_PAGES = 1000; // safety net against an unexpected payload shape looping forever

async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<{ data: T[]; totalItems?: number }>
): Promise<T[]> {
  const first = await fetchPage(1);
  const items = [...first.data];
  const pageSize = first.data.length;
  const totalItems = first.totalItems ?? pageSize;

  if (pageSize === 0 || items.length >= totalItems) return items;

  const totalPages = Math.min(Math.ceil(totalItems / pageSize), MAX_PAGES);
  const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);

  const results: T[][] = new Array(remainingPages.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= remainingPages.length) return;
      const { data } = await fetchPage(remainingPages[i]);
      results[i] = data;
      if (data.length === 0) return; // portal ran out of pages early
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(PAGE_FETCH_CONCURRENCY, remainingPages.length) }, worker)
  );

  for (const data of results) {
    if (!data) continue;
    items.push(...data);
  }
  return items;
}

export async function getChannels(
  config: StalkerProfileConfig,
  genreId?: string
): Promise<Channel[]> {
  return callWithRetry(config, async (token) => {
    return fetchAllPages((page) =>
      fetchChannelPage(config, token, page, genreId).then((r) => ({
        data: r.data.map(toChannel),
        totalItems: r.totalItems,
      }))
    );
  });
}

export async function resolveStream(
  config: StalkerProfileConfig,
  cmd: string,
  type: "itv" | "vod" = "itv"
): Promise<ResolvedStream> {
  return callWithRetry(config, async (token) => {
    const js = (await stalkerRequest(
      config,
      { type, action: "create_link", cmd, force_ch_link_check: "0" },
      token
    )) as { cmd?: string };
    if (!js.cmd) throw new StalkerError("Portal did not return a stream link");
    // Stalker wraps the real URL, e.g. "ffmpeg http://host/stream.ts"; strip the launcher prefix.
    const url = js.cmd.replace(/^(ffmpeg|auto)\s+/i, "").trim();
    const kind = url.includes(".m3u8") ? "hls" : "ts";
    return { url, kind };
  });
}

// ---- VOD (movies/series) -------------------------------------------------------
// Stalker exposes VOD through the same module shape as itv (get_categories /
// get_ordered_list / create_link), just with type=vod. Whether a given portal
// separates "series" from flat movie categories, and what params a series'
// season/episode listing needs, varies by deployment — getSeriesInfo degrades to
// an empty array rather than throwing, same as the known-broken radio module.

export async function getVodCategories(config: StalkerProfileConfig): Promise<VodCategory[]> {
  return callWithRetry(config, async (token) => {
    const js = (await stalkerRequest(
      config,
      { type: "vod", action: "get_categories" },
      token
    )) as Array<{ id: string | number; title: string }>;
    return js.map((c) => ({ id: String(c.id), title: c.title }));
  });
}

type RawVodItem = {
  id: string | number;
  name: string;
  cmd: string;
  screenshot_uri?: string;
  category_id?: string | number;
  year?: string | number;
  description?: string;
  series?: unknown[]; // non-empty on portals that flag multi-episode series items this way
};

function toVodItem(v: RawVodItem): VodItem {
  return {
    id: String(v.id),
    name: v.name,
    cmd: v.cmd,
    logo: v.screenshot_uri ?? null,
    categoryId: v.category_id != null ? String(v.category_id) : null,
    isSeries: Array.isArray(v.series) && v.series.length > 0,
    year: v.year != null ? String(v.year) : null,
    description: v.description ?? null,
  };
}

async function fetchVodPage(
  config: StalkerProfileConfig,
  token: string,
  page: number,
  categoryId?: string
): Promise<{ data: RawVodItem[]; totalItems?: number }> {
  const params: Record<string, string> = {
    type: "vod",
    action: "get_ordered_list",
    p: String(page),
  };
  if (categoryId) params.category = categoryId;

  const js = (await stalkerRequest(config, params, token)) as {
    data: RawVodItem[];
    total_items?: number;
  };
  return { data: js.data ?? [], totalItems: js.total_items };
}

export async function getVodItems(
  config: StalkerProfileConfig,
  categoryId?: string
): Promise<VodItem[]> {
  return callWithRetry(config, async (token) => {
    return fetchAllPages((page) =>
      fetchVodPage(config, token, page, categoryId).then((r) => ({
        data: r.data.map(toVodItem),
        totalItems: r.totalItems,
      }))
    );
  });
}

export async function getSeriesInfo(
  config: StalkerProfileConfig,
  vodId: string
): Promise<SeriesSeason[]> {
  try {
    return await callWithRetry(config, async (token) => {
      const js = (await stalkerRequest(
        config,
        { type: "vod", action: "get_ordered_list", movie_id: vodId },
        token
      )) as { data?: Array<Record<string, unknown>> };
      const rows = js.data ?? [];
      const seasons = new Map<string, SeriesSeason>();
      for (const row of rows) {
        const seasonId = String(row.season_id ?? row.season ?? "1");
        const seasonTitle = String(row.season_name ?? `Season ${seasonId}`);
        const episode: SeriesEpisode = {
          id: String(row.id ?? row.episode_id ?? ""),
          title: String(row.name ?? row.episode_name ?? seasonTitle),
          cmd: String(row.cmd ?? ""),
          seasonId,
        };
        if (!episode.cmd) continue;
        const season = seasons.get(seasonId) ?? { id: seasonId, title: seasonTitle, episodes: [] };
        season.episodes.push(episode);
        seasons.set(seasonId, season);
      }
      return Array.from(seasons.values());
    });
  } catch {
    // Season/episode param shape is portal-specific and unverified — degrade to
    // an empty list rather than surfacing a portal error to the Series detail UI.
    return [];
  }
}

// ---- EPG -------------------------------------------------------------------------
// Portal-dependent and unverified (some Stalker deployments return no usable EPG
// data at all) — both helpers swallow errors and return [] so the Guide page can
// treat "no data" as a first-class, non-error state.

type RawEpgProgram = {
  id: string | number;
  ch_id?: string | number;
  name?: string;
  descr?: string;
  description?: string;
  start_timestamp?: number | string;
  stop_timestamp?: number | string;
  time?: string;
  time_to?: string;
};

function toEpgProgram(channelId: string, e: RawEpgProgram): EpgProgram {
  const start = e.start_timestamp != null ? Number(e.start_timestamp) : Date.parse(e.time ?? "") / 1000;
  const stop = e.stop_timestamp != null ? Number(e.stop_timestamp) : Date.parse(e.time_to ?? "") / 1000;
  return {
    id: String(e.id),
    channelId: e.ch_id != null ? String(e.ch_id) : channelId,
    title: e.name ?? "",
    description: e.descr ?? e.description ?? null,
    startTimestamp: Number.isFinite(start) ? start : 0,
    stopTimestamp: Number.isFinite(stop) ? stop : 0,
  };
}

export async function getEpg(
  config: StalkerProfileConfig,
  channelId: string,
  size = 10
): Promise<EpgProgram[]> {
  try {
    return await callWithRetry(config, async (token) => {
      const js = (await stalkerRequest(
        config,
        { type: "itv", action: "get_short_epg", ch_id: channelId, size: String(size) },
        token
      )) as RawEpgProgram[] | { data?: RawEpgProgram[] };
      const rows = Array.isArray(js) ? js : (js.data ?? []);
      return rows.map((e) => toEpgProgram(channelId, e));
    });
  } catch {
    return [];
  }
}

export async function getFullEpg(
  config: StalkerProfileConfig,
  period = 24
): Promise<EpgProgram[]> {
  try {
    return await callWithRetry(config, async (token) => {
      const js = (await stalkerRequest(
        config,
        { type: "itv", action: "get_epg_info", period: String(period) },
        token
      )) as Record<string, RawEpgProgram[]> | { data?: Record<string, RawEpgProgram[]> };
      const byChannel = "data" in js && js.data ? js.data : (js as Record<string, RawEpgProgram[]>);
      const out: EpgProgram[] = [];
      for (const [channelId, rows] of Object.entries(byChannel)) {
        if (!Array.isArray(rows)) continue;
        for (const e of rows) out.push(toEpgProgram(channelId, e));
      }
      return out;
    });
  } catch {
    return [];
  }
}
