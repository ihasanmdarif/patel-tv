"use client";

import { useRouter, useSearchParams } from "next/navigation";

const TABS = [
  { id: "sources", label: "Sources" },
  { id: "player", label: "Player" },
] as const;

export default function SettingsTabs({
  sources,
  player,
}: {
  sources: React.ReactNode;
  player: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get("tab") === "player" ? "player" : "sources";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 border-b border-surface-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => router.replace(`/settings?tab=${tab.id}`)}
            className={`px-4 py-2 text-sm font-medium transition ${
              active === tab.id
                ? "border-b-2 border-accent text-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {active === "sources" ? sources : player}
    </div>
  );
}
