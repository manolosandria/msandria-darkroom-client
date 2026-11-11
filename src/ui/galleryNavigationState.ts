import {
  emptyMetadataFilters,
  MAX_EQUIPMENT_FILTERS,
  METADATA_RANGE_KEYS,
  METADATA_RANGE_LIMITS,
  METADATA_RANGE_PARAMS,
  PhotoMetadataFilters,
} from "@/src/domain/entities/PhotoMetadataFilters";

// Where the visitor is in Gallery: the category, search, page and display in the URL, so
// they survive a trip to a photo and back and can be shared; the shuffle seed in the
// tab, so the order stays the same until the tab closes.

const SEED_KEY = "gallerySeed";
const DISPLAY_KEYS = ["layout", "crops"] as const;

export type GalleryNavigationState = {
  /** Every chosen category; the URL keeps them comma-separated in `category`. */
  categories: string[];
  search: string;
  page: number;
  display: { layout?: string; crops?: string };
  /** Camera, lens, exposure ranges and tone; cameras and lenses repeat their key. */
  metadata: PhotoMetadataFilters;
};

function tabSeed() {
  try {
    const stored = window.sessionStorage.getItem(SEED_KEY);
    if (stored && /^\d{1,32}$/.test(stored)) return stored;
    const seed = String(Math.random()).slice(2) || "1";
    window.sessionStorage.setItem(SEED_KEY, seed);
    return seed;
  } catch {
    return String(Math.random()).slice(2) || "1";
  }
}

// Names as the API stores them: up to its own length limits, without control characters.
const equipment = (values: string[], length: number) =>
  [
    ...new Set(
      values.filter(
        (value) =>
          value &&
          value.length <= length &&
          ![...value].some((character) => character.charCodeAt(0) < 32),
      ),
    ),
  ].slice(0, MAX_EQUIPMENT_FILTERS);

// A number the API would accept for that range, or nothing.
const bound = (raw: string | null, limit: number, integer: boolean) => {
  if (raw === null || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) &&
    value >= 0 &&
    value <= limit &&
    (!integer || Number.isInteger(value))
    ? value
    : undefined;
};

export function readMetadataFilters(
  params: URLSearchParams,
): PhotoMetadataFilters {
  const filters = emptyMetadataFilters();
  filters.cameras = equipment(params.getAll("camera"), 201);
  filters.lenses = equipment(params.getAll("lens"), 100);
  for (const key of METADATA_RANGE_KEYS) {
    const min = bound(
      params.get(METADATA_RANGE_PARAMS[key].min),
      METADATA_RANGE_LIMITS[key],
      key === "iso",
    );
    const max = bound(
      params.get(METADATA_RANGE_PARAMS[key].max),
      METADATA_RANGE_LIMITS[key],
      key === "iso",
    );
    // A range the wrong way round describes nothing: its upper end is dropped.
    filters[key] = {
      ...(min !== undefined ? { min } : {}),
      ...(max !== undefined && (min === undefined || max >= min) ? { max } : {}),
    };
  }
  const tone = params.get("tone");
  if (tone === "color" || tone === "monochrome") filters.tone = tone;
  return filters;
}

function writeMetadataFilters(
  params: URLSearchParams,
  filters: PhotoMetadataFilters,
) {
  params.delete("camera");
  params.delete("lens");
  for (const camera of filters.cameras) params.append("camera", camera);
  for (const lens of filters.lenses) params.append("lens", lens);
  for (const key of METADATA_RANGE_KEYS)
    for (const end of ["min", "max"] as const) {
      const value = filters[key][end];
      const name = METADATA_RANGE_PARAMS[key][end];
      if (value === undefined) params.delete(name);
      else params.set(name, String(value));
    }
  if (filters.tone) params.set("tone", filters.tone);
  else params.delete("tone");
}

// `fromUrl` is false for the Curator preview, which lives on another page's URL.
export function readGalleryState(
  fromUrl = true,
): GalleryNavigationState & { seed: string } {
  const params = new URLSearchParams(fromUrl ? window.location.search : "");
  const page = Number(params.get("page"));
  const display: GalleryNavigationState["display"] = {};
  for (const key of DISPLAY_KEYS) {
    const value = params.get(key);
    if (value) display[key] = value;
  }
  return {
    categories: [
      ...new Set(
        (params.get("category") ?? "")
          .split(",")
          .filter((id) => /^[\w-]{1,128}$/.test(id)),
      ),
    ].slice(0, 20),
    search: (params.get("q") ?? "").slice(0, 120),
    page: Number.isInteger(page) && page >= 1 && page <= 10000 ? page : 1,
    display,
    metadata: readMetadataFilters(params),
    seed: tabSeed(),
  };
}

// Replaces the current entry: paging or filtering is not a step the Back button undoes.
// Parameters that belong to other features are kept.
export function writeGalleryState(state: GalleryNavigationState) {
  const params = new URLSearchParams(window.location.search);
  const set = (key: string, value: string | undefined) => {
    if (value) params.set(key, value);
    else params.delete(key);
  };
  set("category", state.categories.join(","));
  set("q", state.search);
  set("page", state.page > 1 ? String(state.page) : undefined);
  for (const key of DISPLAY_KEYS) set(key, state.display[key]);
  writeMetadataFilters(params, state.metadata);
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
  if (url !== `${window.location.pathname}${window.location.search}`)
    window.history.replaceState(null, "", url);
}
