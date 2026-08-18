"use client";

import { useEffect, useState } from "react";
import { init, destroy } from "@noriginmedia/norigin-spatial-navigation";

export function SpatialNavProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // React commits child effects before parent effects on mount, so if children
    // rendered immediately, their useFocusable() registration effects would run
    // (and touch the library's layoutAdapter) before init() below ever executes —
    // that's the "Cannot read properties of undefined (reading 'measureLayout')"
    // crash. Gating children behind this ready flag defers their mount to a second
    // pass, after init() has already completed. The setState is deferred to a
    // macrotask so it isn't called synchronously within the effect body itself.
    init({ shouldFocusDOMNode: true });
    const timer = setTimeout(() => setReady(true), 0);
    return () => {
      clearTimeout(timer);
      destroy();
    };
  }, []);

  if (!ready) return null;
  return children;
}
