"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  CSSProperties,
  ReactNode,
} from "react";
import { Catalog } from "@/src/domain/entities/Catalog";

import { galleryCategories } from "@/src/infrastructure/catalogServices";
import { BrowsePhotos } from "@/src/application/use-cases/BrowsePhotos";
import { browsePhotos as defaultBrowsePhotos } from "@/src/infrastructure/photoServices";
import { usePhotoFetch } from "@/src/ui/hooks/usePhotoFetch";
import { PhotoFetchStatus } from "./PhotoFetchStatus";
import { GalleryVisitorControls } from "./GalleryVisitorControls";
import { GalleryTiles } from "./GalleryTiles";
import { GalleryFilters } from "./GalleryFilters";
import { galleryDepartments } from "./galleryCategoryGroups";
import {
  defaultGallerySettings,
  defaultGalleryPageLayout,
  GalleryPageBlock,
  GallerySettings,
  galleryFonts,
  defaultVisitorOptions,
} from "@/src/domain/entities/GallerySettings";
import { manageGallerySettings } from "@/src/infrastructure/gallerySettingsServices";
import {
  readGalleryState,
  writeGalleryState,
} from "@/src/ui/galleryNavigationState";
import "./galleryStudio.css";

import "./publicCatalog.css";

export default function Gallery({
  browsePhotos = defaultBrowsePhotos,
  settings: previewSettings,
}: {
  browsePhotos?: Pick<BrowsePhotos, "execute">;
  settings?: GallerySettings;
}) {
  const [storedSettings, setStoredSettings] = useState(defaultGallerySettings);
  // The first page waits for the saved settings, whose layout shapes the request, so a
  // visit sends one query instead of one per default it later corrects.
  const [settingsReady, setSettingsReady] = useState(!!previewSettings);
  useEffect(() => {
    if (!previewSettings)
      void manageGallerySettings
        .get()
        .then(setStoredSettings)
        .catch(() => {})
        .finally(() => setSettingsReady(true));
  }, [previewSettings]);
  const settings = previewSettings ?? storedSettings;
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [display, setDisplay] = useState<{
    layout?: string;
    crops?: string;
  }>({});
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const loadCatalog = useCallback(async () => {
    try {
      setCatalog(await galleryCategories.load());
      setCatalogError(false);
    } catch {
      setCatalogError(true);
    }
  }, []);
  // The URL and the tab keep the visitor's place, so returning from a photo shows the
  // same order, page, search and filters. Read after mounting: the server has neither.
  const [seed, setSeed] = useState("");
  const [settledSearch, setSettledSearch] = useState("");
  useEffect(() => {
    queueMicrotask(() => {
      const state = readGalleryState(!previewSettings);
      setCategoryIds(state.categories);
      setQuery(state.search);
      setSettledSearch(state.search);
      setPage(state.page);
      setDisplay(state.display);
      setSeed(state.seed);
      void loadCatalog();
    });
    // Read once on arrival; a preview's settings change does not reset the place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadCatalog]);
  // Chosen categories wait for the catalog, which says which group each belongs to.
  const ready =
    seed !== "" &&
    settingsReady &&
    (categoryIds.length === 0 || Boolean(catalog) || catalogError);
  const categoryGroups = catalog
    ? galleryDepartments(catalog.categories, settings)
        .map((group) =>
          group.categories
            .filter((category) => categoryIds.includes(category.id))
            .map((category) => category.id),
        )
        .filter((ids) => ids.length > 0)
    : categoryIds.map((id) => [id]);
  const categoriesParam =
    categoryGroups.map((ids) => ids.join(",")).join("|") || undefined;
  // The first chosen category with its own look themes the whole page.
  const categoryStyle = categoryIds
    .map((id) =>
      settings.categories.find(
        (item) => item.categoryId === id && item.customize,
      ),
    )
    .find(Boolean);
  const appearance = categoryStyle?.customize
    ? categoryStyle.appearance
    : settings.appearance;
  const options = settings.visitorOptions ?? defaultVisitorOptions;
  const allowed = (
    requested: string | undefined,
    fallback: string,
    choices: string[],
  ) =>
    choices.includes(requested ?? "")
      ? requested!
      : choices.includes(fallback)
        ? fallback
        : choices[0];
  const layout = allowed(display.layout, appearance.layout, options.layouts);
  const crops = allowed(display.crops, "mixed", options.crops);
  const context = { layout, crops };
  useEffect(() => {
    if (ready && !previewSettings)
      writeGalleryState({
        categories: categoryIds,
        search: settledSearch,
        page,
        display,
      });
  }, [ready, previewSettings, categoryIds, settledSearch, page, display]);
  useEffect(() => {
    const timer = setTimeout(() => setSettledSearch(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);
  const abort = useRef<AbortController | null>(null);
  const pageLock = useRef(false);
  const cooldown = useRef(0);
  const fetchPhotos = useCallback(async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    pageLock.current = true;
    try {
      return await browsePhotos.execute(
        {
          page,
          limit: 12,
          seed,
          categories: categoriesParam,
          search: settledSearch,
          layout,
          crops,
        },
        controller.signal,
      );
    } finally {
      if (abort.current === controller) pageLock.current = false;
    }
  }, [browsePhotos, page, seed, categoriesParam, settledSearch, layout, crops]);
  useEffect(() => () => abort.current?.abort(), []);
  const {
    data: result,
    loading,
    error,
    retry,
  } = usePhotoFetch(
    fetchPhotos,
    "No photos found",
    "Photos could not be loaded. Please wait a moment before retrying.",
    ready,
    true,
  );
  const count = result?.total ?? 0;
  const pages = Math.max(1, Math.ceil(count / (result?.limit ?? 12)));
  const currentPage = page;
  const visible = result?.tiles;
  const navigate = (next: number) => {
    if (loading || pageLock.current || Date.now() < cooldown.current) return;
    pageLock.current = true;
    cooldown.current = Date.now() + 500;
    setPage(next);
  };
  const style = {
    "--gallery-background": appearance.background,
    "--gallery-text": appearance.text,
    "--gallery-accent": appearance.accent,
    "--gallery-surface": appearance.surface,
    "--gallery-font": galleryFonts[appearance.font],
    "--gallery-size": `${appearance.tileSize}px`,
    "--gallery-size-factor": 1,
    "--gallery-mobile-columns": 2,
    "--gallery-gap": `${appearance.gap}px`,
  } as CSSProperties;
  const pageLayout = settings.pageLayout ?? defaultGalleryPageLayout;
  const order = pageLayout.groups.flat();
  // Title and filters that follow each other can sit side by side, inside one card or
  // as two cards in a row.
  const paired =
    pageLayout.filtersPlacement === "side" &&
    Math.abs(order.indexOf("heading") - order.indexOf("filters")) === 1;
  const filtersFirst = order.indexOf("filters") < order.indexOf("heading");
  const blocks: Record<GalleryPageBlock, ReactNode> = {
    heading: (
      <header
        className="gallery-heading"
        data-align={pageLayout.headingAlign}
      >
        <h1 className="gallery-sr-only">Gallery</h1>
        {settings.blocks
          .filter((block) => block.text.trim())
          .map((block, index) => (
            <p
              key={index}
              className={`gallery-heading__${block.kind}`}
              style={
                {
                  "--block-size": `${block.size}px`,
                  fontFamily:
                    galleryFonts[
                      categoryStyle?.customize
                        ? appearance.font
                        : block.font === "inherit"
                          ? appearance.font
                          : block.font
                    ],
                } as CSSProperties
              }
            >
              {block.text}
            </p>
          ))}
      </header>
    ),
    filters: (
      <GalleryFilters
        categories={catalog?.categories ?? []}
        settings={settings}
        selected={categoryIds}
        layout={settings.filterLayout}
        anchor={paired && filtersFirst ? "start" : "end"}
        onChange={(ids) => {
          setCategoryIds(ids);
          setPage(1);
        }}
        search={
          <label className="gallery-search">
            <span className="gallery-sr-only">Search the archive</span>
            <span className="gallery-search__field">
              <svg
                viewBox="0 0 20 20"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <circle cx="8.5" cy="8.5" r="5.5" />
                <path d="M13 13l4.5 4.5" />
              </svg>
              <input
                type="search"
                placeholder="Search the archive"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
            </span>
          </label>
        }
        count={
          <span className="gallery-filter-count" aria-live="polite">
            {count} {count === 1 ? "photograph" : "photographs"}
          </span>
        }
        display={
          <GalleryVisitorControls
            options={options}
            layout={layout}
            crops={crops}
            onChange={(key, value) => {
              setDisplay((previous) => ({ ...previous, [key]: value }));
              setPage(1);
            }}
          />
        }
      />
    ),
    photos: (
      <div className="gallery-photos">
        {catalogError && (
          <p role="alert">
            Categories could not be loaded.{" "}
            <button onClick={loadCatalog}>Reload categories</button>
          </p>
        )}
        <PhotoFetchStatus loading={loading} error={error} onRetry={retry} />
        {visible &&
          (visible.length ? (
            <div
              aria-busy={loading}
              className={loading ? "gallery-loading" : undefined}
            >
              <GalleryTiles tiles={visible} layout={layout} context={context} />
            </div>
          ) : (
            <p>No photos in this selection.</p>
          ))}
        {count > 0 && (
          <nav className="gallery-pagination" aria-label="Gallery pagination">
            <button
              disabled={loading || currentPage === 1}
              onClick={() => navigate(currentPage - 1)}
            >
              ← Previous
            </button>
            <span aria-live="polite">
              Page {currentPage} of {pages}
            </span>
            <button
              disabled={loading || currentPage >= pages}
              onClick={() => navigate(currentPage + 1)}
            >
              Next →
            </button>
          </nav>
        )}
      </div>
    ),
  };
  // Inside a card, a paired title and filters share one row.
  const cardContent = (group: GalleryPageBlock[]) => {
    const items: ReactNode[] = [];
    for (let index = 0; index < group.length; index++) {
      const block = group[index];
      const next = group[index + 1];
      if (
        paired &&
        next &&
        [block, next].includes("heading") &&
        [block, next].includes("filters")
      ) {
        items.push(
          <div key={block} className="gallery-card__row">
            {blocks[block]}
            {blocks[next]}
          </div>,
        );
        index++;
      } else items.push(<div key={block}>{blocks[block]}</div>);
    }
    return items;
  };
  const card = (group: GalleryPageBlock[]) => (
    <div
      key={group.join("-")}
      className="gallery-card"
      data-blocks={group.join(" ")}
    >
      {cardContent(group)}
    </div>
  );
  // Two cards holding a paired title and filters alone sit in a row.
  const cards: ReactNode[] = [];
  for (let index = 0; index < pageLayout.groups.length; index++) {
    const group = pageLayout.groups[index];
    const next = pageLayout.groups[index + 1];
    const pair = next && [group, next].every((item) => item.length === 1);
    if (
      paired &&
      pair &&
      [group[0], next[0]].includes("heading") &&
      [group[0], next[0]].includes("filters")
    ) {
      cards.push(
        <div key="row" className="gallery-cards-row">
          {card(group)}
          {card(next)}
        </div>,
      );
      index++;
    } else cards.push(card(group));
  }
  return (
    <main
      className="public-catalog public-gallery gallery-styled"
      style={style}
    >
      {cards}
    </main>
  );
}
