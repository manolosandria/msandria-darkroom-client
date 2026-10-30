import { describe, expect, it } from "vitest";
import { arrangeTargetAt, describeTarget } from "../BannerArrange";

describe("arrangeTargetAt", () => {
  it("puts Welcome beside the photographs from an edge band", () => {
    expect(arrangeTargetAt("text", 0.05, 0.5)).toEqual({ layout: "text-left" });
    expect(arrangeTargetAt("text", 0.95, 0.5)).toEqual({ layout: "text-right" });
    expect(arrangeTargetAt("text", 0.5, 0.05)).toEqual({ layout: "text-top" });
    expect(arrangeTargetAt("text", 0.5, 0.95)).toEqual({ layout: "text-bottom" });
  });
  it("snaps Welcome over the photographs to the nearest of nine anchors", () => {
    expect(arrangeTargetAt("text", 0.2, 0.2)).toEqual({
      layout: "text-overlay",
      position: "top-left",
    });
    expect(arrangeTargetAt("text", 0.5, 0.5)).toEqual({
      layout: "text-overlay",
      position: "center",
    });
    expect(arrangeTargetAt("text", 0.84, 0.84)).toEqual({
      layout: "text-overlay",
      position: "bottom-right",
    });
  });
  it("sends Welcome to the edge opposite the one Photographs take", () => {
    expect(arrangeTargetAt("photo", 0.1, 0.5)).toEqual({ layout: "text-right" });
    expect(arrangeTargetAt("photo", 0.5, 0.9)).toEqual({ layout: "text-top" });
    expect(arrangeTargetAt("photo", 0.5, 0.5)).toEqual({ layout: "text-right" });
  });
  it("describes each target in words", () => {
    expect(describeTarget({ layout: "text-top" })).toBe(
      "Welcome above the photographs",
    );
    expect(describeTarget({ layout: "text-overlay", position: "center" })).toBe(
      "Welcome over the photographs, center",
    );
    expect(describeTarget({ layout: "text-overlay" })).toBe(
      "Welcome over the photographs, bottom left",
    );
  });
});
