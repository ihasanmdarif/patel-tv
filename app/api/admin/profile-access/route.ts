import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// Grants a viewer access to one Profile (IPTV source), switching them into restricted
// mode (creating the ProfileRestriction marker) if they weren't already. See
// lib/profile-access.ts for what that marker means.
export async function POST(req: NextRequest) {
  const admin = await getCurrentUser();
  if (admin?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { userId, profileId } = body as Record<string, string | undefined>;
  if (!userId || !profileId) {
    return NextResponse.json({ error: "userId and profileId are required" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.profileRestriction.upsert({ where: { userId }, create: { userId }, update: {} }),
    prisma.profileAccess.upsert({
      where: { userId_profileId: { userId, profileId } },
      create: { userId, profileId },
      update: {},
    }),
  ]);
  return NextResponse.json({ ok: true }, { status: 201 });
}

// With profileId: revokes just that one grant (stays in restricted mode, possibly down
// to zero allowed profiles — a valid "deny everything" state).
// Without profileId: clears the restriction entirely, back to unrestricted/full access.
export async function DELETE(req: NextRequest) {
  const admin = await getCurrentUser();
  if (admin?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userId = req.nextUrl.searchParams.get("userId");
  const profileId = req.nextUrl.searchParams.get("profileId");
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  if (profileId) {
    await prisma.profileAccess.delete({ where: { userId_profileId: { userId, profileId } } }).catch(() => null);
  } else {
    await prisma.$transaction([
      prisma.profileAccess.deleteMany({ where: { userId } }),
      prisma.profileRestriction.deleteMany({ where: { userId } }),
    ]);
  }
  return NextResponse.json({ ok: true });
}
