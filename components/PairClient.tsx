"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

type Phase = "loading" | "confirming" | "approved" | "denied" | "error";

export default function PairClient({ userCode }: { userCode: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    authClient.device({ query: { user_code: userCode } }).then(({ data, error }) => {
      if (error || !data) {
        setPhase("error");
        setErrorMessage(error?.error_description ?? "This code isn't valid.");
        return;
      }
      if (data.status === "approved") setPhase("approved");
      else if (data.status === "denied") setPhase("denied");
      else setPhase("confirming");
    });
  }, [userCode]);

  async function respond(action: "approve" | "deny") {
    setSubmitting(true);
    const { error } =
      action === "approve"
        ? await authClient.device.approve({ userCode })
        : await authClient.device.deny({ userCode });
    setSubmitting(false);
    if (error) {
      setPhase("error");
      setErrorMessage(error.error_description ?? "Something went wrong.");
      return;
    }
    setPhase(action === "approve" ? "approved" : "denied");
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-surface-border bg-surface p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold">patel-tv</h1>

        {phase === "loading" && <p className="text-sm text-muted">Checking code...</p>}

        {phase === "confirming" && (
          <>
            <p className="text-sm text-foreground">Confirm sign-in on your TV?</p>
            <div className="flex w-full gap-3">
              <button
                onClick={() => respond("deny")}
                disabled={submitting}
                className="flex-1 rounded-lg border border-surface-border px-4 py-2 text-sm font-medium text-muted transition hover:border-danger hover:text-danger disabled:opacity-50"
              >
                Deny
              </button>
              <button
                onClick={() => respond("approve")}
                disabled={submitting}
                className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover disabled:opacity-50"
              >
                Approve
              </button>
            </div>
          </>
        )}

        {phase === "approved" && (
          <p className="text-sm text-success">Signed in — you can close this tab.</p>
        )}
        {phase === "denied" && <p className="text-sm text-muted">Sign-in denied.</p>}
        {phase === "error" && (
          <p className="text-sm text-danger">{errorMessage ?? "Something went wrong."}</p>
        )}
      </div>
    </div>
  );
}
