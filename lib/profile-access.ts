import "server-only";
import { prisma } from "@/lib/prisma";

type AccessUser = { id: string; role?: string | null };

// null = unrestricted (every profile). Admins are always unrestricted. A viewer with no
// ProfileRestriction row is also unrestricted — this feature is opt-in, so shipping it
// doesn't lock any existing account out until an admin explicitly restricts them in
// Settings > Admin. Once restricted, the ProfileAccess rows are the allow-list — an
// empty array is a valid, deliberate "restricted to nothing" state, distinct from never
// having been restricted at all.
export async function getAllowedProfileIds(user: AccessUser): Promise<string[] | null> {
  if (user.role === "admin") return null;
  const restricted = await prisma.profileRestriction.findUnique({ where: { userId: user.id } });
  if (!restricted) return null;
  const grants = await prisma.profileAccess.findMany({
    where: { userId: user.id },
    select: { profileId: true },
  });
  return grants.map((g) => g.profileId);
}

export async function canAccessProfile(user: AccessUser, profileId: string): Promise<boolean> {
  const allowed = await getAllowedProfileIds(user);
  return allowed === null || allowed.includes(profileId);
}
