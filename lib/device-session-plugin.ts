import "server-only";
import { createAuthEndpoint, APIError } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import * as z from "zod";

/**
 * Better Auth's built-in device-authorization plugin's `/device/token` only
 * ever returns a bearer `access_token` — it never calls `setSessionCookie`
 * (confirmed by reading node_modules/better-auth/dist/plugins/device-authorization/routes.mjs
 * and cross-checking that no core router code consumes `ctx.context.newSession`
 * to write a cookie). That's correct for RFC 8628 device-flow API clients, but
 * this app is a cookie-session web app, so a TV that "signs in" via that
 * endpoint gets a token it can't use — the browser has no session cookie, and
 * every subsequent page redirects back to /login.
 *
 * This plugin adds one endpoint that mirrors /device/token's approved branch
 * but calls setSessionCookie (the same helper sign-in/sign-up use) so the TV's
 * browser actually ends up with a real session. The TV polls the built-in,
 * read-only GET /device?user_code=... to detect approval (see app/tv-login),
 * then calls this endpoint once to adopt the session and consume the code.
 */
export const deviceSessionPlugin = () => ({
  id: "device-session",
  endpoints: {
    adoptDeviceSession: createAuthEndpoint(
      "/device/adopt",
      {
        method: "POST",
        body: z.object({ device_code: z.string() }),
      },
      async (ctx) => {
        const { device_code } = ctx.body;
        const record = await ctx.context.adapter.findOne<{
          id: string;
          status: string;
          userId: string | null;
          expiresAt: Date;
        }>({
          model: "deviceCode",
          where: [{ field: "deviceCode", value: device_code }],
        });
        if (!record || record.status !== "approved" || !record.userId) {
          throw new APIError("BAD_REQUEST", {
            message: "Invalid or unapproved device code",
          });
        }
        if (record.expiresAt < new Date()) {
          throw new APIError("BAD_REQUEST", { message: "Device code expired" });
        }
        const user = await ctx.context.internalAdapter.findUserById(record.userId);
        if (!user) {
          throw new APIError("INTERNAL_SERVER_ERROR", { message: "User not found" });
        }
        const session = await ctx.context.internalAdapter.createSession(user.id);
        await setSessionCookie(ctx, { session, user });
        await ctx.context.adapter.delete({
          model: "deviceCode",
          where: [{ field: "id", value: record.id }],
        });
        return ctx.json({ success: true });
      },
    ),
  },
});
