import {
  PhotoOptimizationIssue,
  PhotoOptimizationIssueKind,
  PhotoOptimizationIssueUnit,
} from "@/src/domain/entities/PhotoOptimizationIssue";

const BYTES_IN_A_MEGABYTE = 1024 * 1024;

type Advice = {
  label: string;
  // What to do differently next time, in the words of the export dialog.
  advice: string;
  // Whether the pair of measurements adds anything to the advice. A count of tags does
  // not: what matters is that they were there, and the advice already says so.
  showsMeasure: boolean;
};

const ADVICE: Record<PhotoOptimizationIssueKind, Advice> = {
  LOCATION: {
    label: "GPS location",
    advice: "Export without location, so the coordinates never leave your machine.",
    showsMeasure: true,
  },
  FILE_SIZE: {
    label: "File size",
    advice:
      "Export a lighter file: the image host builds its own delivery versions anyway.",
    showsMeasure: true,
  },
  FORMAT: {
    label: "File format",
    advice: "Export as JPEG.",
    showsMeasure: true,
  },
  OVERSIZED: {
    label: "Larger than needed",
    advice: "A long edge of 3840 px already covers a 4K screen.",
    showsMeasure: true,
  },
  UNDERSIZED: {
    label: "Smaller than recommended",
    advice:
      "Export a longer edge, or the photo looks soft full screen on a large monitor.",
    showsMeasure: true,
  },
  COLOR_PROFILE: {
    label: "Color profile",
    advice: "Export in sRGB: browsers assume it, and a wider profile looks dull.",
    showsMeasure: true,
  },
  DEVELOP_SETTINGS: {
    label: "Develop settings",
    advice:
      'Export metadata as "All except Camera Raw info" to leave the recipe out of the file.',
    showsMeasure: false,
  },
  MISSING_METADATA: {
    label: "Missing camera data",
    advice: "Export keeping the camera metadata, or the capture date is lost.",
    showsMeasure: false,
  },
};

// A kind this build has never heard of still gets shown: the API's own measurements say
// more than hiding the line would.
function adviceFor(kind: PhotoOptimizationIssueKind): Advice {
  return ADVICE[kind] ?? { label: kind, advice: "", showsMeasure: true };
}

// The API sends a number and the unit it is in, never a sentence. A unit this build does
// not know, or a value that is not the number its unit promises, is printed as it came:
// wrong on screen is better than hidden.
function formatMeasure(unit: PhotoOptimizationIssueUnit, value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  switch (unit) {
    case "BYTES":
      return `${(amount / BYTES_IN_A_MEGABYTE).toFixed(1)} MB`;
    case "PIXELS":
      return `${amount} px`;
    case "TAG_COUNT":
      return amount === 1 ? "1 tag" : `${amount} tags`;
    default:
      return value;
  }
}

function IssueItem({ issue }: { issue: PhotoOptimizationIssue }) {
  const { label, advice, showsMeasure } = adviceFor(issue.getKind());
  const unit = issue.getUnit();

  return (
    <li className="py-2">
      <p className="text-sm font-semibold text-gray-800">
        {label}
        {showsMeasure && (
          <span className="ml-2 font-mono text-xs font-normal text-gray-500">
            {formatMeasure(unit, issue.getCurrentValue())} →{" "}
            {formatMeasure(unit, issue.getRecommendedValue())}
          </span>
        )}
      </p>
      {advice && <p className="text-sm text-gray-600">{advice}</p>}
    </li>
  );
}

type Props = {
  issues: PhotoOptimizationIssue[];
};

// Two different things, which is why they are not one list: what the photographer has
// to do something about, and what the API already dealt with on the way up.
export function OptimizationIssueList({ issues }: Props) {
  const pending = issues.filter((issue) => issue.isPending());
  const settled = issues.filter((issue) => !issue.isPending());

  if (issues.length === 0) {
    return (
      <p className="text-sm text-gray-600">
        Nothing to fix: the file was exported exactly as the gallery wants it.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <section>
          <h3 className="text-sm font-bold uppercase tracking-wide text-amber-700">
            Worth exporting again
          </h3>
          <ul className="divide-y divide-gray-200">
            {pending.map((issue) => (
              <IssueItem key={issue.getKind()} issue={issue} />
            ))}
          </ul>
        </section>
      )}

      {settled.length > 0 && (
        <section>
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">
            Corrected while uploading
          </h3>
          <p className="mb-1 text-sm text-gray-600">
            The stored file is already fine. This is only a note about how the export
            came in.
          </p>
          <ul className="divide-y divide-gray-200">
            {settled.map((issue) => (
              <IssueItem key={issue.getKind()} issue={issue} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
