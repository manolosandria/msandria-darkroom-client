import { describe, expect, it } from "vitest";
import { qualityForScreen } from "../PhotoQuality";

describe("qualityForScreen", () => {
  it("asks a phone for Data saver, a laptop or HD monitor for Standard and only wider screens for Maximum", () => {
    expect(qualityForScreen(390, 3)).toBe("saver");
    expect(qualityForScreen(1440, 1.25)).toBe("standard");
    expect(qualityForScreen(1920, 1)).toBe("standard");
    expect(qualityForScreen(2560, 1)).toBe("max");
    expect(qualityForScreen(1440, 2)).toBe("max");
  });

  it("falls back to Standard when the screen cannot be read", () => {
    expect(qualityForScreen(0, 1)).toBe("standard");
    expect(qualityForScreen(Number.NaN, 1)).toBe("standard");
  });
});
