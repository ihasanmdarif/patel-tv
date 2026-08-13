type CachedBase = {
  base: string;
  expiresAt: number;
};

const BASE_TTL_MS = 24 * 60 * 60 * 1000;

const bases = new Map<string, CachedBase>();

export function getCachedBase(profileId: string): string | null {
  const entry = bases.get(profileId);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.base;
}

export function setCachedBase(profileId: string, base: string): void {
  bases.set(profileId, { base, expiresAt: Date.now() + BASE_TTL_MS });
}

export function clearCachedBase(profileId: string): void {
  bases.delete(profileId);
}
