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
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
  if (url !== `${window.location.pathname}${window.location.search}`)
    window.history.replaceState(null, "", url);
}
