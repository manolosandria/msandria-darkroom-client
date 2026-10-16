"use client";
import { useCallback, useEffect, useState } from "react";
import { Catalog } from "@/src/domain/entities/Catalog";
import { selectCatalog } from "@/src/domain/catalogSelection";
import { editCatalog } from "@/src/infrastructure/catalogServices";
import { CollectionMosaic } from "./CollectionMosaic";
import { GetAllPhotos } from "@/src/application/use-cases/GetAllPhotos";
import { getAllPhotos as defaultGetAllPhotos } from "@/src/infrastructure/photoServices";
import { usePhotoFetch } from "@/src/ui/hooks/usePhotoFetch";
import { PhotoFetchStatus } from "./PhotoFetchStatus";
import { PhotoGrid } from "./PhotoGrid";

interface GalleryProps {
  getAllPhotos?: Pick<GetAllPhotos, "execute">;
}

export default function Gallery({
  getAllPhotos = defaultGetAllPhotos,
}: GalleryProps) {
  const fetchAllPhotos = useCallback(
    () => getAllPhotos.execute(),
    [getAllPhotos],
  );
  const {
    data: photos,
    loading,
    error,
    retry,
  } = usePhotoFetch(fetchAllPhotos, "No photos found");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [collectionId, setCollectionId] = useState("");
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
    photos && catalog
      ? selectCatalog(photos, catalog, categoryId, collectionId)
      : null;

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="mx-auto w-full max-w-[120rem]">
        <h1 className="text-4xl font-bold">Galería</h1>
        {catalogError && (
          <p role="alert">
            Collections could not be loaded.{" "}
            <button onClick={loadCatalog}>Reload collections</button>
          </p>
        )}
        {catalog && (
          <div className="catalog-filters">
            <label>
              Category{" "}
              <select
                value={categoryId}
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  setCollectionId("");
                }}
              >
                <option value="">All categories</option>
                {catalog.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Collection{" "}
              <select
                value={collectionId}
                onChange={(event) => setCollectionId(event.target.value)}
              >
                <option value="">All photos</option>
                {catalog.collections
                  .filter(
                    (collection) =>
                      !categoryId ||
                      collection.categories.some(
                        (category) => category.id === categoryId,
                      ) ||
                      collection.entries.some((entry) =>
                        catalog.photos.some(
                          (photo) =>
                            photo.id === entry.photoId &&
                            photo.categories.some(
                              (category) => category.id === categoryId,
                            ),
                        ),
                      ),
                  )
                  .map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.title}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        )}

        <div className="mt-8">
          <PhotoFetchStatus loading={loading} error={error} onRetry={retry} />
          {photos &&
            (tiles ? (
              tiles.length ? (
                collectionId ||
                tiles.some((tile) => tile.variants.length > 1) ? (
                  <CollectionMosaic tiles={tiles} mosaic={!!collectionId} />
                ) : (
                  <PhotoGrid photos={tiles.map((tile) => tile.photo)} />
                )
              ) : (
                <p>No photos in this selection.</p>
              )
            ) : (
              <PhotoGrid photos={photos} />
            ))}
        </div>
      </div>
    </main>
  );
}
