"use client";

import { useRouter } from "next/navigation";

function IconLogout(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      title="Log out"
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-surface-border px-3 py-1.5 text-sm font-medium text-muted transition hover:border-accent hover:text-accent sm:justify-start"
    >
      <IconLogout className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">Log out</span>
    </button>
  );
}
