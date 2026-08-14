// Shared across lib/stalker/client.ts, the stream proxy, and the remux service —
// the portal binds sessions to this exact MAG-STB user agent, and the remux
// service needs to present the same UA when it re-fetches the resolved stream URL.
export const STB_USER_AGENT =
  "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3";
