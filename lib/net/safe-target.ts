// Shared by the stream proxy and the remux service — both re-fetch a portal-resolved
// URL server-side, so both need the same guard against the resolved URL pointing at
// internal infrastructure (SSRF via a malicious/compromised portal response).
const PRIVATE_HOST_PATTERN =
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1|169\.254\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/i;

export function isSafeTarget(url: URL): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (PRIVATE_HOST_PATTERN.test(url.hostname)) return false;
  return true;
}
