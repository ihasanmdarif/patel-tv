import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ContentType } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";

function parseContentType(value: unknown): ContentType | null {
  return value === "MOVIE" || value === "EPISODE" || value === "CHANNEL" ? value : null;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profileId = req.nextUrl.searchParams.get("profileId");
  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(Number(limitParam), 1), 100) : 20;

  const history = await prisma.watchHistory.findMany({
    where: { userId: user.id, profileId },
    orderBy: { updatedAt: "desc" },
    take: Number.isFinite(limit) ? limit : 20,
  });
  return NextResponse.json(history);
}

// Autosave: called every ~10s while playing. Always an upsert, never read-then-write.
// - MOVIE/EPISODE: positionSec is an absolute resume point, overwritten each call.
// - CHANNEL: live TV has no resume point, so elapsedSec (a delta since the last call)
//   is accumulated into positionSec as a running total of seconds watched instead.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { profileId, contentId, title, cmd } = body as Record<string, string | undefined>;
  const contentType = parseContentType(body.contentType);

  if (!profileId || !contentType || !contentId || !title || !cmd) {
    return NextResponse.json(
      { error: "profileId, contentType, contentId, title, and cmd are required" },
      { status: 400 }
    );
  }

  if (contentType === "CHANNEL") {
    // Clamp defensively — a runaway delta (e.g. a backgrounded tab waking up) would
    // silently inflate watch hours since this accumulates rather than overwrites.
    const elapsedSec = Math.min(Math.floor(Number(body.elapsedSec)), 60);
    if (!Number.isFinite(elapsedSec) || elapsedSec <= 0) {
      return NextResponse.json({ error: "elapsedSec is required" }, { status: 400 });
    }
    const entry = await prisma.watchHistory.upsert({
      where: {
        userId_profileId_contentType_contentId: { userId: user.id, profileId, contentType, contentId },
      },
      create: { userId: user.id, profileId, contentType, contentId, title, cmd, positionSec: elapsedSec },
      update: { positionSec: { increment: elapsedSec } },
    });
    return NextResponse.json(entry, { status: 201 });
  }

  const positionSec = Number(body.positionSec);
  if (!Number.isFinite(positionSec)) {
    return NextResponse.json({ error: "positionSec is required" }, { status: 400 });
  }
  const durationSec = body.durationSec != null ? Number(body.durationSec) : undefined;

  const entry = await prisma.watchHistory.upsert({
    where: {
      userId_profileId_contentType_contentId: { userId: user.id, profileId, contentType, contentId },
    },
    create: {
      userId: user.id,
      profileId,
      contentType,
      contentId,
      seriesId: (body.seriesId as string | undefined) ?? null,
      title,
      seriesTitle: (body.seriesTitle as string | undefined) ?? null,
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
