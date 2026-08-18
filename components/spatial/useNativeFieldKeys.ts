import type { KeyboardEvent } from "react";

/**
 * Spread onto any native form control (select, text input) that needs real
 * arrow-key/Enter behavior (moving through options, moving the text cursor,
 * submitting a form). Spatial nav's adapter listens on `window` in the bubble
 * phase and calls preventDefault on every arrow/Enter keydown whenever the
 * key matches its keymap — regardless of what's focused, and regardless of
 * SpatialNavigation.pause() (pause only skips the navigation logic, not that
 * preventDefault call). Stopping propagation in the capture phase, on the
 * field itself, keeps the event from ever reaching that window listener, so
 * the browser's native handling runs untouched.
 */
export function useNativeFieldKeys() {
  return {
    onKeyDownCapture: (e: KeyboardEvent) => e.stopPropagation(),
  };
}
