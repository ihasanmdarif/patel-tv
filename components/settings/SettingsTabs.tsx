"use client";

import { useRouter, useSearchParams } from "next/navigation";

const TABS = [
  { id: "sources", label: "Sources" },
  { id: "player", label: "Player" },
  { id: "users", label: "Users" },
] as const;

export default function SettingsTabs({
  sources,
  player,
  users,
}: {
  sources: React.ReactNode;
  player: React.ReactNode;
  users?: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams.get("tab");
  const active = requested === "player" ? "player" : requested === "users" && users ? "users" : "sources";
  const tabs = users ? TABS : TABS.filter((t) => t.id !== "users");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 border-b border-surface-border">
        {tabs.map((tab) => (
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
      {active === "sources" && sources}
      {active === "player" && player}
      {active === "users" && users}
    </div>
  );
}
