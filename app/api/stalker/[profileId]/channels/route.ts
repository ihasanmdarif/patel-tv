import { NextRequest, NextResponse } from "next/server";
import { loadProfileConfig } from "@/lib/stalker/load-profile";
import { getChannels, getChannelsPage, StalkerError } from "@/lib/stalker/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const config = await loadProfileConfig(profileId);
  if (!config) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const genreId = req.nextUrl.searchParams.get("genreId") ?? undefined;
  const pageParam = req.nextUrl.searchParams.get("page");

  try {
    // Paged mode (page param present): fetch one portal page at a time, for UIs that
    // page through channels instead of needing the whole catalog (e.g. the EPG Guide).
    if (pageParam) {
      const page = Number(pageParam);
      const { items, totalItems } = await getChannelsPage(config, page, genreId);
      return NextResponse.json({ items, page, pageSize: items.length, totalItems });
    }
    const channels = await getChannels(config, genreId);
    return NextResponse.json(channels);
  } catch (err) {
    console.error("Error fetching channels:", err);
    const status = err instanceof StalkerError ? 502 : 500;
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status });
  }
}
