import { describe, expect, it } from "vitest";
import { framedLayout } from "../framedLayout";

describe("framedLayout", () => {
  it("fits an unframed photo by its own proportion", () => {
    expect(framedLayout(2, null)).toEqual({ paddingX: 0, paddingY: 0, heightPerWidth: 0.5 });
  });

  it("measures a landscape frame against its short side, which is the height", () => {
    const layout = framedLayout(2, { color: "#000", leftRight: 10, topBottom: 10 });
    expect(layout.paddingX).toBe(5);
    expect(layout.paddingY).toBe(5);
    // image share 0.9 over ratio 2, plus 10% of the width in padding
    expect(layout.heightPerWidth).toBeCloseTo(0.55);
  });

  it("measures a portrait frame against its short side, which is the width", () => {
    const layout = framedLayout(0.5, { color: "#fff", leftRight: 4, topBottom: 6 });
    expect(layout.paddingX).toBe(4);
    expect(layout.paddingY).toBe(6);
    expect(layout.heightPerWidth).toBeCloseTo(0.92 / 0.5 + 0.12);
  });
});
