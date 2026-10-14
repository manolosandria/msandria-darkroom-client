import { describe, expect, it } from "vitest";
import {
  PhotoOptimizationIssue,
  PhotoOptimizationIssueParams,
} from "../PhotoOptimizationIssue";

function issue(overrides: Partial<PhotoOptimizationIssueParams> = {}) {
  return new PhotoOptimizationIssue({
    kind: "OVERSIZED",
    resolution: "FIXED_ON_UPLOAD",
    currentValue: "4608 px",
    recommendedValue: "<= 3840 px",
    ...overrides,
  });
}

describe("PhotoOptimizationIssue", () => {
  it("keeps what the API measured", () => {
    const oversized = issue();

    expect(oversized.getKind()).toBe("OVERSIZED");
    expect(oversized.getResolution()).toBe("FIXED_ON_UPLOAD");
    expect(oversized.getCurrentValue()).toBe("4608 px");
    expect(oversized.getRecommendedValue()).toBe("<= 3840 px");
  });

  it("trims the values it was given", () => {
    const trimmed = issue({ currentValue: "  4608 px  ", recommendedValue: " jpg " });

    expect(trimmed.getCurrentValue()).toBe("4608 px");
    expect(trimmed.getRecommendedValue()).toBe("jpg");
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
