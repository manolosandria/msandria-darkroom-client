import {
  CollectionEntry,
  CollectionText,
  MosaicSize,
} from "./entities/Catalog";

/** Wide screens lay a collection out on eight columns, phones on four. */
export const MOSAIC_COLUMNS = 8;
export const MOBILE_MOSAIC_COLUMNS = 4;
export const MOSAIC_MAX_ROWS = 8;
export const DEFAULT_PHOTO_SIZE = { columns: 2, rows: 2 } as const;
export const DEFAULT_TEXT_SIZE = { columns: 4, rows: 1 } as const;

export type MosaicLayout = "desktop" | "mobile";

const clamp = (value: number, max: number) =>
  Math.min(max, Math.max(1, Math.round(value)));

/**
 * The phone size of a piece: its own when the curator set one, otherwise the wide
 * size narrowed to four columns with its proportion kept, so a 2×2 photo stays 2×2
 * (half the phone's width) and an 8×4 one becomes 4×2.
 */
export function mobileSpan(size: MosaicSize) {
  if (size.mobileColumns && size.mobileRows)
    return {
      columns: clamp(size.mobileColumns, MOBILE_MOSAIC_COLUMNS),
      rows: clamp(size.mobileRows, MOSAIC_MAX_ROWS),
      custom: true,
    };
  const columns = clamp(size.columns, MOBILE_MOSAIC_COLUMNS);
  return {
    columns,
    rows: clamp((size.rows * columns) / size.columns, MOSAIC_MAX_ROWS),
    custom: false,
  };
}

/** The span a piece takes in one layout. */
export function spanIn(size: MosaicSize, layout: MosaicLayout) {
  return layout === "mobile"
    ? mobileSpan(size)
    : {
        columns: clamp(size.columns, MOSAIC_COLUMNS),
        rows: clamp(size.rows, MOSAIC_MAX_ROWS),
        custom: true,
      };
}

/** The custom properties the mosaic's stylesheet reads for both layouts. */
export function spanStyle(size: MosaicSize): Record<string, number> {
  const wide = spanIn(size, "desktop");
  const phone = mobileSpan(size);
  return {
    "--span-columns": wide.columns,
    "--span-rows": wide.rows,
    "--span-mobile-columns": phone.columns,
    "--span-mobile-rows": phone.rows,
  };
}

export type PhotoBlock = CollectionEntry & { kind: "photo"; key: string };
export type TextBlock = Omit<CollectionText, "position"> & {
  kind: "text";
  key: string;
};
export type CollectionBlock = PhotoBlock | TextBlock;
/** A change to any block's fields; its kind and key never change. */
export type BlockPatch = Partial<
  Omit<PhotoBlock, "kind" | "key"> & Omit<TextBlock, "kind" | "key">
>;

let textKeys = 0;
/** A key for a text block, which has no id of its own until it is saved. */
export const newTextKey = () => `text:${++textKeys}`;

/**
 * Photos and text blocks in the order a visitor reads them. A text's `position`
 * counts the photos before it; the API may leave gaps in photo positions (hidden
 * photos are not sent), so a text goes before the first photo at or past it.
 */
export function mergeBlocks(
  entries: CollectionEntry[],
  texts: CollectionText[] = [],
): CollectionBlock[] {
  const queue = [...texts].sort((a, b) => a.position - b.position);
  const blocks: CollectionBlock[] = [];
  const takeTexts = (until: number) => {
    while (queue.length && queue[0].position <= until) {
      const { text, style, align, columns, rows, mobileColumns, mobileRows } =
        queue.shift()!;
      blocks.push({
        kind: "text",
        key: newTextKey(),
        text,
        style,
        align,
        columns,
        rows,
        mobileColumns,
        mobileRows,
      });
    }
  };
  entries.forEach((entry, index) => {
    takeTexts(entry.position ?? index);
    blocks.push({ ...entry, kind: "photo", key: `photo:${entry.photoId}` });
  });
  takeTexts(Infinity);
  return blocks;
}

/**
 * The composition the API stores: photos in order, and each text anchored by the
 * number of kept photos before it. Photos in `excluded` are left out entirely.
 */
export function splitBlocks(
  blocks: CollectionBlock[],
  excluded: string[] = [],
): { entries: CollectionEntry[]; texts: CollectionText[] } {
  const entries: CollectionEntry[] = [];
  const texts: CollectionText[] = [];
  for (const block of blocks) {
    if (block.kind === "photo") {
      if (excluded.includes(block.photoId)) continue;
      entries.push({
        photoId: block.photoId,
        columns: block.columns,
        rows: block.rows,
        mobileColumns: block.mobileColumns ?? null,
        mobileRows: block.mobileRows ?? null,
        showTitle: block.showTitle ?? true,
        caption: block.caption?.trim() || null,
      });
    } else
      texts.push({
        position: entries.length,
        text: block.text,
        style: block.style ?? "BODY",
        align: block.align ?? "START",
        columns: block.columns,
        rows: block.rows,
        mobileColumns: block.mobileColumns ?? null,
        mobileRows: block.mobileRows ?? null,
      });
  }
  return { entries, texts };
}

/**
 * The text blocks that belong on one page of a paged collection. A text appears
 * with the photo it precedes: the first visible photo at or after its place among
 * `positions` (every visible photo's position). Texts after the last photo go on
 * the last page.
 */
export function textsForPage(
  texts: CollectionText[],
  positions: number[],
  page: number[],
  lastPage: boolean,
): CollectionText[] {
  const ordered = [...positions].sort((a, b) => a - b);
  const shown = new Set(page);
  return texts.filter((text) => {
    const anchor = ordered.find((position) => position >= text.position);
    return anchor === undefined ? lastPage : shown.has(anchor);
  });
}
