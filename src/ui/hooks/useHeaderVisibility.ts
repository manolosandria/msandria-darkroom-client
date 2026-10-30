import { useCallback, useSyncExternalStore } from "react";
import {
  readHeaderHidden,
  subscribeHeaderHidden,
  writeHeaderHidden,
} from "@/src/ui/headerPreference";

// Whether the visitor folded the site header away. Server and first client render both
// show it, so hydration matches; a remembered choice applies right after.
export function useHeaderVisibility() {
  const hidden = useSyncExternalStore(
    subscribeHeaderHidden,
    readHeaderHidden,
    () => false,
  );
  const setHidden = useCallback((next: boolean) => writeHeaderHidden(next), []);
  return [hidden, setHidden] as const;
}
