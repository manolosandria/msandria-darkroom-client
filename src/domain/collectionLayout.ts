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

/**
 * The custom properties the mosaic's stylesheet reads for both layouts. With the cell
 * `placePieces` found for it, the piece sits there on wide screens; phones ignore it.
 */
export function spanStyle(
  size: MosaicSize,
  cell?: MosaicCell,
): Record<string, number> {
  const wide = spanIn(size, "desktop");
  const phone = mobileSpan(size);
  const column = cell?.column ?? fitColumn(size);
  return {
    "--span-columns": wide.columns,
    "--span-rows": wide.rows,
    "--span-mobile-columns": phone.columns,
    "--span-mobile-rows": phone.rows,
    ...(column ? { "--start-column": column } : {}),
    ...(cell ? { "--start-row": cell.row } : {}),
  };
}

/** The wide-screen cell where a piece starts. */
export type MosaicCell = { row: number; column: number };

/** The farthest row a piece placed by hand may start at; the API agrees. */
export const MOSAIC_MAX_START_ROW = 1000;

/** The row a piece is pinned to: only with its column, as the API stores it. */
const pinnedRow = (size: MosaicSize) =>
  size.row && size.column
    ? Math.min(MOSAIC_MAX_START_ROW, Math.max(1, Math.round(size.row)))
    : null;

/**
 * Where every piece of a composition starts on the eight-column grid, in order. A
 * piece pinned to a cell (`row` and `column`) stays there; one with a column alone
 * starts there, in the next row with room, so the same column as the piece before puts
 * it underneath; the others follow the piece before, as CSS grid's own flow would. A
 * pinned piece that would overlap one already placed moves down until it fits.
 */
export function placePieces(pieces: MosaicSize[]): MosaicCell[] {
  const taken: boolean[][] = [];
  const free = (row: number, column: number, width: number, height: number) => {
    for (let r = row; r < row + height; r++)
      for (let c = column; c < column + width; c++)
        if (taken[r]?.[c]) return false;
    return true;
  };
  let cursor = { row: 1, column: 1 };
  return pieces.map((piece) => {
    const { columns: width, rows: height } = spanIn(piece, "desktop");
    const pinned = pinnedRow(piece);
    const column = fitColumn(piece);
    let row = cursor.row;
    let start = cursor.column;
    if (column) {
      start = column;
      row = pinned ?? (column < cursor.column ? cursor.row + 1 : cursor.row);
      while (!free(row, start, width, height)) row++;
    } else
      while (
        start + width - 1 > MOSAIC_COLUMNS ||
        !free(row, start, width, height)
      )
        if (start + width - 1 >= MOSAIC_COLUMNS) {
          row++;
          start = 1;
        } else start++;
    for (let r = row; r < row + height; r++)
      for (let c = start; c < start + width; c++) (taken[r] ??= [])[c] = true;
    cursor = { row, column: start + width };
    return { row, column: start };
  });
}

/** How many rows a composition takes on wide screens. */
export function mosaicRows(pieces: MosaicSize[]): number {
  return placePieces(pieces).reduce(
    (last, cell, index) =>
      Math.max(last, cell.row + spanIn(pieces[index], "desktop").rows - 1),
    0,
  );
}

type Box = MosaicCell & { width: number; height: number };
const overlaps = (a: Box, b: Box) =>
  a.column < b.column + b.width &&
  b.column < a.column + a.width &&
  a.row < b.row + b.height &&
  b.row < a.row + a.height;

/**
 * Every piece pinned to the cell it shows in, the one named by `key` moved to `cell`
 * (or left where it is, after a resize), and the pieces it lands on pushed down out of
 * its way; nothing else moves, so gaps stay gaps. The result is in reading order, top
 * to bottom and left to right, which is the order phones show.
 */
export function arrangePieces<T extends MosaicSize & { key: string }>(
  pieces: T[],
  key: string,
  cell?: MosaicCell,
): T[] {
  const cells = placePieces(pieces);
  const boxes = pieces.map((piece, index) => {
    const { columns: width, rows: height } = spanIn(piece, "desktop");
    const at = piece.key === key && cell ? cell : cells[index];
    return {
      piece,
      width,
      height,
      column: Math.max(1, Math.min(at.column, MOSAIC_COLUMNS - width + 1)),
      row: Math.max(1, Math.min(at.row, MOSAIC_MAX_START_ROW)),
    };
  });
  const moved = boxes.filter((box) => box.piece.key === key);
  const settled = [...moved];
  const rest = boxes
    .filter((box) => !moved.includes(box))
    .sort((a, b) => a.row - b.row || a.column - b.column);
  for (const box of rest) {
    let blocker = settled.find((other) => overlaps(box, other));
    while (blocker) {
      box.row = blocker.row + blocker.height;
      blocker = settled.find((other) => overlaps(box, other));
    }
    settled.push(box);
  }
  return settled
    .sort((a, b) => a.row - b.row || a.column - b.column)
    .map(({ piece, row, column }) => ({ ...piece, row, column }));
}

/** The pieces in their own order again, one after another without gaps. */
export function flowPieces<T extends MosaicSize>(pieces: T[]): T[] {
  return pieces.map((piece) => ({ ...piece, row: null, column: null }));
}

/**
 * The start column a piece keeps, pulled in so it never leaves the eight columns
 * (a piece widened after choosing it moves left); null when it follows the flow.
 */
export function fitColumn(size: MosaicSize): number | null {
  if (!size.column) return null;
  return Math.max(1, Math.min(size.column, MOSAIC_COLUMNS - size.columns + 1));
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
      const {
        text,
        style,
        align,
        columns,
        rows,
        mobileColumns,
        mobileRows,
        column,
        row,
      } = queue.shift()!;
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
        column,
        row,
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

// Saved only when set: the API rewrites every piece, so leaving them out clears them.
function placement(size: MosaicSize) {
  const column = fitColumn(size);
  const row = pinnedRow(size);
  return column ? { column, ...(row ? { row } : {}) } : {};
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
        ...placement(block),
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
        ...placement(block),
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
