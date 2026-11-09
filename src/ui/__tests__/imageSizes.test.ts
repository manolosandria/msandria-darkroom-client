import { describe, expect, it } from "vitest";
import { scaleSizes, shareSizes } from "../imageSizes";

describe("scaleSizes", () => {
  it("multiplies every length, keeping media conditions and nested commas", () => {
    expect(scaleSizes("100vw", 2.5)).toBe("calc(100vw * 2.5)");
    expect(
      scaleSizes("(max-width: 639px) calc(100vw - 2rem), min(33vw, 33rem)", 2),
    ).toBe(
      "(max-width: 639px) calc(calc(100vw - 2rem) * 2), calc(min(33vw, 33rem) * 2)",
    );
  });

  it("leaves the list alone when nothing grows", () => {
    expect(scaleSizes("50vw", 1)).toBe("50vw");
    expect(scaleSizes("50vw", Infinity)).toBe("50vw");
  });
});

describe("shareSizes", () => {
  it("writes a piece's share of the width on each side of the breakpoint", () => {
    expect(shareSizes(0.5, 0.25, 640)).toBe("(max-width: 640px) 50vw, 25vw");
    expect(shareSizes(2, 0.123, 600)).toBe("(max-width: 600px) 100vw, 12.3vw");
  });
});
