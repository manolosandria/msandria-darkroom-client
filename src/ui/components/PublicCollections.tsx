"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Photo } from "@/src/domain/entities/Photo";
import { CatalogCollection } from "@/src/domain/entities/Catalog";
import { selectCatalog } from "@/src/domain/catalogSelection";
import { editCatalog } from "@/src/infrastructure/catalogServices";
import {
  getCollectionCovers,
  browsePhotos,
} from "@/src/infrastructure/photoServices";
import { usePhotoFetch } from "@/src/ui/hooks/usePhotoFetch";
import { PhotoFetchStatus } from "./PhotoFetchStatus";
import { PhotoImage } from "./PhotoImage";
import { CollectionMosaic } from "./CollectionMosaic";
import { textsForPage } from "@/src/domain/collectionLayout";
import "./publicCatalog.css";
import { EmptyState } from "./EmptyState";

export default function PublicCollections() {
  const loadCatalog = useCallback(() => editCatalog.load(), []);
  const {
    data: catalog,
    loading,
    error,
    retry,
  } = usePhotoFetch(
    loadCatalog,
    "No collections found",
    "Collections could not be loaded",
  );
  const loadCovers = useCallback(() => getCollectionCovers.execute(), []);
  const {
    data: covers,
    error: coversError,
    retry: retryCovers,
  } = usePhotoFetch(loadCovers, "", "Covers could not be loaded");
  const [selected, setSelected] = useState("");
  useEffect(() => {
    queueMicrotask(() =>
      setSelected(
        new URLSearchParams(window.location.search).get("collection") ?? "",
      ),
    );
  }, []);
  const collection = catalog?.collections.find((item) => item.id === selected);
  return (
    <main className="public-catalog">
      <div className="public-catalog__heading">
        <div>
          <p className="public-catalog__eyebrow">Stories in photographs</p>
          <h1>{collection?.title ?? "Collections"}</h1>
          <p>
            {collection?.description ??
              (collection
                ? ""
                : "A place, a moment, a point of view. Choose a collection to explore.")}
          </p>
        </div>
      </div>
      <PhotoFetchStatus loading={loading} error={error} onRetry={retry} />
      {coversError && (
        <p role="alert">
          {coversError} <button onClick={retryCovers}>Retry covers</button>
        </p>
      )}
      {catalog &&
        (collection ? (
          <>
            <button className="collection-back" onClick={() => setSelected("")}>
              ← All collections
            </button>
            <CollectionContents
              key={collection.id}
              collection={collection}
              catalog={catalog}
            />
          </>
        ) : catalog.collections.length ? (
          <ul className="public-collections">
            {catalog.collections.map((item) => (
              <CollectionCover
                key={item.id}
                collection={item}
                photos={covers ?? []}
                onOpen={() => setSelected(item.id)}
              />
            ))}
          </ul>
        ) : (
          <EmptyState picture="collections" title="No collections yet." />
        ))}
    </main>
  );
}

function CollectionCover({
  collection,
  photos,
  onOpen,
}: {
  collection: CatalogCollection;
  photos: Photo[];
  onOpen: () => void;
}) {
  const cover =
    photos?.find((photo) => photo.getId() === collection.coverPhotoId) ??
    photos?.find((photo) =>
      collection.entries.some((entry) => entry.photoId === photo.getId()),
    );
  return (
    <li className="public-collection">
      <button onClick={onOpen} className="public-collection__open">
        <div className="public-collection__cover">
          {cover ? (
            <PhotoImage
              photo={cover}
              maxWidth={640}
              fallbackSizes="(max-width: 640px) 100vw, 33vw"
              className="object-cover"
            />
          ) : (
            <span>Collection</span>
          )}
          <span className="public-collection__arrow" aria-hidden="true">
            ↗
          </span>
        </div>
        <div className="public-collection__text">
          <p className="public-catalog__eyebrow">
            {collection.entries.length} photographs
          </p>
          <h2>{collection.title}</h2>
          {collection.description && (
            <p className="public-collection__description">
              {collection.description}
            </p>
          )}
        </div>
      </button>
    </li>
  );
}

function CollectionContents({
  collection,
  catalog,
}: {
  collection: CatalogCollection;
  catalog: Parameters<typeof selectCatalog>[1];
}) {
  const [page, setPage] = useState(1);
  const gate = useRef(0);
  const load = useCallback(
    () =>
      browsePhotos.execute({
        target: "collection",
        collection: collection.id,
        page,
        limit: 60,
      }),
    [collection.id, page],
  );
  const {
    data: result,
    loading,
    error,
    retry,
  } = usePhotoFetch(load, "No photos in this collection.");
  const photos = result?.tiles.flatMap((tile) => tile.variants);
  const changePage = (next: number) => {
    if (loading || Date.now() < gate.current) return;
    gate.current = Date.now() + 500;
    setPage(next);
  };
  const pages = Math.max(1, Math.ceil((result?.total ?? 0) / 60));
  const tiles = photos && selectCatalog(photos, catalog, "", collection.id);
  return (
    <>
      <PhotoFetchStatus loading={loading} error={error} onRetry={retry} />
      {photos && tiles && (
        <CollectionMosaic
          tiles={tiles}
          mosaic
          variants={collection.showVariants === true}
          texts={textsForPage(
            collection.texts ?? [],
            collection.entries.map((entry, index) => entry.position ?? index),
            tiles.flatMap((tile) =>
              tile.entry?.position !== undefined ? [tile.entry.position] : [],
            ),
            page >= pages,
          )}
        />
      )}
      {result && pages > 1 && (
        <nav aria-label="Collection pagination">
          <button
            disabled={loading || page === 1}
            onClick={() => changePage(page - 1)}
          >
            ← Previous
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button
            disabled={loading || page >= pages}
            onClick={() => changePage(page + 1)}
          >
            Next →
          </button>
        </nav>
      )}
    </>
  );
}
