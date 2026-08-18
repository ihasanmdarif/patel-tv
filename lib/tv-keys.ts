// Physical "Back"/"Return" remote buttons don't send a consistent key across TV
// browsers. Tizen fires a non-standard keyCode; webOS's varies by model/year and
// isn't fully documented, so it needs verifying against real hardware before relying
// on it in production. Escape covers desktop-Chrome testing and any TV that maps its
// back button to it.
const BACK_KEY_CODES = new Set([10009, 461, 27]);
const BACK_KEYS = new Set(["Escape", "GoBack", "BrowserBack"]);

export function isBackKey(event: KeyboardEvent): boolean {
  return BACK_KEY_CODES.has(event.keyCode) || BACK_KEYS.has(event.key);
}
