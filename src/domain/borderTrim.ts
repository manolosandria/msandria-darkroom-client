import { Highlight, PhotoHighlights } from "./entities/PhotoHighlights";
import { cleanPresentation } from "./photoPresentation";

/**
 * The part of a photo kept when a border that came baked into the file is removed. Like
 * highlights, it is a fraction of the oriented image, so it means the same thing against
 * the file the API receives as against any preview drawn from it.
 */
export type BorderTrim = Highlight;

/** Pixels removed from each side of the original image. */
export type BorderInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

/** The API refuses a trim that keeps less than this of either side. */
export const MIN_TRIM_FRACTION = 0.1;

const FULL: BorderTrim = { x: 0, y: 0, width: 1, height: 1 };

/** How far a channel may stray from the border's colour (JPEG noise, paper texture). */
const TOLERANCE = 28;
/** Share of a line that must match: a signature or a speck in the border is allowed. */
const COVERAGE = 0.97;

/**
 * Finds a border of one even colour around the image, independently on each side, so a
 * letterbox (top and bottom only) is found as well as a full mat. `data` is RGBA, as a
 * canvas returns it. Returns null when there is no border, or when what is left would be
 * too small to be the photograph.
 */
export function detectBorder(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): BorderTrim | null {
  const pixel = (x: number, y: number) => {
    const offset = (y * width + x) * 4;
    return [data[offset], data[offset + 1], data[offset + 2]];
  };
  const average = (points: number[][]) =>
    [0, 1, 2].map(
      (channel) =>
        points.reduce((sum, point) => sum + point[channel], 0) / points.length,
    );
  const matches = (points: number[][], colour: number[]) =>
    points.filter((point) =>
      point.every((value, channel) => Math.abs(value - colour[channel]) <= TOLERANCE),
    ).length >=
    points.length * COVERAGE;
  // Walks inwards from one edge while every line matches the colour of the outermost one.
  const depth = (line: (index: number) => number[][], limit: number) => {
    const colour = average(line(0));
    let index = 0;
    while (index < limit && matches(line(index), colour)) index++;
    // The first line that failed straddles border and photograph after downsampling:
    // losing a hair of the photograph beats leaving a pale line along its edge.
    return index > 0 ? Math.min(index + 1, limit) : 0;
  };
  const range = (from: number, to: number) =>
    Array.from({ length: Math.max(0, to - from) }, (_, index) => from + index);
  const columns = range(0, width);
  const top = depth((y) => columns.map((x) => pixel(x, y)), Math.floor(height / 2));
  const bottom = depth(
    (y) => columns.map((x) => pixel(x, height - 1 - y)),
    Math.floor(height / 2),
  );
  // Sides are measured only between the borders already found, so the corners of a
  // mat with a different top colour do not stop them.
  const rows = range(top, height - bottom);
  if (!rows.length) return null;
  const left = depth((x) => rows.map((y) => pixel(x, y)), Math.floor(width / 2));
  const right = depth(
    (x) => rows.map((y) => pixel(width - 1 - x, y)),
    Math.floor(width / 2),
  );
  if (!top && !bottom && !left && !right) return null;
  return insetsToTrim({ top, right, bottom, left }, width, height);
}

/** Turns pixels removed per side into a trim, or null when it would keep too little. */
export function insetsToTrim(
  insets: BorderInsets,
  width: number,
  height: number,
): BorderTrim | null {
  const kept = {
    x: insets.left / width,
    y: insets.top / height,
    width: (width - insets.left - insets.right) / width,
    height: (height - insets.top - insets.bottom) / height,
  };
  return kept.width < MIN_TRIM_FRACTION || kept.height < MIN_TRIM_FRACTION
    ? null
    : kept;
}

/** The pixels a trim removes from each side of an image of that size. */
export function trimToInsets(
  trim: BorderTrim,
  width: number,
  height: number,
): BorderInsets {
  const left = Math.round(trim.x * width);
  const top = Math.round(trim.y * height);
  return {
    top,
    left,
    right: Math.max(0, width - left - Math.round(trim.width * width)),
    bottom: Math.max(0, height - top - Math.round(trim.height * height)),
  };
}

/** The size of what a trim keeps, in pixels. */
export function trimmedSize(
  trim: BorderTrim | null,
  width: number,
  height: number,
) {
  const kept = trim ?? FULL;
  return {
    width: Math.max(1, Math.round(kept.width * width)),
    height: Math.max(1, Math.round(kept.height * height)),
  };
}

/**
 * Highlights are fractions of the image they were drawn on. When the trim changes,
 * each crop keeps its pixels and is re-expressed against the new image; one that would
 * now fall outside it is dropped, together with the places that showed it.
 */
export function remapHighlights(
  highlights: PhotoHighlights,
  from: BorderTrim | null,
  to: BorderTrim | null,
): PhotoHighlights {
  const source = from ?? FULL;
  const target = to ?? FULL;
  const move = (crop: Highlight): Highlight | undefined => {
    const moved = {
      x: (source.x + crop.x * source.width - target.x) / target.width,
      y: (source.y + crop.y * source.height - target.y) / target.height,
      width: (crop.width * source.width) / target.width,
      height: (crop.height * source.height) / target.height,
    };
    const epsilon = 1e-6;
    if (
      moved.x < -epsilon ||
      moved.y < -epsilon ||
      moved.x + moved.width > 1 + epsilon ||
      moved.y + moved.height > 1 + epsilon
    )
      return undefined;
    return {
      x: Math.max(0, moved.x),
      y: Math.max(0, moved.y),
      width: Math.min(moved.width, 1 - Math.max(0, moved.x)),
      height: Math.min(moved.height, 1 - Math.max(0, moved.y)),
    };
  };
  const result: PhotoHighlights = {};
  for (const kind of ["square", "landscape", "portrait"] as const) {
    const crop = highlights[kind] && move(highlights[kind]);
    if (crop) result[kind] = crop;
  }
  if (highlights.custom) {
    result.custom = highlights.custom.flatMap((item) => {
      const crop = move(item.crop);
      return crop ? [{ ...item, crop }] : [];
    });
  }
  if (highlights.presentation) result.presentation = highlights.presentation;
  return cleanPresentation(result);
}
