"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role?: string | string[] | null;
};

type HistoryItem = {
  id: string;
  title: string;
  seriesTitle: string | null;
  contentType: "CHANNEL" | "MOVIE" | "EPISODE";
  positionSec: number;
  updatedAt: Date;
};

const EMPTY_FORM = { name: "", email: "", password: "", role: "viewer" as "viewer" | "admin" };

const TYPE_LABEL: Record<HistoryItem["contentType"], string> = {
  CHANNEL: "Live TV",
  MOVIE: "Movie",
  EPISODE: "Episode",
};

function formatWatchTime(totalSec: number): string {
  if (totalSec < 60) return "< 1m";
  if (totalSec < 3600) return `${Math.round(totalSec / 60)}m`;
  return `${(totalSec / 3600).toFixed(1)}h`;
}

type Profile = { id: string; name: string };
type ExpandedPanel = { userId: string; section: "history" | "access" } | null;

export default function AdminDashboard({
  currentUserId,
  watchSeconds,
  historyByUser,
  profiles,
  allowedProfileIdsByUser,
}: {
  currentUserId: string;
  watchSeconds: Record<string, number>;
  historyByUser: Record<string, HistoryItem[]>;
  profiles: Profile[];
  allowedProfileIdsByUser: Record<string, string[]>;
}) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ExpandedPanel>(null);
  // Local copy so checkbox toggles reflect immediately; seeded from the server prop.
  const [access, setAccess] = useState(allowedProfileIdsByUser);

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

  function grantProfile(userId: string, profileId: string) {
    return fetch("/api/admin/profile-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, profileId }),
    });
  }

  function revokeProfile(userId: string, profileId: string) {
    return fetch(`/api/admin/profile-access?userId=${userId}&profileId=${profileId}`, {
      method: "DELETE",
    });
  }

  // Clears the restriction entirely — back to unrestricted/full access.
  async function clearRestriction(userId: string) {
    setAccess((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    await fetch(`/api/admin/profile-access?userId=${userId}`, { method: "DELETE" });
  }

  // undefined = never restricted (unrestricted, every profile allowed) — see
  // lib/profile-access.ts. An [] entry is a deliberate "restricted to nothing" state,
  // distinct from undefined. Unchecking a box while unrestricted has to first
  // materialize that implicit "all" into explicit grants for everything else, since
  // there's nothing to delete yet.
  async function toggleProfileAccess(userId: string, profileId: string) {
    const current = access[userId];
    const isUnrestricted = current === undefined;

    if (isUnrestricted) {
      const explicit = profiles.map((p) => p.id).filter((id) => id !== profileId);
      setAccess((prev) => ({ ...prev, [userId]: explicit }));
      await Promise.all(explicit.map((id) => grantProfile(userId, id)));
      return;
    }

    const currentlyAllowed = current.includes(profileId);
    setAccess((prev) => ({
      ...prev,
      [userId]: currentlyAllowed
        ? current.filter((id) => id !== profileId)
        : [...current, profileId],
    }));
    await (currentlyAllowed ? revokeProfile(userId, profileId) : grantProfile(userId, profileId));
  }

  return (
    <div className="flex flex-col gap-8">
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
              onChange={(e) => setForm({ ...form, role: e.target.value as "viewer" | "admin" })}
              className="rounded-lg border border-surface-border bg-transparent px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value="viewer">Viewer</option>
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
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Users</h2>
          <p
            className="text-xs text-muted"
            title="Approximate — VOD is derived from each item's latest saved playback position, not a true session-time sum. Live TV is a running total of watched seconds, tracked in ~10s ticks while a stream is actively playing."
          >
            Watch hours are approximate
          </p>
        </div>
        {users === null && <p className="text-sm text-muted">Loading users...</p>}
        {users?.length === 0 && <p className="text-sm text-muted">No users yet.</p>}
        {users?.map((u) => {
          const role = Array.isArray(u.role) ? u.role.join(", ") : (u.role ?? "viewer");
          const isAdminUser = role === "admin";
          const history = historyByUser[u.id] ?? [];
          const grants = access[u.id];
          const isUnrestricted = grants === undefined;
          const panel = expanded?.userId === u.id ? expanded.section : null;
          return (
            <div
              key={u.id}
              className="flex flex-col gap-3 rounded-2xl border border-surface-border bg-surface p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-muted">
                    {u.email} &middot; {role} &middot; {formatWatchTime(watchSeconds[u.id] ?? 0)} watched
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 self-start sm:self-auto">
                  {!isAdminUser && (
                    <button
                      onClick={() =>
                        setExpanded(panel === "access" ? null : { userId: u.id, section: "access" })
                      }
                      className="rounded-lg border border-surface-border px-3 py-1.5 text-sm font-medium text-muted transition hover:text-foreground"
                    >
                      {panel === "access"
                        ? "Hide sources"
                        : isUnrestricted
                          ? "Sources (all)"
                          : `Sources (${grants.length}/${profiles.length})`}
                    </button>
                  )}
                  <button
                    onClick={() =>
                      setExpanded(panel === "history" ? null : { userId: u.id, section: "history" })
                    }
                    disabled={history.length === 0}
                    className="rounded-lg border border-surface-border px-3 py-1.5 text-sm font-medium text-muted transition hover:text-foreground disabled:opacity-40"
                  >
                    {panel === "history" ? "Hide history" : `History (${history.length})`}
                  </button>
                  {u.id !== currentUserId && (
                    <button
                      onClick={() => handleRemove(u.id)}
                      className="rounded-lg border border-surface-border px-3 py-1.5 text-sm font-medium text-muted transition hover:border-danger hover:text-danger"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              {panel === "access" && (
                <div className="flex flex-col gap-2 border-t border-surface-border pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted">
                      {isUnrestricted
                        ? "Unrestricted — can use every source. Uncheck any to restrict."
                        : grants.length === 0
                          ? "Restricted to nothing — this user can't use any source."
                          : "Restricted to the checked sources."}
                    </p>
                    {!isUnrestricted && (
                      <button
                        onClick={() => clearRestriction(u.id)}
                        className="shrink-0 text-xs font-medium text-accent hover:underline"
                      >
                        Grant full access
                      </button>
                    )}
                  </div>
                  {profiles.length === 0 && <p className="text-sm text-muted">No sources yet.</p>}
                  {profiles.map((p) => {
                    const checked = isUnrestricted || grants.includes(p.id);
                    return (
                      <label key={p.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleProfileAccess(u.id, p.id)}
                          className="accent-accent"
                        />
                        {p.name}
                      </label>
                    );
                  })}
                </div>
              )}
              {panel === "history" && (
                <div className="flex flex-col divide-y divide-surface-border border-t border-surface-border pt-2">
                  {history.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate">{item.title}</p>
                        <p className="truncate text-xs text-muted">
                          {TYPE_LABEL[item.contentType]}
                          {item.seriesTitle ? ` · ${item.seriesTitle}` : ""} &middot;{" "}
                          {new Date(item.updatedAt).toLocaleString()}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted">
                        {formatWatchTime(item.positionSec)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
