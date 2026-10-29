"use client";
import { useCallback, useEffect, useRef, useState, CSSProperties } from "react";
import { Catalog } from "@/src/domain/entities/Catalog";

import { galleryCategories } from "@/src/infrastructure/catalogServices";
import { BrowsePhotos } from "@/src/application/use-cases/BrowsePhotos";
import { browsePhotos as defaultBrowsePhotos } from "@/src/infrastructure/photoServices";
import { usePhotoFetch } from "@/src/ui/hooks/usePhotoFetch";
import { PhotoFetchStatus } from "./PhotoFetchStatus";
import { GalleryVisitorControls } from "./GalleryVisitorControls";
import { GalleryTiles } from "./GalleryTiles";
import { GalleryFilters } from "./GalleryFilters";
import {
  defaultGallerySettings,
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
  const [categoryId, setCategoryId] = useState("");
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
      setCategoryId(state.category);
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
  const ready = seed !== "" && settingsReady;
  const categoryStyle = settings.categories.find(
    (item) => item.categoryId === categoryId,
  );
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
        category: categoryId,
        search: settledSearch,
        page,
        display,
      });
  }, [ready, previewSettings, categoryId, settledSearch, page, display]);
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
          category: categoryId || undefined,
          search: settledSearch,
          layout,
          crops,
        },
        controller.signal,
      );
    } finally {
      if (abort.current === controller) pageLock.current = false;
    }
  }, [browsePhotos, page, seed, categoryId, settledSearch, layout, crops]);
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
  return (
    <main
      className="public-catalog public-gallery gallery-styled"
      style={style}
    >
      <div className="gallery-introduction">
        <header className="gallery-heading">
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
        <div className="gallery-tools">
          <label className="gallery-search">
            Search the archive
            <input
              type="search"
              placeholder="Photo title or category"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </label>
          {catalog && (
            <GalleryFilters
              categories={catalog.categories}
              settings={settings}
              selected={categoryId}
              onSelect={(id) => {
                setCategoryId(id);
                setPage(1);
              }}
            />
          )}
        </div>
      </div>
      {catalogError && (
        <p role="alert">
          Categories could not be loaded.{" "}
          <button onClick={loadCatalog}>Reload categories</button>
        </p>
      )}
      <PhotoFetchStatus loading={loading} error={error} onRetry={retry} />
      <div className="gallery-grid-toolbar">
        <GalleryVisitorControls
          options={options}
          layout={layout}
          crops={crops}
          onChange={(key, value) => {
            setDisplay((previous) => ({ ...previous, [key]: value }));
            setPage(1);
          }}
        />
        <span className="gallery-filter-count" aria-live="polite">
          {count} {count === 1 ? "photograph" : "photographs"}
        </span>
      </div>
      {visible &&
        (visible.length ? (
          <GalleryTiles tiles={visible} layout={layout} context={context} />
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
    </main>
  );
}
