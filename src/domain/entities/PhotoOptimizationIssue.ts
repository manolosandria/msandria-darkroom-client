// Something the API found in the file that was handed in for publishing, together with
// what it takes to settle it. Publishing never fails over one of these: they are
// advice about how to export the next photo.
export type PhotoOptimizationIssueKind =
  | "LOCATION"
  | "FILE_SIZE"
  | "FORMAT"
  | "OVERSIZED"
  | "UNDERSIZED"
  | "COLOR_PROFILE"
  | "DEVELOP_SETTINGS"
  | "MISSING_METADATA";

// What is left to do about an issue. `FIXED_ON_UPLOAD` is a log entry rather than a
// chore: the API's upload pipeline corrected it before the file reached the image host.
// `NEEDS_REUPLOAD` means the stored file still carries it and passing it through the
// pipeline again is enough; `NEEDS_REEXPORT` means no re-encode can invent what is
// missing and the original has to be exported again.
export type PhotoOptimizationIssueResolution =
  | "FIXED_ON_UPLOAD"
  | "NEEDS_REUPLOAD"
  | "NEEDS_REEXPORT";

export type PhotoOptimizationIssueParams = {
  kind: PhotoOptimizationIssueKind;
  resolution: PhotoOptimizationIssueResolution;
  // As the API measured it, for instance "4608 px" against "<= 3840 px".
  currentValue: string;
  recommendedValue: string;
};

// Nothing here is validated against a closed list on purpose. The API owns the
// vocabulary and may grow it; a kind this build has never heard of is still worth
// showing, and an unknown resolution counts as outstanding rather than silently done.
export class PhotoOptimizationIssue {
  private readonly kind: PhotoOptimizationIssueKind;
  private readonly resolution: PhotoOptimizationIssueResolution;
  private readonly currentValue: string;
  private readonly recommendedValue: string;

  constructor(params: PhotoOptimizationIssueParams) {
    this.kind = params.kind;
    this.resolution = params.resolution;
    this.currentValue = params.currentValue.trim();
    this.recommendedValue = params.recommendedValue.trim();
  }

  getKind() {
    return this.kind;
  }
  getResolution() {
    return this.resolution;
  }
  getCurrentValue() {
    return this.currentValue;
  }
  getRecommendedValue() {
    return this.recommendedValue;
  }

  // Still asks something of the photographer. Everything else is history.
  isPending() {
    return this.resolution !== "FIXED_ON_UPLOAD";
  }
}
