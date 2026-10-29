export type CatalogCategory = { id: string; name: string };
export type CollectionEntry = {
  photoId: string;
  columns: number;
  rows: number;
  /** Absent means shown, as for collections saved before the option existed. */
  showTitle?: boolean;
};
export type CollectionDraft = {
  version?: number;
  /** Whether the public mosaic lets visitors switch each work's variant. */
  showVariants?: boolean;
  coverPhotoId?: string | null;
  title: string;
  description?: string | null;
  categoryIds: string[];
  entries: CollectionEntry[];
};
export type CatalogCollection = {
  version?: number;
  showVariants?: boolean;
  coverPhotoId?: string | null;
  id: string;
  title: string;
  description?: string | null;
  categories: CatalogCategory[];
  entries: CollectionEntry[];
};
export type CatalogWork = {
  version?: number;
  id: string;
  title: string;
  variants: { photoId: string }[];
};
export type WorkDraft = { version?: number; title: string; photoIds: string[] };
export type Catalog = {
  collections: CatalogCollection[];
  categories: CatalogCategory[];
  works: CatalogWork[];
  photos: { id: string; categories: { id: string }[] }[];
};
