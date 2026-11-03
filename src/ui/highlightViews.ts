import {
  Highlight,
  PhotoHighlights,
} from "@/src/domain/entities/PhotoHighlights";

export type HighlightView = { key: string; label: string; crop: Highlight };

// Every crop a photo has, main shapes first (in a fixed order), then the named ones.
export function highlightViews(highlights: PhotoHighlights): HighlightView[] {
  return [
    ...(["square", "landscape", "portrait"] as const)
      .filter((kind) => highlights[kind])
      .map((kind) => ({
        key: kind,
        label: kind[0].toUpperCase() + kind.slice(1),
        crop: highlights[kind]!,
      })),
    ...(highlights.custom ?? []).map((item) => ({
      key: `custom:${item.id}`,
      label: item.name,
      crop: item.crop,
    })),
  ];
}

// The three main shapes a photo still lacks: what the thumbnails would have to guess.
export function missingHighlights(highlights: PhotoHighlights) {
  return (["square", "landscape", "portrait"] as const).filter(
    (kind) => !highlights[kind],
  );
}
