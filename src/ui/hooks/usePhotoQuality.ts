import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_PHOTO_QUALITY,
  PhotoQuality,
} from "@/src/domain/entities/PhotoQuality";
import {
  readQuality,
  subscribeQuality,
  writeQuality,
} from "@/src/ui/qualityPreference";

// The visitor's remembered quality. Server and first client render both start from the
// default, so hydration matches; the stored choice applies right after.
export function usePhotoQuality() {
  const quality = useSyncExternalStore(
    subscribeQuality,
    readQuality,
    () => DEFAULT_PHOTO_QUALITY,
  );
  const setQuality = useCallback((next: PhotoQuality) => writeQuality(next), []);
  return [quality, setQuality] as const;
}
