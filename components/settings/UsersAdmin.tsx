"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role?: string | string[] | null;
};

const EMPTY_FORM = { name: "", email: "", password: "", role: "user" as "user" | "admin" };

export default function UsersAdmin({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadUsers() {
    const { data, error: listError } = await authClient.admin.listUsers({
      query: { limit: 100, sortBy: "createdAt", sortDirection: "desc" },
    });
    if (listError) {
      setError(listError.message ?? "Failed to load users");
      return;
    }
    setUsers(data?.users ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: createError } = await authClient.admin.createUser({
      email: form.email,
      password: form.password,
      name: form.name,
      role: form.role,
    });
    if (createError) {
      setError(createError.message ?? "Failed to create user");
      setSubmitting(false);
      return;
    }
    setForm(EMPTY_FORM);
    setSubmitting(false);
    await loadUsers();
  }

  async function handleRemove(userId: string) {
    setUsers((prev) => prev?.filter((u) => u.id !== userId) ?? null);
    await authClient.admin.removeUser({ userId });
  }

  return (
    <div className="mt-8 flex flex-col gap-8">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-2xl border border-surface-border bg-surface p-5 shadow-sm"
      >
        <h2 className="text-sm font-semibold">Create user</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
            Name
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-lg border border-surface-border bg-transparent px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
            Email
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="rounded-lg border border-surface-border bg-transparent px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
            Temporary password
            <input
              required
              minLength={8}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="rounded-lg border border-surface-border bg-transparent px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
            Role
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as "user" | "admin" })}
              className="rounded-lg border border-surface-border bg-transparent px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create user"}
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {users === null && <p className="text-sm text-muted">Loading users...</p>}
        {users?.length === 0 && <p className="text-sm text-muted">No users yet.</p>}
        {users?.map((u) => {
          const role = Array.isArray(u.role) ? u.role.join(", ") : (u.role ?? "user");
          return (
            <div
              key={u.id}
              className="flex flex-col gap-3 rounded-2xl border border-surface-border bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{u.name}</p>
                <p className="text-xs text-muted">
                  {u.email} &middot; {role}
                </p>
              </div>
              {u.id !== currentUserId && (
                <button
                  onClick={() => handleRemove(u.id)}
                  className="self-start rounded-lg border border-surface-border px-3 py-1.5 text-sm font-medium text-muted transition hover:border-danger hover:text-danger sm:self-auto"
                >
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
