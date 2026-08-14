"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";

export type ProfileSummary = { id: string; name: string };

type ProfileContextValue = {
  profiles: ProfileSummary[];
  activeProfileId: string | null;
  setActiveProfile: (id: string) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({
  profiles,
  activeProfileId,
  children,
}: {
  profiles: ProfileSummary[];
  activeProfileId: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [active, setActive] = useState(activeProfileId);

  const setActiveProfile = useCallback(
    async (id: string) => {
      await fetch("/api/profiles/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: id }),
      });
      setActive(id);
      router.refresh();
    },
    [router]
  );

  return (
    <ProfileContext.Provider value={{ profiles, activeProfileId: active, setActiveProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfileContext(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfileContext must be used within a ProfileProvider");
  return ctx;
}
