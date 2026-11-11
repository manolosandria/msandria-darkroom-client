// Gallery's filters by how a photograph was taken: camera, lens, ranges of focal length,
// shutter speed, aperture and ISO, and colour or black and white. A photograph without
// the data a filter asks about is left out only while that filter applies; the API
// decides that, in its query.

export type PhotoTone = "color" | "monochrome";

/** Either end may be open: a range with neither is no filter at all. */
export type MetadataRange = { min?: number; max?: number };

export type MetadataRangeKey = "focalLength" | "exposureTime" | "aperture" | "iso";

export type PhotoMetadataFilters = {
  /** Exact cameras, as `make|model` from the facets; any of them matches. */
  cameras: string[];
  /** Exact lens names; any of them matches. */
  lenses: string[];
  focalLength: MetadataRange;
  exposureTime: MetadataRange;
  aperture: MetadataRange;
  iso: MetadataRange;
  tone?: PhotoTone;
};

/** What there is to filter among the public gallery's photographs. */
export type PhotoFacets = {
  cameras: {
    value: string;
    make: string | null;
    model: string | null;
    count: number;
  }[];
  lenses: { value: string; count: number }[];
  focalLength: { min: number; max: number } | null;
  exposureTime: { min: number; max: number } | null;
  aperture: { min: number; max: number } | null;
  iso: { min: number; max: number } | null;
  tonality: { color: number; monochrome: number };
};

export const METADATA_RANGE_KEYS: MetadataRangeKey[] = [
  "focalLength",
  "exposureTime",
  "aperture",
  "iso",
];

/** The query parameters of each range, shared by the URL and the API. */
export const METADATA_RANGE_PARAMS: Record<
  MetadataRangeKey,
  { min: string; max: string }
> = {
  focalLength: { min: "focalMin", max: "focalMax" },
  exposureTime: { min: "shutterMin", max: "shutterMax" },
  aperture: { min: "apertureMin", max: "apertureMax" },
  iso: { min: "isoMin", max: "isoMax" },
};

/** The API's bounds, the same it accepts from a file's EXIF. */
export const METADATA_RANGE_LIMITS: Record<MetadataRangeKey, number> = {
  focalLength: 5000,
  exposureTime: 3600,
  aperture: 128,
  iso: 10_000_000,
};

/** At most this many cameras or lenses travel in one query, as the API allows. */
export const MAX_EQUIPMENT_FILTERS = 20;

export function emptyMetadataFilters(): PhotoMetadataFilters {
  return {
    cameras: [],
    lenses: [],
    focalLength: {},
    exposureTime: {},
    aperture: {},
    iso: {},
  };
}

/** How many separate choices are made: each camera, lens, range and the tone. */
export function activeMetadataCount(filters: PhotoMetadataFilters) {
  return (
    filters.cameras.length +
    filters.lenses.length +
    METADATA_RANGE_KEYS.filter(
      (key) =>
        filters[key].min !== undefined || filters[key].max !== undefined,
    ).length +
    (filters.tone ? 1 : 0)
  );
}

/** The filters as `GET /photos/browse` parameters; empty ones are left out. */
export function metadataQuery(
  filters: PhotoMetadataFilters,
): Record<string, string | number | string[]> {
  const query: Record<string, string | number | string[]> = {};
  if (filters.cameras.length) query.camera = filters.cameras;
  if (filters.lenses.length) query.lens = filters.lenses;
  for (const key of METADATA_RANGE_KEYS) {
    const { min, max } = filters[key];
    if (min !== undefined) query[METADATA_RANGE_PARAMS[key].min] = min;
    if (max !== undefined) query[METADATA_RANGE_PARAMS[key].max] = max;
  }
  if (filters.tone) query.tone = filters.tone;
  return query;
}

// The usual marks on lenses and dials. Between a range's ends, these are the stops the
// visitor chooses from; the ends themselves are always offered.
const STOPS: Record<MetadataRangeKey, number[]> = {
  focalLength: [
    8, 10, 12, 14, 16, 18, 20, 24, 28, 35, 40, 50, 60, 70, 85, 100, 105, 135,
    150, 200, 300, 400, 500, 600, 800,
  ],
  exposureTime: [
    1 / 8000, 1 / 4000, 1 / 2000, 1 / 1000, 1 / 500, 1 / 250, 1 / 125, 1 / 60,
    1 / 30, 1 / 15, 1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8, 15, 30, 60, 120, 300,
  ],
  aperture: [1, 1.2, 1.4, 1.8, 2, 2.8, 4, 5.6, 8, 11, 16, 22, 32, 45, 64],
  iso: [
    50, 64, 100, 200, 400, 800, 1600, 3200, 6400, 12800, 25600, 51200, 102400,
  ],
};

/** The values offered for a range: its ends and the usual stops between them. */
export function rangeStops(
  key: MetadataRangeKey,
  range: { min: number; max: number },
) {
  return [
    range.min,
    ...STOPS[key].filter((stop) => stop > range.min && stop < range.max),
    ...(range.max > range.min ? [range.max] : []),
  ];
}
