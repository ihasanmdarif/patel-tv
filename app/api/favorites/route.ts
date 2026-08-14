import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ContentType } from "@prisma/client";

function parseContentType(value: unknown): ContentType | null {
  return typeof value === "string" && value in ContentType ? (value as ContentType) : null;
}

export async function GET(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profileId");
  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }
  const contentType = parseContentType(req.nextUrl.searchParams.get("contentType"));

  const favorites = await prisma.favorite.findMany({
    where: { profileId, ...(contentType ? { contentType } : {}) },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(favorites);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { profileId, contentId, title } = body as Record<string, string | undefined>;
  const contentType = parseContentType(body.contentType);

  if (!profileId || !contentType || !contentId || !title) {
    return NextResponse.json(
      { error: "profileId, contentType, contentId, and title are required" },
      { status: 400 }
    );
  }

  const favorite = await prisma.favorite.upsert({
    where: { profileId_contentType_contentId: { profileId, contentType, contentId } },
    create: {
      profileId,
      contentType,
      contentId,
      title,
      cmd: (body.cmd as string | undefined) ?? null,
      logo: (body.logo as string | undefined) ?? null,
    },
    update: {},
  });
  return NextResponse.json(favorite, { status: 201 });
}

// Optimistic-toggle-off path: the UI doesn't need to hold onto the Favorite row's
// cuid, just the (profileId, contentType, contentId) it already has in hand.
export async function DELETE(req: NextRequest) {
  const profileId = req.nextUrl.searchParams.get("profileId");
  const contentId = req.nextUrl.searchParams.get("contentId");
  const contentType = parseContentType(req.nextUrl.searchParams.get("contentType"));
  if (!profileId || !contentType || !contentId) {
    return NextResponse.json(
      { error: "profileId, contentType, and contentId are required" },
      { status: 400 }
    );
  }

  await prisma.favorite
    .delete({ where: { profileId_contentType_contentId: { profileId, contentType, contentId } } })
    .catch(() => null);
  return NextResponse.json({ ok: true });
}
