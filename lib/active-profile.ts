import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const ACTIVE_PROFILE_COOKIE = "active_profile_id";

// Home/Guide/Movies/Series/Settings read the active profile from this cookie rather
// than a URL segment. Falls back to the most-recently-connected profile when the
// cookie is missing/stale (e.g. its profile got deleted), and to null if there are
// no profiles at all — callers decide what "no active profile" means for them.
export async function getActiveProfileId(): Promise<string | null> {
  const store = await cookies();
  const cookieValue = store.get(ACTIVE_PROFILE_COOKIE)?.value;
  if (cookieValue) {
    const exists = await prisma.profile.findUnique({
      where: { id: cookieValue },
      select: { id: true },
    });
    if (exists) return exists.id;
  }
  const fallback = await prisma.profile.findFirst({ orderBy: { lastConnectedAt: "desc" } });
  return fallback?.id ?? null;
}
