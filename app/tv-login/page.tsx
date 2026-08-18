"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { authClient } from "@/lib/auth-client";
import { FocusableButton } from "@/components/spatial/FocusableButton";
import { SpatialNavProvider } from "@/components/spatial/SpatialNavProvider";

const CLIENT_ID = "patel-tv";

type Status = "requesting" | "polling" | "success" | "denied" | "expired" | "error";

function formatUserCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export default function TvLoginPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("requesting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [verificationUri, setVerificationUri] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Plain (non-memoized) function declarations, not useCallback: schedulePoll
  // recurses on itself, which needs the hoisted-declaration semantics of `function`
  // (a `const` arrow assigned via useCallback can't reference itself before the
  // assignment completes).
  function schedulePoll(deviceCode: string, intervalSec: number) {
    pollTimer.current = setTimeout(async () => {
      const { data, error } = await authClient.device.token({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: deviceCode,
        client_id: CLIENT_ID,
      });
      if (data) {
        setStatus("success");
        router.push("/");
        router.refresh();
        return;
      }
      switch (error?.error) {
        case "authorization_pending":
          schedulePoll(deviceCode, intervalSec);
          return;
        case "slow_down":
          // RFC 8628 §3.5 — back off when told we're polling too fast.
          schedulePoll(deviceCode, intervalSec + 5);
          return;
        case "expired_token":
          setStatus("expired");
          return;
        case "access_denied":
          setStatus("denied");
          return;
        default:
          setStatus("error");
          setErrorMessage(error?.error_description ?? "Something went wrong.");
      }
    }, intervalSec * 1000);
  }

  async function requestCode() {
    setStatus("requesting");
    setErrorMessage(null);
    setUserCode(null);
    setVerificationUri(null);
    const { data, error } = await authClient.device.code({ client_id: CLIENT_ID });
    if (error || !data) {
      setStatus("error");
      setErrorMessage(error?.error_description ?? "Failed to request a pairing code.");
      return;
    }
    setUserCode(data.user_code);
    setVerificationUri(data.verification_uri_complete);
    setStatus("polling");
    schedulePoll(data.device_code, data.interval);
  }

  useEffect(() => {
    // Deferred to a macrotask so requestCode's setState calls aren't made
    // synchronously within the effect body itself.
    const kickoff = setTimeout(() => requestCode(), 0);
    return () => {
      clearTimeout(kickoff);
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount; "Get new code" re-triggers explicitly
  }, []);

  const needsNewCode = status === "expired" || status === "denied" || status === "error";

  return (
    <SpatialNavProvider>
      <div className="flex min-h-full flex-1 items-center justify-center p-6">
        <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border border-surface-border bg-surface p-8 text-center shadow-sm">
          <h1 className="font-heading text-xl font-semibold">Sign in on your phone</h1>

          {status === "requesting" && <p className="text-sm text-muted">Requesting a pairing code...</p>}

          {(status === "polling" || status === "success") && userCode && (
            <>
              <p className="text-sm text-muted">
                Scan the code, or visit the link below and enter this code:
              </p>
              <div className="rounded-xl bg-white p-4">
                <QRCodeSVG value={verificationUri ?? ""} size={180} />
              </div>
              <p className="font-heading text-4xl font-bold tracking-widest text-accent">
                {formatUserCode(userCode)}
              </p>
              <p className="text-sm text-muted">
                {status === "success" ? "Signed in — redirecting..." : "Waiting for approval..."}
              </p>
            </>
          )}

          {status === "denied" && (
            <p className="text-sm text-danger">Sign-in was denied on the other device.</p>
          )}
          {status === "expired" && <p className="text-sm text-danger">This code expired.</p>}
          {status === "error" && (
            <p className="text-sm text-danger">{errorMessage ?? "Something went wrong."}</p>
          )}

          {needsNewCode && (
            <FocusableButton
              onActivate={requestCode}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover"
            >
              Get new code
            </FocusableButton>
          )}
        </div>
      </div>
    </SpatialNavProvider>
  );
}
