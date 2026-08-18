"use client";

import { ElementType, ReactNode } from "react";
import { FocusContext, useFocusable } from "@noriginmedia/norigin-spatial-navigation";

type FocusableSectionProps = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  focusKey?: string;
  /** Key of the child to focus first when this section is entered without a remembered child. */
  preferredChildFocusKey?: string;
};

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
}: FocusableSectionProps) {
  const { ref, focusKey: resolvedFocusKey } = useFocusable({
    focusKey,
    preferredChildFocusKey,
    trackChildren: true,
    saveLastFocusedChild: true,
  });

  return (
    <As ref={ref} className={className}>
      <FocusContext.Provider value={resolvedFocusKey}>{children}</FocusContext.Provider>
    </As>
  );
}
