import { NextRequest, NextResponse } from "next/server";
import { loadProfileConfig } from "@/lib/stalker/load-profile";
import { getVodItems, StalkerError } from "@/lib/stalker/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params;
  const config = await loadProfileConfig(profileId);
  if (!config) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const categoryId = req.nextUrl.searchParams.get("categoryId") ?? undefined;

  try {
    const items = await getVodItems(config, categoryId);
    return NextResponse.json(items);
  } catch (err) {
    const status = err instanceof StalkerError ? 502 : 500;
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status });
  }
}
