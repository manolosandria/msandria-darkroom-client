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

/**
 * The level a screen needs when the visitor has chosen none: the photo fills about the
 * window's width, so a phone (390 px at 3×, counted at 2× at most) gets Data saver, a
 * laptop or an HD monitor Standard, and only a wider or denser screen Maximum.
 */
export function qualityForScreen(
  cssWidth: number,
  pixelRatio: number,
): PhotoQuality {
  const needed = cssWidth * Math.min(Math.max(pixelRatio, 1), 2);
  if (!(needed > 0)) return DEFAULT_PHOTO_QUALITY;
  return needed <= PHOTO_QUALITY_WIDTH.saver
    ? "saver"
    : needed <= PHOTO_QUALITY_WIDTH.standard
      ? "standard"
      : "max";
}
