"use client";

import Link from "next/link";

// Portal logo files are frequently missing/broken (dead links from the provider, not a
// fetch bug on our end) — hide the <img> on error so the letter tile underneath shows
// through instead of a broken-image icon.
function hideOnError(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = "none";
}

export type RailCard = {
  key: string;
  title: string;
  subtitle?: string;
  logo?: string | null;
  href: string;
  progressPct?: number; // 0-100, renders a progress bar overlay when present
};

export default function Rail({ title, cards }: { title: string; cards: RailCard[] }) {
  if (cards.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-xl font-semibold">{title}</h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {cards.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            className="group flex w-40 shrink-0 flex-col gap-2 transition hover:-translate-y-1"
          >
            <div
              className="relative aspect-[2/3] overflow-hidden bg-bg-tertiary"
              style={{ borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)" }}
            >
              <div className="flex h-full w-full items-center justify-center text-2xl text-muted">
                {card.title.slice(0, 1).toUpperCase()}
              </div>
              {card.logo && (
                // eslint-disable-next-line @next/next/no-img-element -- portal-hosted logos, arbitrary hosts
                <img
                  src={card.logo}
                  alt=""
                  onError={hideOnError}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              {card.progressPct != null && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
                  <div
                    className="h-full bg-accent"
                    style={{ width: `${Math.min(100, Math.max(0, card.progressPct))}%` }}
                  />
                </div>
              )}
            </div>
            <div>
              <p className="truncate text-sm font-medium">{card.title}</p>
              {card.subtitle && <p className="truncate text-xs text-muted">{card.subtitle}</p>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
