import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ContentType } from "@prisma/client";

// Live channels don't get history rows, only VOD/series playback.
function parseContentType(value: unknown): Extract<ContentType, "MOVIE" | "EPISODE"> | null {
  return value === "MOVIE" || value === "EPISODE" ? value : null;
}

export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profileId");
  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(Number(limitParam), 1), 100) : 20;

  const history = await prisma.watchHistory.findMany({
    where: { profileId },
    orderBy: { updatedAt: "desc" },
    take: Number.isFinite(limit) ? limit : 20,
  });
  return NextResponse.json(history);
}

// Autosave: called every ~10s while playing. Always an upsert, never read-then-write.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { profileId, contentId, title, cmd } = body as Record<string, string | undefined>;
  const contentType = parseContentType(body.contentType);
  const positionSec = Number(body.positionSec);

  if (!profileId || !contentType || !contentId || !title || !cmd || !Number.isFinite(positionSec)) {
    return NextResponse.json(
      { error: "profileId, contentType, contentId, title, cmd, and positionSec are required" },
      { status: 400 }
    );
  }

  const durationSec = body.durationSec != null ? Number(body.durationSec) : undefined;

  const entry = await prisma.watchHistory.upsert({
    where: { profileId_contentType_contentId: { profileId, contentType, contentId } },
    create: {
      profileId,
      contentType,
      contentId,
      seriesId: (body.seriesId as string | undefined) ?? null,
      title,
      seriesTitle: (body.seriesTitle as string | undefined) ?? null,
      logo: (body.logo as string | undefined) ?? null,
      positionSec,
      durationSec: Number.isFinite(durationSec) ? durationSec : null,
      cmd,
    },
    update: {
      positionSec,
      ...(Number.isFinite(durationSec) ? { durationSec } : {}),
    },
  });
  return NextResponse.json(entry, { status: 201 });
}
