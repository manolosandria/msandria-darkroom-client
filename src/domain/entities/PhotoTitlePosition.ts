// The corner of the viewer where a photo's title sits, chosen per photo so it does not
// get lost over a bright or busy part of the picture.
export type PhotoTitlePosition = "BOTTOM_LEFT" | "BOTTOM_RIGHT" | "TOP_LEFT" | "TOP_RIGHT";

export const PHOTO_TITLE_POSITIONS: readonly PhotoTitlePosition[] = [
  "BOTTOM_LEFT",
  "BOTTOM_RIGHT",
  "TOP_LEFT",
  "TOP_RIGHT",
];

export const DEFAULT_TITLE_POSITION: PhotoTitlePosition = "BOTTOM_LEFT";

// Where a photo's variant thumbnails sit in the viewer: any corner but the title's, or
// null to let them follow the title (see `automaticVariantCorner`).
export type PhotoVariantPosition = PhotoTitlePosition | null;

// Without a corner of their own, the variants take the other end of the title's edge,
// so the two never meet.
export const automaticVariantCorner = (
  title: PhotoTitlePosition,
): PhotoTitlePosition =>
  (
    {
      BOTTOM_LEFT: "BOTTOM_RIGHT",
      BOTTOM_RIGHT: "BOTTOM_LEFT",
      TOP_LEFT: "TOP_RIGHT",
      TOP_RIGHT: "TOP_LEFT",
    } as const
  )[title];
