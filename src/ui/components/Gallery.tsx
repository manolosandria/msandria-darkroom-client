"use client";
import { useCallback, useEffect, useState } from "react";
import { Catalog } from "@/src/domain/entities/Catalog";
import { selectCatalog } from "@/src/domain/catalogSelection";
import { editCatalog } from "@/src/infrastructure/catalogServices";
import { GetAllPhotos } from "@/src/application/use-cases/GetAllPhotos";
import { getAllPhotos as defaultGetAllPhotos } from "@/src/infrastructure/photoServices";
import { usePhotoFetch } from "@/src/ui/hooks/usePhotoFetch";
import { PhotoFetchStatus } from "./PhotoFetchStatus";
import { CollectionMosaic } from "./CollectionMosaic";
import { PhotoGrid } from "./PhotoGrid";
import "./publicCatalog.css";

export default function Gallery({
  getAllPhotos = defaultGetAllPhotos,
}: {
  getAllPhotos?: Pick<GetAllPhotos, "execute">;
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
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [categoryId, setCategoryId] = useState("");
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
    queueMicrotask(() => void loadCatalog());
  }, [loadCatalog]);
  const tiles =
    photos && catalog ? selectCatalog(photos, catalog, categoryId, "") : null;
  const count = tiles?.length ?? photos?.length ?? 0;
  const pages = Math.max(1, Math.ceil(count / 12));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * 12;
  const visible = tiles?.slice(start, start + 12);
  return (
    <main className="public-catalog">
      <div className="public-catalog__heading">
        <div>
          <p className="public-catalog__eyebrow">Explore the archive</p>
          <h1>Gallery</h1>
          <p>A fresh perspective, twelve photographs at a time.</p>
        </div>
        {catalog && (
          <aside className="gallery-filter" aria-label="Gallery filters">
            <label htmlFor="gallery-category">Filter by category</label>
            <select
              id="gallery-category"
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All categories</option>
              {catalog.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </aside>
        )}
      </div>
      {catalog && (
        <div className="gallery-category-chips" aria-label="Choose a category">
          {[{ id: "", name: "All photographs" }, ...catalog.categories].map(
            (category) => (
              <button
                key={category.id}
                aria-pressed={categoryId === category.id}
                onClick={() => {
                  setCategoryId(category.id);
                  setPage(1);
                }}
              >
                {category.name}
              </button>
            ),
          )}
          <span>{count} photographs</span>
        </div>
      )}
      {catalogError && (
        <p role="alert">
          Categories could not be loaded.{" "}
          <button onClick={loadCatalog}>Reload categories</button>
        </p>
      )}
      <PhotoFetchStatus loading={loading} error={error} onRetry={retry} />
      {photos &&
        (visible ? (
          visible.length ? (
            visible.some((tile) => tile.variants.length > 1) ? (
              <CollectionMosaic tiles={visible} mosaic={false} />
            ) : (
              <PhotoGrid photos={visible.map((tile) => tile.photo)} />
            )
          ) : (
            <p>No photos in this selection.</p>
          )
        ) : (
          <PhotoGrid photos={photos.slice(start, start + 12)} />
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
