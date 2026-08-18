"use client";

import { FocusableLink } from "@/components/spatial/FocusableLink";
import { FocusableButton } from "@/components/spatial/FocusableButton";

export default function MovieCard({
  title,
  subtitle,
  href,
  favorited,
  onToggleFavorite,
}: {
  title: string;
  subtitle?: string | null;
  href: string;
  favorited: boolean;
  onToggleFavorite: () => void;
}) {
  return (
    <div className="group relative w-40 shrink-0">
      <FocusableLink href={href} className="flex flex-col gap-2 transition hover:-translate-y-1">
        <div
          className="relative aspect-[2/3] overflow-hidden bg-bg-tertiary"
          style={{ borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)" }}
        >
          <div className="flex h-full w-full items-center justify-center text-2xl text-muted">
            {title.slice(0, 1).toUpperCase()}
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100 group-focus-within:bg-black/30 group-focus-within:opacity-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-black">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M8 5.5v13l11-6.5-11-6.5Z" />
              </svg>
            </div>
          </div>
        </div>
        <div>
          <p className="truncate text-sm font-medium">{title}</p>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
      </FocusableLink>
      <FocusableButton
        onActivate={onToggleFavorite}
        aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
        scrollIntoViewOnFocus={false}
        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
      >
        <svg
          viewBox="0 0 24 24"
          fill={favorited ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-4 w-4"
        >
          <path d="M12 20.5s-7-4.35-9.5-8.6C.7 8.2 2.4 4.5 6 4.5c2 0 3.5 1.1 6 3.5 2.5-2.4 4-3.5 6-3.5 3.6 0 5.3 3.7 3.5 7.4C19 16.15 12 20.5 12 20.5Z" />
        </svg>
      </FocusableButton>
    </div>
  );
}
