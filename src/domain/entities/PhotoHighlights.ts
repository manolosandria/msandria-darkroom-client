export type HighlightKind = "square" | "landscape" | "portrait";
export type Highlight = { x: number; y: number; width: number; height: number };
export type CustomHighlight = { id: string; name: string; crop: Highlight };
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
