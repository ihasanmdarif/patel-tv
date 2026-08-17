import { defaultAc } from "better-auth/plugins/admin/access";

// Same permission shape Better Auth's built-in "user"/"admin" roles use, just renamed
// to "viewer" so it reads correctly in the UI (Settings/Admin role picker, user lists).
export const roles = {
  viewer: defaultAc.newRole({ user: [], session: [] }),
  admin: defaultAc.newRole({
    user: [
      "create",
      "list",
      "set-role",
      "ban",
      "impersonate",
      "delete",
      "set-password",
      "set-email",
      "get",
      "update",
    ],
    session: ["list", "revoke", "delete"],
  }),
};
