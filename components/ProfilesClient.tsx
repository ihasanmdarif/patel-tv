"use client";

import { useState } from "react";
import Link from "next/link";

type Profile = {
  id: string;
  name: string;
  portalUrl: string;
  macAddress: string;
  serialNumber: string | null;
  stbType: string | null;
  clientType: string | null;
  deviceId: string | null;
  deviceId2: string | null;
  signature: string | null;
  hwVersion: string | null;
  hwVersion2: string | null;
  prehash: string | null;
  imageVersion: string | null;
  apiSignature: string | null;
  timezone: string | null;
  notes: string | null;
};

type ProfileForm = {
  name: string;
  portalUrl: string;
  macAddress: string;
  serialNumber: string;
  notes: string;
  stbType: string;
  clientType: string;
  deviceId: string;
  deviceId2: string;
  signature: string;
  hwVersion: string;
  hwVersion2: string;
  prehash: string;
  imageVersion: string;
  apiSignature: string;
  timezone: string;
};

const EMPTY_FORM: ProfileForm = {
  name: "",
  portalUrl: "",
  macAddress: "",
  serialNumber: "",
  notes: "",
  stbType: "",
  clientType: "",
  deviceId: "",
  deviceId2: "",
  signature: "",
  hwVersion: "",
  hwVersion2: "",
  prehash: "",
  imageVersion: "",
  apiSignature: "",
  timezone: "",
};

// Accepts the STB_* .env block a provider hands out (see CLAUDE_CLOUDFLARE.MD) and maps
// it onto form fields, so device identity doesn't have to be typed in one input at a time.
const ENV_KEY_MAP: Record<string, keyof ProfileForm> = {
  PORTAL_BASE: "portalUrl",
  STB_MAC: "macAddress",
  STB_SN: "serialNumber",
  STB_TYPE: "stbType",
  STB_CLIENT_TYPE: "clientType",
  STB_DEVICE_ID: "deviceId",
  STB_DEVICE_ID2: "deviceId2",
  STB_SIGNATURE: "signature",
  STB_HW_VERSION: "hwVersion",
  STB_HW_VERSION_2: "hwVersion2",
  STB_PREHASH: "prehash",
  STB_IMAGE_VERSION: "imageVersion",
  STB_API_SIGNATURE: "apiSignature",
  STB_TIMEZONE: "timezone",
};

function parseEnvBlock(text: string): Partial<ProfileForm> {
  const result: Partial<ProfileForm> = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    const field = ENV_KEY_MAP[key];
    if (!field) continue;
    result[field] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
  return result;
}

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function IconTv(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M8 3l4 3 4-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBolt(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrash(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-.6 12.2A2 2 0 0 1 14.4 21H9.6a2 2 0 0 1-2-1.8L7 7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPlay(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}

function IconPencil(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19 3 20l1-4 12.5-12.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 animate-spin" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function DeviceIdentityFields({
  form,
  setForm,
}: {
  form: ProfileForm;
  setForm: (form: ProfileForm) => void;
}) {
  const [pasted, setPasted] = useState("");
  const inputClass =
    "rounded-lg border border-surface-border bg-transparent px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

  function field(label: string, key: keyof ProfileForm, placeholder?: string) {
    return (
      <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
        {label}
        <input
          placeholder={placeholder}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className={inputClass}
        />
      </label>
    );
  }

  return (
    <details className="group rounded-lg border border-surface-border">
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted transition group-open:text-foreground">
        Advanced device identity (optional — needed only if the provider rejects a plain
        MAC/serial as &quot;Device conflict&quot;)
      </summary>
      <div className="flex flex-col gap-3 border-t border-surface-border p-3">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
          Paste .env block from provider (STB_*, PORTAL_BASE) to fill fields below
          <textarea
            rows={3}
            placeholder="STB_DEVICE_ID=...&#10;STB_SIGNATURE=..."
            value={pasted}
            onChange={(e) => {
              setPasted(e.target.value);
              const parsed = parseEnvBlock(e.target.value);
              if (Object.keys(parsed).length > 0) setForm({ ...form, ...parsed });
            }}
            className={`${inputClass} font-mono text-xs`}
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {field("STB type", "stbType", "MAG250")}
          {field("Client type", "clientType", "STB")}
          {field("Device ID", "deviceId")}
          {field("Device ID 2", "deviceId2")}
          {field("Signature", "signature")}
          {field("HW version", "hwVersion")}
          {field("HW version 2", "hwVersion2")}
          {field("Prehash", "prehash")}
          {field("Image version", "imageVersion", "216")}
          {field("API signature", "apiSignature", "203")}
          {field("Timezone", "timezone", "America/Winnipeg")}
        </div>
      </div>
    </details>
  );
}

export default function ProfilesClient({
  initialProfiles,
}: {
  initialProfiles: Profile[];
}) {
  const [profiles, setProfiles] = useState(initialProfiles);
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, TestState>>({});

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ProfileForm>(EMPTY_FORM);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create profile");
      setProfiles((prev) => [data, ...prev]);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create profile");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/profiles/${id}`, { method: "DELETE" });
  }

  function startEdit(p: Profile) {
    setEditingId(p.id);
    setEditError(null);
    setEditForm({
      name: p.name,
      portalUrl: p.portalUrl,
      macAddress: p.macAddress,
      serialNumber: p.serialNumber ?? "",
      notes: p.notes ?? "",
      stbType: p.stbType ?? "",
      clientType: p.clientType ?? "",
      deviceId: p.deviceId ?? "",
      deviceId2: p.deviceId2 ?? "",
      signature: p.signature ?? "",
      hwVersion: p.hwVersion ?? "",
      hwVersion2: p.hwVersion2 ?? "",
      prehash: p.prehash ?? "",
      imageVersion: p.imageVersion ?? "",
      apiSignature: p.apiSignature ?? "",
      timezone: p.timezone ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function handleEditSubmit(e: React.FormEvent, id: string) {
    e.preventDefault();
    setEditSubmitting(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/profiles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update profile");
      setProfiles((prev) => prev.map((p) => (p.id === id ? data : p)));
      setTests((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleTest(id: string) {
    setTests((prev) => ({ ...prev, [id]: { status: "testing" } }));
    try {
      const res = await fetch(`/api/stalker/${id}/test`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Connection failed");
      setTests((prev) => ({
        ...prev,
        [id]: { status: "success", message: `Connected · ${data.genreCount} genres` },
      }));
    } catch (err) {
      setTests((prev) => ({
        ...prev,
        [id]: { status: "error", message: err instanceof Error ? err.message : "Connection failed" },
      }));
    }
  }

  return (
    <div className="mt-8 flex flex-col gap-8">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-2xl border border-surface-border bg-surface p-5 shadow-sm"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <IconTv className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-semibold">Add profile</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
            Name
            <input
              required
              placeholder="Living Room"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-lg border border-surface-border bg-transparent px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
            MAC address
            <input
              required
              placeholder="00:1A:79:XX:XX:XX"
              value={form.macAddress}
              onChange={(e) => setForm({ ...form, macAddress: e.target.value })}
              className="rounded-lg border border-surface-border bg-transparent px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted sm:col-span-2">
            Portal URL
            <input
              required
              placeholder="http://portal.example.com/c/"
              value={form.portalUrl}
              onChange={(e) => setForm({ ...form, portalUrl: e.target.value })}
              className="rounded-lg border border-surface-border bg-transparent px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
            Serial number (optional)
            <input
              placeholder="From STB System Info or box sticker"
              value={form.serialNumber}
              onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
              className="rounded-lg border border-surface-border bg-transparent px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
            Notes (optional)
            <input
              placeholder="Any notes about this subscription"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="rounded-lg border border-surface-border bg-transparent px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
        </div>
        <DeviceIdentityFields form={form} setForm={setForm} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover disabled:opacity-50"
        >
          {submitting ? "Adding..." : "Add profile"}
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {profiles.length === 0 && (
          <p className="rounded-2xl border border-dashed border-surface-border p-6 text-center text-sm text-muted">
            No profiles yet. Add one above.
          </p>
        )}
        {profiles.map((p) => {
          const test = tests[p.id] ?? { status: "idle" as const };

          if (editingId === p.id) {
            return (
              <form
                key={p.id}
                onSubmit={(e) => handleEditSubmit(e, p.id)}
                className="flex flex-col gap-3 rounded-2xl border border-accent/50 bg-surface p-4 shadow-sm"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
                    Name
                    <input
                      required
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="rounded-lg border border-surface-border bg-transparent px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
                    MAC address
                    <input
                      required
                      value={editForm.macAddress}
                      onChange={(e) => setEditForm({ ...editForm, macAddress: e.target.value })}
                      className="rounded-lg border border-surface-border bg-transparent px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-medium text-muted sm:col-span-2">
                    Portal URL
                    <input
                      required
                      value={editForm.portalUrl}
                      onChange={(e) => setEditForm({ ...editForm, portalUrl: e.target.value })}
                      className="rounded-lg border border-surface-border bg-transparent px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
                    Serial number (optional)
                    <input
                      placeholder="From STB System Info or box sticker"
                      value={editForm.serialNumber}
                      onChange={(e) => setEditForm({ ...editForm, serialNumber: e.target.value })}
                      className="rounded-lg border border-surface-border bg-transparent px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
                    Notes (optional)
                    <input
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      className="rounded-lg border border-surface-border bg-transparent px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </label>
                </div>
                <DeviceIdentityFields form={editForm} setForm={setEditForm} />
                {editError && <p className="text-sm text-danger">{editError}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={editSubmitting}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover disabled:opacity-50"
                  >
                    {editSubmitting ? "Saving..." : "Save changes"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="rounded-lg border border-surface-border px-4 py-2 text-sm font-medium transition hover:border-accent hover:text-accent"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            );
          }

          return (
            <div
              key={p.id}
              className="flex flex-col gap-3 rounded-2xl border border-surface-border bg-surface p-4 shadow-sm transition hover:border-accent/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <IconTv className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted">
                    {p.macAddress} &middot; {safeHost(p.portalUrl)}
                    {p.serialNumber && <> &middot; SN: {p.serialNumber}</>}
                  </p>
                  {test.status !== "idle" && (
                    <p
                      className={`mt-1 flex items-center gap-1 text-xs font-medium ${
                        test.status === "error"
                          ? "text-danger"
                          : test.status === "success"
                            ? "text-emerald-500"
                            : "text-muted"
                      }`}
                    >
                      {test.status === "testing" && <Spinner />}
                      {test.status === "testing" ? "Testing connection..." : test.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => handleTest(p.id)}
                  disabled={test.status === "testing"}
                  className="flex items-center gap-1.5 rounded-lg border border-surface-border px-3 py-1.5 text-sm font-medium transition hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  {test.status === "testing" ? <Spinner /> : <IconBolt className="h-3.5 w-3.5" />}
                  Test
                </button>
                <button
                  onClick={() => startEdit(p)}
                  aria-label="Edit profile"
                  className="flex items-center justify-center rounded-lg border border-surface-border p-2 text-muted transition hover:border-accent hover:text-accent"
                >
                  <IconPencil className="h-3.5 w-3.5" />
                </button>
                <Link
                  href={`/live/${p.id}`}
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover"
                >
                  <IconPlay className="h-3.5 w-3.5" />
                  Watch
                </Link>
                <button
                  onClick={() => handleDelete(p.id)}
                  aria-label="Delete profile"
                  className="flex items-center justify-center rounded-lg border border-surface-border p-2 text-muted transition hover:border-danger hover:text-danger"
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
