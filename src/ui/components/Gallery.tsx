"use client";
import { useCallback, useEffect, useState, CSSProperties } from "react";
import { Catalog } from "@/src/domain/entities/Catalog";
import { selectCatalog } from "@/src/domain/catalogSelection";
import { editCatalog } from "@/src/infrastructure/catalogServices";
import { GetAllPhotos } from "@/src/application/use-cases/GetAllPhotos";
import { getAllPhotos as defaultGetAllPhotos } from "@/src/infrastructure/photoServices";
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
import "./galleryStudio.css";
import { enabledPhotoViews } from "@/src/domain/photoPresentation";
import "./publicCatalog.css";

export default function Gallery({
  getAllPhotos = defaultGetAllPhotos,
  settings: previewSettings,
}: {
  getAllPhotos?: Pick<GetAllPhotos, "execute">;
  settings?: GallerySettings;
}) {
  const fetchPhotos = useCallback(async () => {
    const result = await getAllPhotos.execute();
    if (!result) return result;
    const shuffled = [...result];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [getAllPhotos]);
  const {
    data: photos,
    loading,
    error,
    retry,
  } = usePhotoFetch(fetchPhotos, "No photos found");
  const [storedSettings, setStoredSettings] = useState(defaultGallerySettings);
  useEffect(() => {
    if (!previewSettings)
      void manageGallerySettings
        .get()
        .then(setStoredSettings)
        .catch(() => {});
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
      setCatalog(await editCatalog.load());
      setCatalogError(false);
    } catch {
      setCatalogError(true);
    }
  }, []);
  useEffect(() => {
    queueMicrotask(() => {
      setCategoryId(
        new URLSearchParams(window.location.search).get("category") ?? "",
      );
      void loadCatalog();
    });
  }, [loadCatalog]);
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  const search = normalize(query);
  const matchingCategories = new Set(
    catalog?.categories
      .filter((category) => normalize(category.name).includes(search))
      .map((category) => category.id),
  );
  const categoryPhotos = new Set(
    catalog?.photos
      .filter((photo) =>
        photo.categories.some((category) =>
          matchingCategories.has(category.id),
        ),
      )
      .map((photo) => photo.id),
  );
  for (const collection of catalog?.collections ?? [])
    if (
      collection.categories.some((category) =>
        matchingCategories.has(category.id),
      )
    ) {
      for (const entry of collection.entries) categoryPhotos.add(entry.photoId);
    }
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
  const eligible = photos?.filter(
    (photo) =>
      enabledPhotoViews(photo, "gallery", context).length > 0 &&
      (!search ||
        normalize(photo.getTitle()).includes(search) ||
        categoryPhotos.has(photo.getId())),
  );
  const tiles = eligible
    ? selectCatalog(
        eligible,
        catalog ?? { photos: [], works: [], categories: [], collections: [] },
        categoryId,
        "",
      )
    : null;
  const count = tiles?.length ?? photos?.length ?? 0;
  const pages = Math.max(1, Math.ceil(count / 12));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * 12;
  const visible = tiles?.slice(start, start + 12);
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
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            ← Previous
          </button>
          <span aria-live="polite">
            Page {currentPage} of {pages}
          </span>
          <button
            disabled={currentPage === pages}
            onClick={() => setPage(currentPage + 1)}
          >
            Next →
          </button>
        </nav>
      )}
    </main>
  );
}
