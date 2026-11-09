import { describe, expect, it } from "vitest";
import {
  arrangePieces,
  flowPieces,
  mergeBlocks,
  mobileSpan,
  mosaicRows,
  placePieces,
  spanIn,
  spanStyle,
  splitBlocks,
  textsForPage,
} from "../collectionLayout";
import { CollectionText, MosaicSize } from "../entities/Catalog";

const text = (position: number, words = `at ${position}`): CollectionText => ({
  position,
  text: words,
  style: "BODY",
  align: "START",
  columns: 4,
  rows: 1,
  mobileColumns: null,
  mobileRows: null,
});

describe("collection layout", () => {
  it("derives a phone size that keeps the piece's proportion", () => {
    expect(mobileSpan({ columns: 2, rows: 2 })).toEqual({
      columns: 2,
      rows: 2,
      custom: false,
    });
    expect(mobileSpan({ columns: 8, rows: 4 })).toEqual({
      columns: 4,
      rows: 2,
      custom: false,
    });
    expect(mobileSpan({ columns: 8, rows: 1 }).rows).toBe(1);
  });

  it("uses a piece's own phone size, kept within the phone grid", () => {
    expect(
      mobileSpan({ columns: 2, rows: 2, mobileColumns: 9, mobileRows: 3 }),
    ).toEqual({ columns: 4, rows: 3, custom: true });
    // A phone size needs both numbers; one alone is ignored.
    expect(mobileSpan({ columns: 2, rows: 2, mobileColumns: 3 }).custom).toBe(
      false,
    );
  });

  it("gives the spans of each layout and the properties the stylesheet reads", () => {
    expect(spanIn({ columns: 12, rows: 0 }, "desktop")).toEqual({
      columns: 8,
      rows: 1,
      custom: true,
    });
    expect(spanStyle({ columns: 6, rows: 3 })).toEqual({
      "--span-columns": 6,
      "--span-rows": 3,
      "--span-mobile-columns": 4,
      "--span-mobile-rows": 2,
    });
  });

  it("merges texts before the photo they precede and splits them back", () => {
    const entries = [
      { photoId: "a", columns: 2, rows: 2 },
      { photoId: "b", columns: 4, rows: 2, caption: "  Dawn " },
    ];
    const blocks = mergeBlocks(entries, [
      text(2, "end"),
      text(0, "start"),
      text(1),
    ]);
    expect(
      blocks.map((block) =>
        block.kind === "photo" ? block.photoId : block.text,
      ),
    ).toEqual(["start", "a", "at 1", "b", "end"]);
    const { entries: saved, texts } = splitBlocks(blocks);
    expect(saved[1]).toEqual({
      photoId: "b",
      columns: 4,
      rows: 2,
      mobileColumns: null,
      mobileRows: null,
      showTitle: true,
      caption: "Dawn",
    });
    expect(texts.map((item) => [item.position, item.text])).toEqual([
      [0, "start"],
      [1, "at 1"],
      [2, "end"],
    ]);
  });

  it("anchors texts to the photos that are kept", () => {
    const blocks = mergeBlocks(
      [
        { photoId: "a", columns: 2, rows: 2 },
        { photoId: "b", columns: 2, rows: 2 },
      ],
      [text(2)],
    );
    const { entries, texts } = splitBlocks(blocks, ["a"]);
    expect(entries.map((entry) => entry.photoId)).toEqual(["b"]);
    expect(texts[0].position).toBe(1);
  });

  it("places texts by the API's positions, which skip hidden photos", () => {
    const blocks = mergeBlocks(
      [
        { photoId: "a", columns: 2, rows: 2, position: 0 },
        { photoId: "c", columns: 2, rows: 2, position: 2 },
      ],
      [text(1)],
    );
    expect(blocks.map((block) => block.kind)).toEqual([
      "photo",
      "text",
      "photo",
    ]);
  });

  it("shows each text on the page of the photo it precedes", () => {
    const texts = [text(0), text(3), text(9)];
    const positions = [0, 1, 4, 5];
    expect(textsForPage(texts, positions, [0, 1], false)).toEqual([text(0)]);
    expect(textsForPage(texts, positions, [4, 5], true)).toEqual([
      text(3),
      text(9),
    ]);
  });
});

describe("start columns", () => {
  it("keeps a start column inside the grid and in the saved composition", async () => {
    const { fitColumn, spanStyle, splitBlocks, mergeBlocks } =
      await import("../collectionLayout");
    expect(fitColumn({ columns: 4, rows: 2, column: 7 })).toBe(5);
    expect(fitColumn({ columns: 2, rows: 2 })).toBeNull();
    expect(spanStyle({ columns: 2, rows: 2, column: 3 })).toMatchObject({
      "--start-column": 3,
    });
    const blocks = mergeBlocks(
      [{ photoId: "a", columns: 4, rows: 4, column: 1 }],
      [{ position: 1, text: "Under it", columns: 4, rows: 1, column: 1 }],
    );
    const { entries, texts } = splitBlocks(blocks);
    expect(entries[0].column).toBe(1);
    expect(texts[0].column).toBe(1);
  });
});

describe("cells", () => {
  const piece = (key: string, extra: Partial<MosaicSize> = {}) => ({
    key,
    columns: 2,
    rows: 2,
    ...extra,
  });

  it("flows pieces one after another, wrapping at the eighth column", () => {
    expect(
      placePieces([
        piece("a", { columns: 4 }),
        piece("b", { columns: 4 }),
        piece("c", { columns: 2, rows: 1 }),
      ]),
    ).toEqual([
      { row: 1, column: 1 },
      { row: 1, column: 5 },
      { row: 3, column: 1 },
    ]);
    // A piece that does not fit beside the one before starts the next free row.
    expect(
      placePieces([piece("a", { columns: 6 }), piece("b", { columns: 4 })]),
    ).toEqual([
      { row: 1, column: 1 },
      { row: 3, column: 1 },
    ]);
  });

  it("puts a piece starting at the column before underneath it", () => {
    expect(placePieces([piece("a"), piece("b", { column: 1 })])).toEqual([
      { row: 1, column: 1 },
      { row: 3, column: 1 },
    ]);
    // A later column on the same row leaves a gap beside the piece before.
    expect(placePieces([piece("a"), piece("b", { column: 6 })])).toEqual([
      { row: 1, column: 1 },
      { row: 1, column: 6 },
    ]);
  });

  it("keeps pinned pieces in their cell, gaps included, and moves down one that overlaps", () => {
    const pieces = [
      piece("a", { column: 3, row: 4 }),
      piece("b", { column: 4, row: 4 }),
      piece("c"),
    ];
    expect(placePieces(pieces)).toEqual([
      { row: 4, column: 3 },
      { row: 6, column: 4 },
      { row: 6, column: 6 },
    ]);
    expect(mosaicRows(pieces)).toBe(7);
    expect(mosaicRows([])).toBe(0);
    // A row without its column is not a cell: the piece flows.
    expect(placePieces([piece("a", { row: 5 })])).toEqual([
      { row: 1, column: 1 },
    ]);
  });

  it("moves a piece to a cell, pushing down what it lands on and nothing else", () => {
    const moved = arrangePieces(
      [piece("a"), piece("b"), piece("c", { column: 7, row: 1 })],
      "b",
      { row: 1, column: 2 },
    );
    expect(moved.map(({ key, row, column }) => [key, row, column])).toEqual([
      ["b", 1, 2],
      ["c", 1, 7],
      ["a", 3, 1],
    ]);
    // A cell past the edge keeps the piece inside the grid.
    expect(
      arrangePieces([piece("a", { columns: 4 })], "a", {
        row: 0,
        column: 8,
      })[0],
    ).toMatchObject({ row: 1, column: 5 });
    // A chain: what was pushed pushes in turn.
    const chain = arrangePieces(
      [
        piece("a", { column: 1, row: 1 }),
        piece("b", { column: 1, row: 3 }),
        piece("c", { column: 1, row: 6 }),
      ],
      "a",
      { row: 2, column: 1 },
    );
    expect(chain.map(({ key, row }) => [key, row])).toEqual([
      ["a", 2],
      ["b", 4],
      ["c", 6],
    ]);
  });

  it("pins every piece after a resize and lets them flow again", () => {
    const resized = arrangePieces(
      [piece("a", { columns: 6 }), piece("b", { column: 7, row: 1 })],
      "a",
    );
    expect(resized.map(({ key, row, column }) => [key, row, column])).toEqual([
      ["a", 1, 1],
      ["b", 1, 7],
    ]);
    expect(flowPieces(resized)).toEqual([
      expect.objectContaining({ key: "a", row: null, column: null }),
      expect.objectContaining({ key: "b", row: null, column: null }),
    ]);
  });

  it("saves a row only with its column, and the stylesheet reads the cell", () => {
    const blocks = mergeBlocks(
      [{ photoId: "p", columns: 2, rows: 2, column: 3, row: 5 }],
      [{ ...text(1), column: 1, row: 9 }],
    );
    expect(blocks[1]).toMatchObject({ kind: "text", column: 1, row: 9 });
    const { entries, texts } = splitBlocks([
      ...blocks,
      {
        kind: "photo",
        key: "photo:q",
        photoId: "q",
        columns: 2,
        rows: 2,
        row: 4,
      },
    ]);
    expect(entries[0]).toMatchObject({ column: 3, row: 5 });
    expect(entries[1]).not.toHaveProperty("row");
    expect(texts[0]).toMatchObject({ column: 1, row: 9 });
    expect(spanStyle({ columns: 2, rows: 2 }, { row: 4, column: 3 })).toEqual(
      expect.objectContaining({ "--start-column": 3, "--start-row": 4 }),
    );
  });
});
