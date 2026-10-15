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
