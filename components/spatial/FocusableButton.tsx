"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";
import { useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { FOCUS_RING_CLASS } from "./focus-ring";

type FocusableButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  children: ReactNode;
  focusKey?: string;
  focusClassName?: string;
  /** Scroll this element into view (nearest edge) when it gains spatial focus. Default true. */
  scrollIntoViewOnFocus?: boolean;
  onSpatialFocus?: () => void;
  /** Fires on mouse click AND remote Enter-press, so callers only implement one handler. */
  onActivate?: () => void;
};

export function FocusableButton({
  className = "",
  focusClassName = FOCUS_RING_CLASS,
  focusKey,
  scrollIntoViewOnFocus = true,
  onSpatialFocus,
  onActivate,
  disabled,
  children,
  ...buttonProps
}: FocusableButtonProps) {
  const { ref, focused } = useFocusable<object, HTMLButtonElement>({
    focusKey,
    // Disabled elements are excluded from the spatial-nav tree (skipped by
    // arrow-key traversal) rather than merely styled, matching native <button disabled>.
    focusable: !disabled,
    onEnterPress: () => {
      if (!disabled) onActivate?.();
    },
    onFocus: () => {
      if (scrollIntoViewOnFocus) {
        ref.current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
      }
      onSpatialFocus?.();
    },
  });

  return (
    <button
      ref={ref}
      onClick={onActivate}
      disabled={disabled}
      className={`${className} outline-none${focused ? ` ${focusClassName}` : ""}`}
      {...buttonProps}
    >
      {children}
    </button>
  );
}
