import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a media query matches, following the window as it changes. The server, the
 * first render and a browser without `matchMedia` answer `fallback`.
 */
export function useMediaQuery(query: string, fallback = false) {
  const subscribe = useCallback(
    (listener: () => void) => {
      const list =
        typeof window !== "undefined" ? window.matchMedia?.(query) : undefined;
      list?.addEventListener?.("change", listener);
      return () => list?.removeEventListener?.("change", listener);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(query)?.matches ?? fallback,
    () => fallback,
  );
}
