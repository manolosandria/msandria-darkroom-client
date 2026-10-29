// The order the visitor was browsing when they opened a photo, so the viewer's arrows
// follow Gallery's shuffled page or a collection's own order instead of the archive's
// chronology. Each entry is one tile: the photo it showed first, then its variants.
// Kept for the tab only; without it the viewer falls back to the API's neighbours.

const KEY = "viewerSequence";

export type ViewerSequence = string[][];

export function rememberViewerSequence(sequence: ViewerSequence) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(sequence));
  } catch {
    // Storage can be blocked; the viewer then uses the chronological neighbours.
  }
}

function storedSequence(): ViewerSequence {
  try {
    const value: unknown = JSON.parse(
      window.sessionStorage.getItem(KEY) ?? "[]",
    );
    return Array.isArray(value)
      ? value.filter(
          (entry): entry is string[] =>
            Array.isArray(entry) &&
            entry.length > 0 &&
            entry.every((id) => typeof id === "string"),
        )
      : [];
  } catch {
    return [];
  }
}

// The photos shown before and after the tile holding `photoId`, or null when the photo
// was not opened from a remembered sequence.
export function sequenceNeighbors(
  photoId: string,
): { previousId: string | null; nextId: string | null } | null {
  const sequence = storedSequence();
  const index = sequence.findIndex((tile) => tile.includes(photoId));
  if (index < 0) return null;
  return {
    previousId: sequence[index - 1]?.[0] ?? null,
    nextId: sequence[index + 1]?.[0] ?? null,
  };
}

type SequenceTile = {
  photo: { getId(): string };
  variants: { getId(): string }[];
};

// One entry per tile, the photo it shows first. Records the order when a click lands on
// a link into the viewer, so a sequence from an older page never outlives its use.
export function rememberTilesOnViewerClick(
  target: EventTarget,
  tiles: SequenceTile[],
  shown: (tile: SequenceTile, index: number) => string = (tile) =>
    tile.photo.getId(),
) {
  if (!(target instanceof Element) || !target.closest('a[href^="/photo/"]'))
    return;
  rememberViewerSequence(
    tiles.map((tile, index) => {
      const first = shown(tile, index);
      return [
        first,
        ...tile.variants
          .map((variant) => variant.getId())
          .filter((id) => id !== first),
      ];
    }),
  );
}
