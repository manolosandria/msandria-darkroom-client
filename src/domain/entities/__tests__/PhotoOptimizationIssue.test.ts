import { describe, expect, it } from "vitest";
import {
  PhotoOptimizationIssue,
  PhotoOptimizationIssueParams,
} from "../PhotoOptimizationIssue";

function issue(overrides: Partial<PhotoOptimizationIssueParams> = {}) {
  return new PhotoOptimizationIssue({
    kind: "OVERSIZED",
    resolution: "FIXED_ON_UPLOAD",
    unit: "PIXELS",
    currentValue: "4608",
    recommendedValue: "3840",
    ...overrides,
  });
}

describe("PhotoOptimizationIssue", () => {
  it("keeps what the API measured, and the unit it measured it in", () => {
    const oversized = issue();

    expect(oversized.getKind()).toBe("OVERSIZED");
    expect(oversized.getResolution()).toBe("FIXED_ON_UPLOAD");
    expect(oversized.getUnit()).toBe("PIXELS");
    expect(oversized.getCurrentValue()).toBe("4608");
    expect(oversized.getRecommendedValue()).toBe("3840");
  });

  it("trims the values it was given", () => {
    const trimmed = issue({ currentValue: "  4608  ", recommendedValue: " jpg " });

    expect(trimmed.getCurrentValue()).toBe("4608");
    expect(trimmed.getRecommendedValue()).toBe("jpg");
  });

  // The API owns this vocabulary too, and a unit it adds later is no reason to drop the
  // measurement on the floor.
  it("keeps a unit this build has never heard of", () => {
    const unknown = issue({
      unit: "SOMETHING_NEW" as PhotoOptimizationIssueParams["unit"],
    });

    expect(unknown.getUnit()).toBe("SOMETHING_NEW");
  });

  // What the upload pipeline already corrected is a note about the export, not a chore.
  it("does not count an issue the upload fixed as pending", () => {
    expect(issue({ resolution: "FIXED_ON_UPLOAD" }).isPending()).toBe(false);
  });

  it("counts an issue the stored file still has as pending", () => {
    expect(issue({ resolution: "NEEDS_REUPLOAD" }).isPending()).toBe(true);
  });

  it("counts an issue that needs a new export as pending", () => {
    expect(
      issue({ kind: "UNDERSIZED", resolution: "NEEDS_REEXPORT" }).isPending(),
    ).toBe(true);
  });

  // The API owns this vocabulary and may grow it. Treating a resolution this build has
  // never heard of as settled would quietly hide work.
  it("counts an unknown resolution as pending", () => {
    const unknown = issue({
      resolution: "SOMETHING_NEW" as PhotoOptimizationIssueParams["resolution"],
    });

    expect(unknown.isPending()).toBe(true);
  });
});
