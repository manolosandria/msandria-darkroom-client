import { useSyncExternalStore } from "react";

// Where the header trades its links for the page menu (navigation.css). Wider than
// this, the header and Curator's tabs can be folded; narrower, they are always compact.
export const WIDE_SCREEN = "(min-width: 1101px)";

const query = () =>
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia(WIDE_SCREEN)
    : null;

function subscribe(listener: () => void) {
  const list = query();
  list?.addEventListener?.("change", listener);
  return () => list?.removeEventListener?.("change", listener);
}

/**
 * Whether the window is wide enough for the header's links and Curator's row of tabs.
 * The server and a browser without `matchMedia` count as wide, which is what the first
 * render shows; a narrow window corrects it right after.
 */
export function useWideScreen() {
  return useSyncExternalStore(
    subscribe,
    () => query()?.matches ?? true,
    () => true,
  );
}
