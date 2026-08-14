"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";
import { useProfileContext } from "./ProfileContext";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/live", label: "Live" },
  { href: "/guide", label: "Guide" },
  { href: "/movies", label: "Movies" },
  { href: "/series", label: "Series" },
  { href: "/settings", label: "Settings" },
];

function IconTv(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M8 3l4 3 4-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { profiles, activeProfileId, setActiveProfile } = useProfileContext();

  return (
    <nav
      className="sticky top-0 z-20 flex h-[60px] items-center justify-between border-b px-4 sm:px-6"
      style={{
        background: "var(--glass-bg)",
        borderColor: "var(--glass-border)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-accent">
          <IconTv className="h-6 w-6" />
          <span className="font-heading text-lg font-bold text-foreground">patel-tv</span>
        </div>
        <div className="hidden items-center gap-1 sm:flex">
          {NAV_LINKS.map((link) => {
            const isActive =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-[10px] px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-accent-dim text-accent"
                    : "text-muted hover:bg-bg-hover hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {profiles.length > 0 && (
          <select
            value={activeProfileId ?? ""}
            onChange={(e) => setActiveProfile(e.target.value)}
            className="rounded-[10px] border border-surface-border bg-bg-tertiary px-3 py-1.5 text-sm text-foreground outline-none transition focus:border-accent"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <LogoutButton />
      </div>
    </nav>
  );
}
