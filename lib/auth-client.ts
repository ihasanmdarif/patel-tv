"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient, deviceAuthorizationClient } from "better-auth/client/plugins";
import { roles } from "@/lib/auth-roles";

export const authClient = createAuthClient({
  plugins: [adminClient({ roles }), deviceAuthorizationClient()],
});
