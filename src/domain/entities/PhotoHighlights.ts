export type HighlightKind = "square" | "landscape" | "portrait";
export type Highlight = { x: number; y: number; width: number; height: number };
/** A named crop. With `shape` it keeps that proportion (a second square, another
 *  portrait…); without it, it is free. */
export type CustomHighlight = {
  id: string;
  name: string;
  crop: Highlight;
  shape?: HighlightKind;
};
export type GalleryViewRule = {
  layout: string;
  aspect: string;
  views: string[];
};
export type PhotoHighlights = Partial<Record<HighlightKind, Highlight>> & {
  custom?: CustomHighlight[];
  presentation?: {
    gallery: string[];
    home: string[];
    galleryRules?: GalleryViewRule[];
  };
};
export const MAX_CUSTOM_HIGHLIGHTS = 20;
export const HIGHLIGHT_RATIOS: Record<HighlightKind, number> = {
  square: 1,
  landscape: 3 / 2,
  portrait: 2 / 3,
};

export function centeredHighlight(
  kind: HighlightKind,
  imageRatio: number,
  size = 0.8,
): Highlight {
  const relativeRatio = HIGHLIGHT_RATIOS[kind] / imageRatio;
  const width = Math.min(1, relativeRatio) * size;
  const height = Math.min(1, 1 / relativeRatio) * size;
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
}

/** The rectangle of `kind`'s proportion with about the same area as `crop`, centred
 *  where it was and kept inside the photo: a drawing that changes shape stays put. */
export function refitHighlight(
  crop: Highlight,
  kind: HighlightKind,
  imageRatio: number,
): Highlight {
  const relative = HIGHLIGHT_RATIOS[kind] / imageRatio;
  let width = Math.sqrt(crop.width * crop.height * relative);
  let height = width / relative;
  const fit = Math.max(width, height, 1);
  width /= fit;
  height /= fit;
  const clamp = (n: number, max: number) => Math.max(0, Math.min(max, n));
  return {
    x: clamp(crop.x + crop.width / 2 - width / 2, 1 - width),
    y: clamp(crop.y + crop.height / 2 - height / 2, 1 - height),
    width,
    height,
  };
}
