// How much of a photo's detail a visitor asks for. A small, fixed set keeps the same
// few renditions in the browser and CDN caches instead of one per screen size.
export type PhotoQuality = "saver" | "standard" | "max";

export const PHOTO_QUALITIES: readonly PhotoQuality[] = ["saver", "standard", "max"];

export const DEFAULT_PHOTO_QUALITY: PhotoQuality = "standard";

// The widest rendition each level may use, in pixels. `max` has no cap.
export const PHOTO_QUALITY_WIDTH: Record<PhotoQuality, number> = {
  saver: 960,
  standard: 1920,
  max: Number.POSITIVE_INFINITY,
};

export function isPhotoQuality(value: unknown): value is PhotoQuality {
  return PHOTO_QUALITIES.includes(value as PhotoQuality);
}
