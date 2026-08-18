import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import PairClient from "@/components/PairClient";

export const dynamic = "force-dynamic";

export default async function PairPage({
  searchParams,
}: {
  searchParams: Promise<{ user_code?: string }>;
}) {
  const { user_code } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    const next = `/pair${user_code ? `?user_code=${encodeURIComponent(user_code)}` : ""}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  if (!user_code) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center p-6">
        <p className="text-sm text-muted">Missing pairing code — scan the QR code shown on your TV.</p>
      </div>
    );
  }

  return <PairClient userCode={user_code} />;
}
