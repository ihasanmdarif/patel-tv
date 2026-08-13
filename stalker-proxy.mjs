#!/usr/bin/env node
// stalker-proxy.mjs
// Local CORS relay + auth shim between your browser web-app and a Stalker/
// Ministra portal. The browser talks to THIS server (same-origin, no CORS,
// no forbidden headers); this server talks to the portal as your MAG device,
// injecting the mac cookie, timezone, stb_lang, and the MAG User-Agent that a
// browser is not allowed to set from JS.
//
// It handles the token lifecycle for you: handshake once, cache the token,
// attach it as Bearer on every call, and auto-re-handshake on expiry.
//
// Run:   node stalker-proxy.mjs
// Config via env (all optional except MAC):
//   PORTAL   base portal URL         (default http://tv.patel4k.cc)
//   MAC      virtual MAC             (default 00:1A:79:18:3C:3E)
//   SN       serial / software id    (default F4:DD:06:18:3C:3E)
//   TZ       timezone                (default America/Winnipeg)
//   PORT     local listen port       (default 8787)
//
// Frontend usage (from your web app):
//   GET  http://localhost:8787/api?type=itv&action=get_all_channels
//   GET  http://localhost:8787/api?type=itv&action=create_link&cmd=...
//   GET  http://localhost:8787/health
// You pass Stalker query params straight through; the shim adds auth + identity.

import http from 'node:http';
import crypto from 'node:crypto';

const CFG = {
  PORTAL: (process.env.PORTAL || 'http://tv.patel4k.cc').replace(/\/+$/, ''),
  MAC:    process.env.MAC || '00:1A:79:18:3C:3E',
  SN:     process.env.SN  || 'F4:DD:06:18:3C:3E',
  TZ:     process.env.TZ  || 'America/Winnipeg',
  PORT:   parseInt(process.env.PORT || '8787', 10),
  // MAG250 UA — portal binds the token to (MAC + this UA); keep verbatim.
  UA: 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
};

// candidate portal base paths — first that yields a token wins, then cached
const PORTAL_PATHS = [
  '/stalker_portal/server/load.php',
  '/portal.php',
  '/server/load.php',
  '/c/server/load.php',
  '/magLoad.php',
];

const sha256Upper = (s) => crypto.createHash('sha256').update(s).digest('hex').toUpperCase();

// device identity derived from SN + MAC (MAG-emulation convention)
const DEVICE = {
  device_id:  sha256Upper(CFG.SN),
  device_id2: sha256Upper(CFG.MAC),
  signature:  sha256Upper(CFG.SN + CFG.MAC),
};

const cookie = () =>
  `mac=${CFG.MAC}; stb_lang=en; timezone=${CFG.TZ}; ` +
  `sn=${CFG.SN}; device_id=${DEVICE.device_id}; device_id2=${DEVICE.device_id2}`;

// ---- portal session state ----------------------------------------------------
const session = { base: null, token: null };

function portalUrl(base, params) {
  const qs = new URLSearchParams(params);
  qs.set('JsHttpRequest', '1-xml'); // Stalker's required response-format flag
  return `${base}?${qs.toString()}`;
}

async function portalGet(base, params) {
  const res = await fetch(portalUrl(base, params), {
    headers: {
      'User-Agent': CFG.UA,
      'Cookie': cookie(),
      'Authorization': `Bearer ${session.token || ''}`,
      'X-User-Agent': 'Model: MAG250; Link: WiFi',
      'Accept': '*/*',
    },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* portal sometimes returns HTML on error */ }
  return { status: res.status, text, json };
}

// resolve which portal path works + get a fresh token
async function handshake() {
  const bases = session.base ? [session.base] : PORTAL_PATHS.map(p => CFG.PORTAL + p);
  for (const base of bases) {
    session.token = ''; // handshake carries empty bearer
    const r = await portalGet(base, { type: 'stb', action: 'handshake', token: '' });
    const tok = r.json?.js?.token;
    if (tok) {
      session.base = base;
      session.token = tok;
      log(`handshake ok @ ${base}  token=${tok.slice(0, 12)}…`);
      return true;
    }
  }
  session.base = null;
  session.token = null;
  return false;
}

// a call looks "unauthorized/expired" if the portal says so
function looksUnauthorized(r) {
  if (r.status === 401) return true;
  const t = (r.text || '').toLowerCase();
  return t.includes('authorization failed') || t.includes('token') && t.includes('invalid');
}

// main relay: ensure token, forward params, re-handshake once on expiry
async function relay(params) {
  if (!session.token && !(await handshake())) {
    return { status: 502, json: { error: 'handshake_failed', portal: CFG.PORTAL } };
  }
  let r = await portalGet(session.base, params);
  if (looksUnauthorized(r)) {
    log('token rejected — re-handshaking');
    if (!(await handshake())) {
      return { status: 502, json: { error: 'rehandshake_failed' } };
    }
    r = await portalGet(session.base, params);
  }
  return r;
}

// ---- tiny http server --------------------------------------------------------
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function send(res, status, body, extra = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...extra });
  res.end(payload);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }

  const url = new URL(req.url, `http://localhost:${CFG.PORT}`);

  if (url.pathname === '/health') {
    return send(res, 200, {
      ok: true,
      portal: CFG.PORTAL,
      base: session.base,
      hasToken: !!session.token,
      mac: CFG.MAC,
      device: { device_id: DEVICE.device_id.slice(0, 12) + '…' },
    });
  }

  if (url.pathname === '/api') {
    // pass through every Stalker param the frontend supplied
    const params = {};
    for (const [k, v] of url.searchParams) params[k] = v;
    if (!params.type) return send(res, 400, { error: 'missing_type_param' });
    try {
      const r = await relay(params);
      // prefer clean JSON to the frontend; fall back to raw text
      if (r.json) return send(res, r.status || 200, r.json);
      return send(res, r.status || 200, r.text || '', { 'Content-Type': 'text/plain; charset=utf-8' });
    } catch (e) {
      log('relay error: ' + e.message);
      return send(res, 502, { error: 'relay_exception', detail: e.message });
    }
  }

  send(res, 404, { error: 'not_found', try: ['/api?type=…', '/health'] });
});

function log(...a) { console.log(new Date().toISOString().slice(11, 19), ...a); }

server.listen(CFG.PORT, () => {
  log(`stalker-proxy on http://localhost:${CFG.PORT}`);
  log(`portal=${CFG.PORTAL} mac=${CFG.MAC} tz=${CFG.TZ}`);
  log(`device_id=${DEVICE.device_id.slice(0,12)}… (from SN)`);
  log(`try:  curl "http://localhost:${CFG.PORT}/health"`);
  log(`then: curl "http://localhost:${CFG.PORT}/api?type=stb&action=get_profile"`);
});
