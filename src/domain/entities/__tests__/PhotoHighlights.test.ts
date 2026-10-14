import { describe, expect, it } from "vitest";
import {
  centeredHighlight,
  HIGHLIGHT_RATIOS,
  HighlightKind,
} from "../PhotoHighlights";

const LANDSCAPE = 3 / 2;
const PORTRAIT = 2 / 3;

describe("centeredHighlight", () => {
  // The crop is stored as fractions of the photo, so the numbers mean the same thing
  // against the original and against any rendition the API serves.
  it.each<[HighlightKind, number]>([
    ["square", 1],
    ["landscape", LANDSCAPE],
    ["portrait", PORTRAIT],
  ])("gives a %s crop its own shape inside a square photo", (kind, ratio) => {
    const { width, height } = centeredHighlight(kind, 1);

    expect(width / height).toBeCloseTo(ratio);
  });

  it("centres the crop it proposes", () => {
    const { x, y, width, height } = centeredHighlight("square", LANDSCAPE);

    expect(x).toBeCloseTo((1 - width) / 2);
    expect(y).toBeCloseTo((1 - height) / 2);
  });

  // Whatever the photo's shape, the proposed crop has to fit inside it.
  it.each([0.4, 1, LANDSCAPE, 2.4])(
    "keeps every shape inside a photo of ratio %p",
    (imageRatio) => {
      for (const kind of Object.keys(HIGHLIGHT_RATIOS) as HighlightKind[]) {
        const { x, y, width, height } = centeredHighlight(kind, imageRatio);

        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x + width).toBeLessThanOrEqual(1);
        expect(y + height).toBeLessThanOrEqual(1);
      }
    },
  );

  // The size is what the editor's slider moves, and the crop keeps its shape.
  it("scales with the size it is asked for", () => {
    const small = centeredHighlight("square", 1, 0.2);
    const large = centeredHighlight("square", 1, 1);

    expect(small.width).toBeCloseTo(0.2);
    expect(large.width).toBeCloseTo(1);
    expect(small.width / small.height).toBeCloseTo(large.width / large.height);
  });

  it("fills the short side of the photo when asked for everything", () => {
    const { width, height } = centeredHighlight("square", LANDSCAPE, 1);

    expect(height).toBeCloseTo(1);
    expect(width).toBeCloseTo(1 / LANDSCAPE);
  });
});
