type CachedSession = {
  token: string;
  expiresAt: number;
};

const TOKEN_TTL_MS = 20 * 60 * 1000;

const sessions = new Map<string, CachedSession>();

export function getCachedToken(profileId: string): string | null {
  const entry = sessions.get(profileId);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.token;
}

export function setCachedToken(profileId: string, token: string): void {
  sessions.set(profileId, { token, expiresAt: Date.now() + TOKEN_TTL_MS });
}

export function clearCachedToken(profileId: string): void {
  sessions.delete(profileId);
}
