// What changed between a saved document and its draft, field by field, so a curator can
// review the changes before saving and keep or drop each one. Objects are followed a few
// levels down; lists and anything deeper count as one change.

export type Change = {
  /** The keys from the document's root to the changed value. */
  path: string[];
  label: string;
  before: unknown;
  after: unknown;
};

const MAX_DEPTH = 3;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// "frameColor" → "Frame color"; a list index reads as its position.
function words(key: string) {
  if (/^\d+$/.test(key)) return `#${Number(key) + 1}`;
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export const changeLabel = (path: string[]) =>
  path.length ? path.map(words).join(" › ") : "Everything";

export function diffChanges(
  original: unknown,
  draft: unknown,
  path: string[] = [],
): Change[] {
  if (same(original, draft)) return [];
  if (
    path.length < MAX_DEPTH &&
    isPlainObject(original) &&
    isPlainObject(draft)
  ) {
    const keys = [...new Set([...Object.keys(original), ...Object.keys(draft)])];
    return keys.flatMap((key) =>
      diffChanges(original[key], draft[key], [...path, key]),
    );
  }
  return [{ path, label: changeLabel(path), before: original, after: draft }];
}

/** The draft with the value at `path` put back as the original had it. */
export function revertChange(
  draft: unknown,
  original: unknown,
  path: string[],
): unknown {
  if (!path.length) return original;
  const [key, ...rest] = path;
  const from = isPlainObject(draft) ? draft : {};
  const back = isPlainObject(original) ? original : {};
  const next: Record<string, unknown> = { ...from };
  if (!rest.length && !(key in back)) {
    delete next[key];
    return next;
  }
  next[key] = revertChange(from[key], back[key], rest);
  return next;
}

/** A short, readable form of a value for the review. */
export function previewValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (typeof value === "number") return String(Math.round(value * 1000) / 1000);
  if (typeof value === "string")
    return value.length > 48 ? `${value.slice(0, 47)}…` : value;
  if (Array.isArray(value))
    return value.length === 1 ? "1 item" : `${value.length} items`;
  const keys = isPlainObject(value) ? Object.keys(value).length : 0;
  return keys === 1 ? "1 setting" : `${keys} settings`;
}

/** Whether a value looks like a colour, to show a swatch beside it. */
export const isColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value);
