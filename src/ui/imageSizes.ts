// Helpers for the `sizes` attribute that browsers without `sizes="auto"` (Safari and
// Firefox today) rely on: the closer it is to the width the image really takes, the
// closer the rendition they pick is to the one Chrome picks from the laid-out width.

// Splits a list on its top-level commas, leaving those inside min(), calc()… alone.
function topLevel(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    const char = list[i];
    if (char === "(") depth++;
    else if (char === ")") depth--;
    else if (char === "," && depth === 0) {
      parts.push(list.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(list.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

/**
 * The same `sizes`, every length multiplied by `factor`. A cropped photo is drawn
 * larger than the box that shows it (by `1 / crop.width`), so its sizes must grow by as
 * much or the browser picks a rendition too small for what is on screen.
 */
export function scaleSizes(sizes: string, factor: number): string {
  if (!Number.isFinite(factor) || Math.abs(factor - 1) < 0.01) return sizes;
  const times = Math.round(factor * 1000) / 1000;
  return topLevel(sizes)
    .map((entry) => {
      if (entry.startsWith("(")) {
        let depth = 0;
        let end = 0;
        for (; end < entry.length; end++) {
          if (entry[end] === "(") depth++;
          else if (entry[end] === ")" && --depth === 0) break;
        }
        const condition = entry.slice(0, end + 1);
        const length = entry.slice(end + 1).trim();
        return `${condition} calc(${length} * ${times})`;
      }
      return `calc(${entry} * ${times})`;
    })
    .join(", ");
}

const percent = (share: number) =>
  `${Math.max(1, Math.round(Math.min(1, share) * 1000) / 10)}vw`;

/**
 * Sizes for a piece that takes a share of the page's width: `phone` below the
 * breakpoint and `wide` above it, both as fractions of the width (0–1).
 */
export function shareSizes(phone: number, wide: number, breakpoint: number) {
  return `(max-width: ${breakpoint}px) ${percent(phone)}, ${percent(wide)}`;
}
