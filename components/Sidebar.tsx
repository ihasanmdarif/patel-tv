"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";
import { useProfileContext } from "./ProfileContext";

function IconHome(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M3 11l9-8 9 8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 10v10h14V10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTv(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M8 3l4 3 4-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconGuide(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconMovie(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 5v14M17 5v14M3 10h4M17 10h4M3 15h4M17 15h4" strokeLinecap="round" />
    </svg>
  );
}

function IconSeries(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3" y="7" width="15" height="14" rx="2" />
      <path d="M7 3h13a1 1 0 0 1 1 1v13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSettings(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const NAV_LINKS = [
  { href: "/", label: "Home", icon: IconHome },
  { href: "/live", label: "Live TV", icon: IconTv },
  { href: "/guide", label: "Guide", icon: IconGuide },
  { href: "/movies", label: "Movies", icon: IconMovie },
  { href: "/series", label: "Series", icon: IconSeries },
  { href: "/settings", label: "Settings", icon: IconSettings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { profiles, activeProfileId, setActiveProfile } = useProfileContext();

  return (
    <nav
      className="sticky top-0 flex h-screen w-16 shrink-0 flex-col items-center gap-1 border-r py-4 sm:w-56 sm:items-stretch sm:px-3"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--surface-border)" }}
    >
      <div className="mb-4 flex items-center gap-2 px-0 sm:px-2">
        <IconTv className="h-7 w-7 shrink-0 text-accent" />
        <span className="hidden font-heading text-lg font-bold text-foreground sm:inline">
          patel-tv
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1">
        {NAV_LINKS.map((link) => {
          const isActive =
            link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              title={link.label}
              className={`group relative flex items-center justify-center gap-3 rounded-[10px] px-0 py-2.5 text-sm font-medium transition sm:justify-start sm:px-3 ${
                isActive
                  ? "bg-accent-dim text-accent"
                  : "text-muted hover:bg-bg-hover hover:text-foreground"
              }`}
            >
              <span
                className={`absolute left-0 hidden h-6 w-1 rounded-r-full bg-accent transition sm:block ${
                  isActive ? "opacity-100" : "opacity-0"
                }`}
                style={{ transform: "translateX(-0.75rem)" }}
              />
              <Icon className="h-5 w-5 shrink-0" />
              <span className="hidden sm:inline">{link.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 px-0 pt-2 sm:px-1">
        {profiles.length > 0 && (
          <select
            value={activeProfileId ?? ""}
            onChange={(e) => setActiveProfile(e.target.value)}
            className="hidden w-full rounded-[10px] border border-surface-border bg-bg-tertiary px-2 py-1.5 text-xs text-foreground outline-none transition focus:border-accent sm:block"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <div className="flex justify-center sm:justify-stretch">
          <LogoutButton />
        </div>
      </div>
    </nav>
  );
}
