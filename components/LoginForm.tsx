"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { FocusableLink } from "@/components/spatial/FocusableLink";
import { useNativeFieldKeys } from "@/components/spatial/useNativeFieldKeys";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const nativeFieldProps = useNativeFieldKeys();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await authClient.signIn.email({ email, password });
    if (signInError) {
      setError(signInError.message ?? "Login failed");
      setSubmitting(false);
      return;
    }
    // Hard navigation, not router.push() — see app/tv-login/page.tsx for why.
    window.location.href = searchParams.get("next") || "/";
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-surface-border bg-surface p-6 shadow-sm"
    >
      <h1 className="text-lg font-semibold">patel-tv</h1>
      <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
        Email
        <input
          required
          autoFocus
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-surface-border bg-transparent px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
          {...nativeFieldProps}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
        Password
        <input
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-surface-border bg-transparent px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
          {...nativeFieldProps}
        />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover disabled:opacity-50"
      >
        {submitting ? "Signing in..." : "Sign in"}
      </button>
      <FocusableLink
        href="/tv-login"
        className="rounded-lg border border-surface-border px-4 py-2 text-center text-sm font-medium text-muted transition hover:border-accent hover:text-foreground"
      >
        Sign in with your phone instead
      </FocusableLink>
    </form>
  );
}
