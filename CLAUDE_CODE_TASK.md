# Task: IPTV player for the `patel-tv` Next.js app (Stalker/Ministra portal)

## Goal
Turn `patel-tv` into a working macOS-oriented web player for a Stalker/Ministra
IPTV portal. The app should: authenticate as a MAG-style device, list channels,
resolve a channel to a stream URL, and play it in-browser.

**First, inspect the project and match its conventions** (App vs Pages Router,
TS vs JS, styling, any data-fetching lib). Everything below is the target
behavior, not a mandate on file layout — adapt to what's already there.

## Critical context (already established — do not re-investigate)
- Portal base URL: `http://tv.patel4k.cc` (config URL is https, but the Stalker
  API calls work over plain HTTP on port 80).
- Working portal path: `/stalker_portal/server/load.php` (probe the others only
  as fallback: `/portal.php`, `/server/load.php`, `/c/server/load.php`, `/magLoad.php`).
- Device identity (put in `.env.local`, never hardcode):
  - `MAC=00:1A:79:18:3C:3E`
  - `SN=F4:DD:06:18:3C:3E`  (Smart STB "Software ID"; there is no separate serial)
  - `PORTAL=http://tv.patel4k.cc`
  - `TZ=America/Winnipeg`
- MAG User-Agent (send verbatim on EVERY call — the portal binds the token to
  MAC + UA together):
  `Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3`

### KNOWN BLOCKER (not a bug to fix in code)
Against the live portal, `get_profile` currently returns
`"Device conflict - Serial Number mismatch"`. This is a provider-side device
binding that only the IPTV provider can reset — it is NOT solvable client-side,
and you should NOT try to brute-force / iterate device_id or signature values to
get past it. Build against the included mock portal; the live portal will work
once the provider resets the binding and nothing in the code needs to change.

## Architecture
Because this is Next.js, implement the portal shim as a **server-side API route**,
not a separate process. The browser calls the same-origin route (so NO CORS and
no forbidden-header problems); the route calls the portal as the device.

1. **`lib/stalker.ts`** — server-only portal client:
   - `handshake()` → resolve working base path, POST/GET handshake, return token.
   - Token cache (module-level or a small in-memory store) + `getToken()` that
     re-handshakes on expiry.
   - Header builder: `User-Agent` (MAG UA), `Cookie`
     (`mac=…; stb_lang=en; timezone=…; sn=…; device_id=…; device_id2=…`),
     `Authorization: Bearer <token>`, `X-User-Agent: Model: MAG250; Link: WiFi`.
   - device_id derivation (SHA-256, uppercase hex):
     `device_id = sha256(SN)`, `device_id2 = sha256(MAC)`,
     `signature = sha256(SN + MAC)`.
   - Always append `JsHttpRequest=1-xml` to the query.
   - Typed helpers: `getProfile()`, `getAllChannels()`, `createLink(cmd)`.
   - "Authorization failed" / HTTP 401 in a response ⇒ re-handshake once, retry.

2. **API route** (e.g. `app/api/portal/route.ts` or `pages/api/portal.ts`):
   - Accept passthrough Stalker params (`type`, `action`, `cmd`, …).
   - Delegate to `lib/stalker.ts`, return the portal JSON (or raw text fallback).
   - Reject requests missing `type`.

3. **Frontend** (page/component):
   - On load, fetch channels: `/api/portal?type=itv&action=get_all_channels`
     → render `js.data[]` (id, name, number, logo if present). Group by genre if
     `get_genres` is easy to add.
   - Click a channel → `/api/portal?type=itv&action=create_link&cmd=<encoded cmd>`
     → response `js.cmd` contains the stream URL (often prefixed with `ffmpeg `
     or `ffrt ` — strip that prefix to get the bare URL).
   - Playback: Stalker streams are usually **MPEG-TS**, which `<video>` can't play
     natively. Use **mpegts.js** (`npm i mpegts.js`) via Media Source Extensions.
     Fallback: if the URL is `.m3u8`, use hls.js or native HLS instead.

## Mock portal for offline dev
A dependency-free mock is provided (`mock-portal.mjs`) that mimics handshake,
get_profile, get_all_channels, create_link, and simulates one token expiry.
Run it and point the app at it while building UI:

```
node mock-portal.mjs                 # fake portal on :9999
# set PORTAL=http://localhost:9999 in .env.local, then run the Next dev server
```

## Reference implementation
A standalone, already-tested Node shim (`stalker-proxy.mjs`) implements the exact
auth flow, token caching, and re-handshake logic described above. Port its logic
into `lib/stalker.ts` + the API route. Do NOT ship it as a separate server —
it's a reference for the route handler.

## Acceptance
- `npm run dev`, app loads a channel list from the mock portal.
- Clicking a channel resolves a stream URL via create_link.
- mpegts.js plays a TS stream (verify with any public TS/HLS test stream).
- Swapping `.env.local` PORTAL to `http://tv.patel4k.cc` changes nothing in code;
  it will return the device-conflict until the provider resets the binding.

## Do NOT
- Do not hardcode MAC/SN/portal — use `.env.local`.
- Do not attempt to defeat the "Device conflict" lock (guessing device_id/
  signature variants). That is a provider-side reset, out of scope for code.
- Do not add ARP spoofing / packet-capture tooling — that approach was abandoned;
  the app talks to the portal directly over HTTP.
