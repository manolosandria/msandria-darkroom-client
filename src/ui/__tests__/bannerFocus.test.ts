import { describe, expect, it } from "vitest";
import { bannerWindow } from "../bannerFocus";

// A 3:2 photograph (3840 × 2560), the proportion of the spider in the gallery.
const RATIO = 1.5;

describe("bannerWindow", () => {
  it("shows exactly the highlight when the banner has its proportion", () => {
    const focus = { x: 0.1, y: 0.2, width: 0.4, height: 0.4 * 1.5 * (2 / 3) };
    const window = bannerWindow(RATIO, focus, 1.5);
    expect(window.x).toBeCloseTo(focus.x);
    expect(window.y).toBeCloseTo(focus.y);
    expect(window.width).toBeCloseTo(focus.width);
    expect(window.height).toBeCloseTo(focus.height);
  });

  // A wide desktop banner keeps a small subject whole and fills its sides with the
  // photograph around it, instead of cutting the subject's top and bottom.
  it("keeps a small highlight whole in a wide banner and widens around it", () => {
    const focus = { x: 0.2, y: 0.1, width: 0.2, height: 0.3 };
    const window = bannerWindow(RATIO, focus, 4);
    expect(window.y).toBeLessThanOrEqual(focus.y);
    expect(window.y + window.height).toBeGreaterThanOrEqual(
      focus.y + focus.height - 1e-9,
    );
    expect(window.x).toBeLessThanOrEqual(focus.x);
    expect(window.x + window.width).toBeGreaterThanOrEqual(
      focus.x + focus.width,
    );
    // In the banner's own proportion.
    expect((window.width * RATIO) / window.height).toBeCloseTo(4);
  });

  it("never reaches past the photograph's edges", () => {
    const window = bannerWindow(
      RATIO,
      { x: 0, y: 0, width: 0.1, height: 0.1 },
      0.8,
    );
    expect(window.x).toBe(0);
    expect(window.y).toBe(0);
    expect(window.width).toBeLessThanOrEqual(1);
    expect(window.height).toBeLessThanOrEqual(1);
  });

  // When the photograph has nothing more around the highlight, the banner is filled by
  // cutting into it from the highlight's centre, as before.
  it("cuts from the centre of the highlight when the photo runs out", () => {
    const focus = { x: 0, y: 0.1, width: 1, height: 0.6 };
    const window = bannerWindow(RATIO, focus, 4);
    expect(window.width).toBe(1);
    expect(window.height).toBeCloseTo(RATIO / 4);
    expect(window.y + window.height / 2).toBeCloseTo(0.4);
  });

  it("covers the banner with the whole photo when the focus is the whole photo", () => {
    expect(bannerWindow(RATIO, { x: 0, y: 0, width: 1, height: 1 }, 3)).toEqual(
      { x: 0, y: 0.25, width: 1, height: 0.5 },
    );
  });
});
