export type CatalogCategory = { id: string; name: string };
export type CollectionEntry = {
  photoId: string;
  columns: number;
  rows: number;
};
export type CollectionDraft = {
  coverPhotoId?: string | null;
  title: string;
  categoryIds: string[];
  entries: CollectionEntry[];
};
export type CatalogCollection = {
  coverPhotoId?: string | null;
  id: string;
  title: string;
  categories: CatalogCategory[];
  entries: CollectionEntry[];
};
export type CatalogWork = {
  id: string;
  title: string;
  variants: { photoId: string }[];
};
export type WorkDraft = { title: string; photoIds: string[] };
export type Catalog = {
  collections: CatalogCollection[];
  categories: CatalogCategory[];
  works: CatalogWork[];
  photos: { id: string; categories: { id: string }[] }[];
};
