"use client";

import { ElementType, ReactNode, Ref } from "react";
import { FocusContext, useFocusable } from "@noriginmedia/norigin-spatial-navigation";

type FocusableSectionProps = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  focusKey?: string;
  /** Key of the child to focus first when this section is entered without a remembered child. */
  preferredChildFocusKey?: string;
  /** Extra ref onto the rendered element, alongside the internal spatial-nav ref (e.g. for scroll tracking). */
  containerRef?: Ref<HTMLElement>;
};

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (node: T | null) => {
    for (const r of refs) {
      if (!r) continue;
      if (typeof r === "function") r(node);
      else (r as { current: T | null }).current = node;
    }
  };
}

/**
 * Groups a subtree of Focusable{Link,Button} elements into their own spatial-nav
 * branch (a row, a grid, a sidebar) so arrow-key navigation stays within the
 * section until it reaches an edge, and remembers the last-focused child on re-entry.
 */
export function FocusableSection({
  children,
  className,
  as: As = "div",
  focusKey,
  preferredChildFocusKey,
  containerRef,
}: FocusableSectionProps) {
  const { ref, focusKey: resolvedFocusKey } = useFocusable({
    focusKey,
    preferredChildFocusKey,
    trackChildren: true,
    saveLastFocusedChild: true,
  });

  return (
    <As ref={mergeRefs(ref, containerRef)} className={className}>
      <FocusContext.Provider value={resolvedFocusKey}>{children}</FocusContext.Provider>
    </As>
  );
}
