import { describe, expect, it } from "vitest";
import {
  mergeBlocks,
  mobileSpan,
  spanIn,
  spanStyle,
  splitBlocks,
  textsForPage,
} from "../collectionLayout";
import { CollectionText } from "../entities/Catalog";

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
