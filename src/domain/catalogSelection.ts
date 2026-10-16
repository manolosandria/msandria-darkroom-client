import { Catalog, CollectionEntry } from "./entities/Catalog";
import { Photo } from "./entities/Photo";

export type CatalogTile = {
  key: string;
  photo: Photo;
  variants: Photo[];
  entry?: CollectionEntry;
};

export function selectCatalog(
  photos: Photo[],
  catalog: Catalog,
  categoryId: string,
  collectionId: string,
): CatalogTile[] {
  const collection = catalog.collections.find(
    (item) => item.id === collectionId,
  );
  if (collectionId && !collection) return [];
  const byId = new Map(photos.map((photo) => [photo.getId(), photo]));
  const source = collection
    ? collection.entries.flatMap((entry) => {
        const photo = byId.get(entry.photoId);
        return photo ? [{ photo, entry }] : [];
      })
    : photos.map((photo) => ({ photo, entry: undefined }));
  const categoryPhotos = new Set(
    catalog.photos
      .filter((photo) =>
        photo.categories.some((category) => category.id === categoryId),
      )
      .map((photo) => photo.id),
  );
  const categoryCollections = catalog.collections.filter((item) =>
    item.categories.some((category) => category.id === categoryId),
  );
  for (const item of categoryCollections)
    for (const entry of item.entries) categoryPhotos.add(entry.photoId);
  const seen = new Set<string>();
  return source.flatMap(({ photo, entry }) => {
    const work = catalog.works.find((item) =>
      item.variants.some((variant) => variant.photoId === photo.getId()),
    );
    const variants = work
      ? work.variants.flatMap((variant) => {
          const candidate = byId.get(variant.photoId);
          return candidate ? [candidate] : [];
        })
      : [photo];
    if (
      categoryId &&
      !variants.some((candidate) => categoryPhotos.has(candidate.getId()))
    )
      return [];
    const key = work ? `work:${work.id}` : `photo:${photo.getId()}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ key, photo, variants, entry }];
  });
}
