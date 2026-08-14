import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth-server";

// Bootstrap-only: creates the first admin account. Self-disables the moment any user
// exists, so this can't be used to mint extra accounts once real auth is up — after
// that, admins create users from Settings (which requires an authenticated admin
// session, enforced by the admin plugin).
export async function POST(req: NextRequest) {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    return NextResponse.json({ error: "Setup already completed" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : "Admin";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const signUpRes = await auth.api.signUpEmail({
    body: { email, password, name },
    asResponse: true,
  });

  if (!signUpRes.ok) {
    const data = await signUpRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: data?.message ?? "Failed to create admin account" },
      { status: signUpRes.status }
    );
  }

  const created = await prisma.user.findUnique({ where: { email } });
  if (created) {
    await prisma.user.update({ where: { id: created.id }, data: { role: "admin" } });
  }

  // Forward the session cookie Better Auth set on signUpRes so the new admin lands
  // logged in, without leaking the rest of its body (we return our own shape).
  // getSetCookie() (not header.get, which comma-joins) preserves multiple Set-Cookie values.
  const res = NextResponse.json({ ok: true });
  for (const cookie of signUpRes.headers.getSetCookie()) {
    res.headers.append("set-cookie", cookie);
  }
  return res;
}
