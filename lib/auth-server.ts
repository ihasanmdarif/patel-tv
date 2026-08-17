import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";
import { roles } from "@/lib/auth-roles";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    // No self-serve signup flow — accounts are created by an admin (or the one-time
    // /admin bootstrap), so there's no email deliverability requirement here.
    autoSignIn: true,
  },
  plugins: [admin({ defaultRole: "viewer", roles })],
});
