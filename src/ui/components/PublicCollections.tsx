"use client";
import { useCallback, useState } from "react";
import { CatalogCollection } from "@/src/domain/entities/Catalog";
import { selectCatalog } from "@/src/domain/catalogSelection";
import { editCatalog } from "@/src/infrastructure/catalogServices";
import { getCollectionPhotos } from "@/src/infrastructure/photoServices";
import { usePhotoFetch } from "@/src/ui/hooks/usePhotoFetch";
import { PhotoFetchStatus } from "./PhotoFetchStatus";
import { PhotoImage } from "./PhotoImage";
import { CollectionMosaic } from "./CollectionMosaic";
import "./publicCatalog.css";

export default function PublicCollections() {
  const loadCatalog = useCallback(() => editCatalog.load(), []);
  const { data: catalog, loading, error, retry } = usePhotoFetch(loadCatalog, "No collections found", "Collections could not be loaded");
  const [selected, setSelected] = useState("");
  const collection = catalog?.collections.find(item => item.id === selected);
  return <main className="public-catalog">
    <div className="public-catalog__heading"><div><p className="public-catalog__eyebrow">Stories in photographs</p><h1>{collection?.title ?? "Collections"}</h1><p>{collection?.description ?? (collection ? "" : "A place, a moment, a point of view. Choose a collection to explore.")}</p></div></div>
    <PhotoFetchStatus loading={loading} error={error} onRetry={retry} />
    {catalog && (collection ? <><button className="collection-back" onClick={() => setSelected("")}>← All collections</button><CollectionContents key={collection.id} collection={collection} catalog={catalog} /></> : catalog.collections.length ? <ul className="public-collections">{catalog.collections.map(item => <CollectionCover key={item.id} collection={item} onOpen={() => setSelected(item.id)} />)}</ul> : <p>No collections yet.</p>)}
  </main>;
}

function CollectionCover({ collection, onOpen }: { collection: CatalogCollection; onOpen: () => void }) {
  const load = useCallback(() => getCollectionPhotos(collection.id).execute(), [collection.id]);
  const { data: photos, loading, error, retry } = usePhotoFetch(load, "No cover available");
  const cover = photos?.find(photo => photo.getId() === collection.coverPhotoId)
    ?? photos?.find(photo => collection.entries.some(entry => entry.photoId === photo.getId()));
  return <li className="public-collection">
    <button onClick={onOpen} className="public-collection__open">
      <div className="public-collection__cover">{cover ? <PhotoImage photo={cover} maxWidth={640} fallbackSizes="(max-width: 640px) 100vw, 33vw" className="object-cover" /> : <span>{loading ? "Loading cover…" : "Collection"}</span>}<span className="public-collection__arrow" aria-hidden="true">↗</span></div>
      <div className="public-collection__text"><p className="public-catalog__eyebrow">{collection.entries.length} photographs</p><h2>{collection.title}</h2>{collection.description && <p className="public-collection__description">{collection.description}</p>}</div>
    </button>
    {error && <button className="collection-back" onClick={retry}>Retry cover</button>}
  </li>;
}

function CollectionContents({ collection, catalog }: { collection: CatalogCollection; catalog: Parameters<typeof selectCatalog>[1] }) {
  const load = useCallback(() => getCollectionPhotos(collection.id).execute(), [collection.id]);
  const { data: photos, loading, error, retry } = usePhotoFetch(load, "No photos in this collection.");
  return <><PhotoFetchStatus loading={loading} error={error} onRetry={retry} />{photos && <CollectionMosaic tiles={selectCatalog(photos, catalog, "", collection.id)} mosaic />}</>;
}
