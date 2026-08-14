#!/usr/bin/env node
// remux-service/server.mjs
//
// Standalone FFmpeg remux-to-HLS service. Split out from the main Next.js app so
// that app can deploy to Vercel (serverless — no persistent disk, no long-lived
// child processes) while this piece runs on a normal always-on box, which is what
// spawning ffmpeg and serving HLS segments off local disk actually needs.
//
// The main app calls in over HTTP after it has already resolved the real portal
// stream URL and SSRF-checked it (see lib/net/safe-target.ts there) — this service
// never talks to the Stalker/Ministra portal itself, it only remuxes whatever URL
// it's given, so every caller must present REMUX_SERVICE_TOKEN as a bearer token.
//
// Run:  REMUX_SERVICE_TOKEN=... node server.mjs
// Env:  PORT (default 8790), REMUX_CACHE_DIR (default ./data/remux)

import http from "node:http";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm, readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import ffmpegPathRaw from "ffmpeg-static";
import ffprobeStatic from "@ffprobe-installer/ffprobe";

const TOKEN = process.env.REMUX_SERVICE_TOKEN;
if (!TOKEN) throw new Error("REMUX_SERVICE_TOKEN is required");

const PORT = parseInt(process.env.PORT || "8790", 10);
const CACHE_ROOT = process.env.REMUX_CACHE_DIR || path.join(process.cwd(), "data", "remux");
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;
const PLAYLIST_POLL_INTERVAL_MS = 200;
const PLAYLIST_POLL_TIMEOUT_MS = 15000;
const DEFAULT_UA =
  "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3";

if (!ffmpegPathRaw) throw new Error("ffmpeg-static did not resolve a binary for this platform");
const ffmpegPath = ffmpegPathRaw;
const ffprobePath = ffprobeStatic.path;

function log(...a) {
  console.log(new Date().toISOString().slice(11, 19), ...a);
}

// ---- SSRF guard --------------------------------------------------------------
// Same rule as the main app's lib/net/safe-target.ts, duplicated here since this
// is a separately-deployed service and can't import from that source tree.
const PRIVATE_HOST_PATTERN =
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1|169\.254\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/i;

function isSafeTarget(url) {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (PRIVATE_HOST_PATTERN.test(url.hostname)) return false;
  return true;
}

// ---- ffmpeg / ffprobe --------------------------------------------------------
const H264_CODECS = new Set(["h264", "avc", "avc1"]);
const COMPATIBLE_AUDIO_CODECS = new Set(["aac", "mp3", "opus", "vorbis"]);

function run(bin, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args);
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${bin} timed out`));
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`${bin} exited ${code}: ${stderr.slice(0, 300)}`));
      resolve(stdout);
    });
  });
}

// Probe fails closed: any error/timeout is treated as "needs a real transcode"
// rather than risking a -c copy remux of something that turns out incompatible.
async function probeStream(sourceUrl) {
  try {
    const stdout = await run(
      ffprobePath,
      ["-v", "quiet", "-print_format", "json", "-show_streams", "-user_agent", DEFAULT_UA, sourceUrl],
      8000
    );
    const data = JSON.parse(stdout);
    const streams = data.streams ?? [];
    const video = streams.find((s) => s.codec_type === "video");
    const audio = streams.find((s) => s.codec_type === "audio");
    const videoCodec = video?.codec_name?.toLowerCase() ?? null;
    const audioCodec = audio?.codec_name?.toLowerCase() ?? null;
    const videoOk = videoCodec != null && H264_CODECS.has(videoCodec);
    const audioOk = audioCodec == null || COMPATIBLE_AUDIO_CODECS.has(audioCodec);
    return { compatible: videoOk && audioOk };
  } catch {
    return { compatible: false };
  }
}

const COMMON_INPUT_FLAGS = [
  "-hide_banner",
  "-loglevel",
  "warning",
  "-user_agent",
  DEFAULT_UA,
  "-probesize",
  "5000000",
  "-analyzeduration",
  "5000000",
  "-fflags",
  "+genpts+discardcorrupt+igndts+nobuffer",
  "-err_detect",
  "ignore_err",
  "-max_delay",
  "5000000",
  "-reconnect",
  "1",
  "-reconnect_streamed",
  "1",
  "-reconnect_delay_max",
  "5",
  "-seekable",
  "0",
];

const hlsOutputFlags = (outDir) => [
  "-f",
  "hls",
  "-hls_time",
  "4",
  "-hls_list_size",
  "0",
  "-hls_flags",
  "independent_segments+append_list",
  "-hls_segment_type",
  "mpegts",
  "-hls_segment_filename",
  `${outDir}/seg%04d.ts`,
  `${outDir}/stream.m3u8`,
];

function spawnRemuxCopy(sourceUrl, outDir) {
  return spawn(ffmpegPath, [
    ...COMMON_INPUT_FLAGS,
    "-i",
    sourceUrl,
    "-map",
    "0:v",
    "-map",
    "0:a",
    "-sn",
    "-dn",
    "-c",
    "copy",
    "-bsf:v",
    "dump_extra",
    "-fps_mode",
    "passthrough",
    "-max_muxing_queue_size",
    "1024",
    ...hlsOutputFlags(outDir),
  ]);
}

function spawnTranscode(sourceUrl, outDir) {
  return spawn(ffmpegPath, [
    ...COMMON_INPUT_FLAGS,
    "-i",
    sourceUrl,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-c:a",
    "aac",
    "-ar",
    "48000",
    "-b:a",
    "192k",
    "-fps_mode",
    "passthrough",
    "-max_muxing_queue_size",
    "1024",
    ...hlsOutputFlags(outDir),
  ]);
}

// ---- sessions -----------------------------------------------------------------
const sessions = new Map();
let sweepStarted = false;

function startSweep() {
  if (sweepStarted) return;
  sweepStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.lastAccess > IDLE_TIMEOUT_MS) void removeSession(id);
    }
  }, SWEEP_INTERVAL_MS).unref();
}

async function waitForPlaylist(dir, hasExited, stderrTail) {
  const playlistPath = path.join(dir, "stream.m3u8");
  const deadline = Date.now() + PLAYLIST_POLL_TIMEOUT_MS;
  for (;;) {
    try {
      const contents = await readFile(playlistPath, "utf8");
      if (contents.includes(".ts")) return;
    } catch {
      // not written yet, keep polling
    }
    const exit = hasExited();
    if (exit) {
      const tail = stderrTail().trim().slice(-500);
      throw new Error(`ffmpeg exited (${exit.code}) before producing a playlist${tail ? `: ${tail}` : ""}`);
    }
    if (Date.now() > deadline) throw new Error("Timed out waiting for the remux playlist");
    await new Promise((resolve) => setTimeout(resolve, PLAYLIST_POLL_INTERVAL_MS));
  }
}

async function createSession(sourceUrl) {
  startSweep();
  const id = randomUUID();
  const dir = path.join(CACHE_ROOT, id);
  await mkdir(dir, { recursive: true });

  const probe = await probeStream(sourceUrl);
  const child = probe.compatible ? spawnRemuxCopy(sourceUrl, dir) : spawnTranscode(sourceUrl, dir);

  const session = { id, dir, process: child, lastAccess: Date.now() };
  sessions.set(id, session);

  let stderrTail = "";
  child.stderr.on("data", (chunk) => {
    stderrTail = (stderrTail + chunk.toString()).slice(-2000);
  });
  let exitInfo = null;
  child.once("exit", (code) => {
    exitInfo = { code };
  });

  try {
    await waitForPlaylist(dir, () => exitInfo, () => stderrTail);
  } catch (err) {
    await removeSession(id);
    throw err;
  }

  return id;
}

function touchSession(id) {
  const session = sessions.get(id);
  if (session) session.lastAccess = Date.now();
}

async function removeSession(id) {
  const session = sessions.get(id);
  sessions.delete(id);
  if (session) {
    session.process.kill("SIGTERM");
    setTimeout(() => session.process.kill("SIGKILL"), 3000).unref();
  }
  await rm(session?.dir ?? path.join(CACHE_ROOT, id), { recursive: true, force: true });
}

// file comes straight off the URL path — reject anything that isn't a bare
// filename (no path traversal via ../ or absolute paths).
function sessionFilePath(id, file) {
  const session = sessions.get(id);
  if (!session) return null;
  if (file.includes("/") || file.includes("\\") || file.includes("..")) return null;
  return path.join(session.dir, file);
}

// ---- http server ---------------------------------------------------------------
function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const parts = url.pathname.split("/").filter(Boolean);

  // Unauthenticated on purpose — load balancer/orchestrator health probes generally
  // can't be handed the bearer token, and this reveals nothing sensitive.
  if (url.pathname === "/health") return sendJson(res, 200, { ok: true });

  const auth = (req.headers["authorization"] || "").replace("Bearer ", "");
  if (auth !== TOKEN) return sendJson(res, 401, { error: "unauthorized" });

  if (req.method === "POST" && url.pathname === "/sessions") {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: "invalid_json_body" });
    }
    if (!body.sourceUrl) return sendJson(res, 400, { error: "sourceUrl is required" });

    let sourceUrl;
    try {
      sourceUrl = new URL(body.sourceUrl);
    } catch {
      return sendJson(res, 400, { error: "invalid sourceUrl" });
    }
    if (!isSafeTarget(sourceUrl)) return sendJson(res, 403, { error: "refusing_to_remux_target" });

    try {
      const sessionId = await createSession(sourceUrl.toString());
      log(`session ${sessionId} created for ${sourceUrl.hostname}`);
      return sendJson(res, 201, { sessionId });
    } catch (err) {
      log("session create failed:", err.message);
      return sendJson(res, 502, { error: err.message });
    }
  }

  // DELETE /sessions/:id
  if (req.method === "DELETE" && parts[0] === "sessions" && parts.length === 2) {
    await removeSession(parts[1]);
    return sendJson(res, 200, { ok: true });
  }

  // GET /sessions/:id/:file
  if (req.method === "GET" && parts[0] === "sessions" && parts.length === 3) {
    const [, sessionId, file] = parts;
    const filePath = sessionFilePath(sessionId, file);
    if (!filePath) return sendJson(res, 404, { error: "session_not_found" });
    touchSession(sessionId);

    let size;
    try {
      size = (await stat(filePath)).size;
    } catch {
      return sendJson(res, 404, { error: "file_not_found" });
    }

    const isPlaylist = file.endsWith(".m3u8");
    const contentType = isPlaylist ? "application/vnd.apple.mpegurl" : "video/mp2t";

    const range = req.headers.range;
    const match = !isPlaylist && range ? /bytes=(\d+)-(\d*)/.exec(range) : null;
    if (match) {
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : size - 1;
      res.writeHead(206, {
        "Content-Type": contentType,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
        "Accept-Ranges": "bytes",
      });
      return createReadStream(filePath, { start, end }).pipe(res);
    }

    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      ...(isPlaylist ? { "Cache-Control": "no-store" } : {}),
    });
    return createReadStream(filePath).pipe(res);
  }

  sendJson(res, 404, { error: "not_found" });
});

server.listen(PORT, () => {
  log(`remux-service on :${PORT}, cache root ${CACHE_ROOT}`);
});
