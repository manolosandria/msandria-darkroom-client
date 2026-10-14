import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  PhotoOptimizationIssue,
  PhotoOptimizationIssueParams,
} from "@/src/domain/entities/PhotoOptimizationIssue";
import { OptimizationIssueList } from "../OptimizationIssueList";

function issue(params: Partial<PhotoOptimizationIssueParams>) {
  return new PhotoOptimizationIssue({
    kind: "OVERSIZED",
    resolution: "NEEDS_REEXPORT",
    unit: "PIXELS",
    currentValue: "4608",
    recommendedValue: "3840",
    ...params,
  });
}

function renderIssues(issues: PhotoOptimizationIssue[]) {
  render(<OptimizationIssueList issues={issues} />);
}

describe("OptimizationIssueList", () => {
  it("says there is nothing to fix when the API found nothing", () => {
    renderIssues([]);

    expect(screen.getByText(/Nothing to fix/)).toBeInTheDocument();
  });

  // The API sends bytes, and nobody reads a photo's weight in bytes.
  it("reads a file size in megabytes", () => {
    renderIssues([
      issue({
        kind: "FILE_SIZE",
        unit: "BYTES",
        currentValue: "9937601",
        recommendedValue: "5242880",
      }),
    ]);

    expect(screen.getByText(/9.5 MB → 5.0 MB/)).toBeInTheDocument();
  });

  it("puts the unit back on a measurement in pixels", () => {
    renderIssues([issue({})]);

    expect(screen.getByText(/4608 px → 3840 px/)).toBeInTheDocument();
  });

  it("counts tags in English, singular included", () => {
    renderIssues([
      issue({
        kind: "LOCATION",
        unit: "TAG_COUNT",
        currentValue: "1",
        recommendedValue: "0",
      }),
    ]);

    expect(screen.getByText(/1 tag → 0 tags/)).toBeInTheDocument();
  });

  it("repeats a code, such as a format or a color space, as the API sent it", () => {
    renderIssues([
      issue({
        kind: "COLOR_PROFILE",
        unit: "COLOR_SPACE",
        currentValue: "Adobe RGB (1998)",
        recommendedValue: "sRGB",
      }),
    ]);

    expect(screen.getByText(/Adobe RGB \(1998\) → sRGB/)).toBeInTheDocument();
  });

  // What the photographer has to change is the advice, not how many tags there were.
  it("leaves the numbers out where they add nothing", () => {
    renderIssues([
      issue({
        kind: "DEVELOP_SETTINGS",
        unit: "TAG_COUNT",
        currentValue: "2",
        recommendedValue: "0",
      }),
    ]);

    expect(screen.getByText("Develop settings")).toBeInTheDocument();
    expect(screen.queryByText(/2 tags/)).not.toBeInTheDocument();
  });

  // A unit this build has never heard of, or a value that is not the number its unit
  // promised: showing it raw beats hiding the line.
  it("prints a measurement it cannot read as it came", () => {
    renderIssues([
      issue({
        unit: "SOMETHING_NEW" as PhotoOptimizationIssueParams["unit"],
        currentValue: "whatever",
        recommendedValue: "something",
      }),
    ]);

    expect(screen.getByText(/whatever → something/)).toBeInTheDocument();
  });

  it("splits what needs a new export from what the upload corrected", () => {
    renderIssues([
      issue({ kind: "UNDERSIZED", resolution: "NEEDS_REEXPORT" }),
      issue({ kind: "FORMAT", resolution: "FIXED_ON_UPLOAD", unit: "FILE_FORMAT" }),
    ]);

    expect(screen.getByText("Worth exporting again")).toBeInTheDocument();
    expect(screen.getByText("Corrected while uploading")).toBeInTheDocument();
    expect(screen.getByText("Smaller than recommended")).toBeInTheDocument();
    expect(screen.getByText("File format")).toBeInTheDocument();
  });

  // The API owns the list of kinds and may grow it; a line with no wording of ours is
  // still worth showing.
  it("shows a kind this build has never heard of", () => {
    renderIssues([
      issue({ kind: "SOMETHING_NEW" as PhotoOptimizationIssueParams["kind"] }),
    ]);

    expect(screen.getByText(/SOMETHING_NEW/)).toBeInTheDocument();
  });
});
