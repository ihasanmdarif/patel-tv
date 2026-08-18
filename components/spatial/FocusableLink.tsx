"use client";

import Link, { LinkProps } from "next/link";
import { AnchorHTMLAttributes, ReactNode } from "react";
import { useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { FOCUS_RING_CLASS } from "./focus-ring";

type FocusableLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps | "onClick"> & {
    children: ReactNode;
    focusKey?: string;
    focusClassName?: string;
    /** Scroll this element into view (nearest edge) when it gains spatial focus. Default true. */
    scrollIntoViewOnFocus?: boolean;
    onSpatialFocus?: () => void;
  };

export function FocusableLink({
  className = "",
  focusClassName = FOCUS_RING_CLASS,
  focusKey,
  scrollIntoViewOnFocus = true,
  onSpatialFocus,
  children,
  ...linkProps
}: FocusableLinkProps) {
  const { ref, focused } = useFocusable<object, HTMLAnchorElement>({
    focusKey,
    // Arrow keys are captured by the spatial-nav keydown listener with
    // preventDefault, so the browser's native "Enter activates the focused
    // link" behavior never fires — dispatch a real click ourselves instead.
    onEnterPress: () => ref.current?.click(),
    onFocus: () => {
      if (scrollIntoViewOnFocus) {
        ref.current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
      }
      onSpatialFocus?.();
    },
  });

  return (
    <Link
      ref={ref}
      className={`${className} outline-none${focused ? ` ${focusClassName}` : ""}`}
      {...linkProps}
    >
      {children}
    </Link>
  );
}
