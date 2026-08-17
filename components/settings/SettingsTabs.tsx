"use client";

import { useRouter, useSearchParams } from "next/navigation";

const TAB_ORDER = ["sources", "player", "admin"] as const;
const TAB_LABEL: Record<(typeof TAB_ORDER)[number], string> = {
  sources: "Sources",
  player: "Player",
  admin: "Admin",
};

export default function SettingsTabs({
  sources,
  player,
  admin,
}: {
  sources?: React.ReactNode;
  player: React.ReactNode;
  admin?: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const available: Record<(typeof TAB_ORDER)[number], React.ReactNode> = { sources, player, admin };
  const tabs = TAB_ORDER.filter((id) => available[id]);

  const requested = searchParams.get("tab");
  const active =
    requested && tabs.includes(requested as (typeof TAB_ORDER)[number])
      ? (requested as (typeof TAB_ORDER)[number])
      : tabs[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 border-b border-surface-border">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => router.replace(`/settings?tab=${tab}`)}
            className={`px-4 py-2 text-sm font-medium transition ${
              active === tab
                ? "border-b-2 border-accent text-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            {TAB_LABEL[tab]}
          </button>
        ))}
      </div>
      {available[active]}
    </div>
  );
}
