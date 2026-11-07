import { Highlight } from "@/src/domain/entities/PhotoHighlights";

/**
 * The part of a photograph a banner of `boxRatio` (width / height) shows when `focus`
 * must stay whole: as much of the photo around it as the banner needs, centred on it,
 * and never past the photo's edges. Only when the photo has nothing left around the
 * focus is the banner filled by cutting into it, from its centre. A banner of the
 * focus's own proportion shows exactly the focus.
 *
 * `homeCarousel.css` draws the same window with container units; this is its twin for
 * measuring and testing. All values are fractions of the oriented photo.
 */
export function bannerWindow(
  imageRatio: number,
  focus: Highlight,
  boxRatio: number,
): Highlight {
  // Widths in photo widths; heights converted with the two proportions.
  const width = Math.min(
    Math.max(focus.width, (boxRatio * focus.height) / imageRatio),
    Math.min(1, boxRatio / imageRatio),
  );
  const height = (width * imageRatio) / boxRatio;
  const clamp = (n: number, max: number) => Math.max(0, Math.min(max, n));
  return {
    x: clamp(focus.x + focus.width / 2 - width / 2, 1 - width),
    y: clamp(focus.y + focus.height / 2 - height / 2, 1 - height),
    width,
    height,
  };
}
