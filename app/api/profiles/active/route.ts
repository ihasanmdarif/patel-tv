import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ACTIVE_PROFILE_COOKIE } from "@/lib/active-profile";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const profileId = body.profileId as string | undefined;
  if (!profileId) return NextResponse.json({ error: "profileId is required" }, { status: 400 });

  const profile = await prisma.profile.findUnique({ where: { id: profileId } });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACTIVE_PROFILE_COOKIE, profileId, {
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
