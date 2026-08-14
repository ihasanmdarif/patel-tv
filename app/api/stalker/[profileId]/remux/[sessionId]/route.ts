import { NextResponse } from "next/server";
import { removeSession } from "@/lib/remux/remote-client";

export const dynamic = "force-dynamic";

// Best-effort explicit teardown when the player navigates away; the idle sweep in
// remux-service's session lifecycle is the real backstop if this never fires (tab
// close, crash).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  await removeSession(sessionId);
  return NextResponse.json({ ok: true });
}
