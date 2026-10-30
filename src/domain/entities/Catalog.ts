export type CatalogCategory = { id: string; name: string };
/**
 * A piece's size in cells: eight columns on wide screens, four on phones. Without
 * its own phone size, a piece takes one derived from the wide one (`mobileSpan`).
 */
export type MosaicSize = {
  columns: number;
  rows: number;
  mobileColumns?: number | null;
  mobileRows?: number | null;
};
export type CollectionEntry = MosaicSize & {
  photoId: string;
  /** Absent means shown, as for collections saved before the option existed. */
  showTitle?: boolean;
  /** Text shown with the photo, inside the same piece of the mosaic. */
  caption?: string | null;
  /** The entry's place among the collection's photos, as the API returns it. */
  position?: number;
};
export const COLLECTION_TEXT_STYLES = ["HEADING", "BODY", "QUOTE"] as const;
export const COLLECTION_TEXT_ALIGNS = ["START", "CENTER", "END"] as const;
export type CollectionTextStyle = (typeof COLLECTION_TEXT_STYLES)[number];
export type CollectionTextAlign = (typeof COLLECTION_TEXT_ALIGNS)[number];
/**
 * A text block standing on its own in the mosaic. `position` counts the photos
 * before it, so it stays ahead of the same photo when others come and go.
 */
export type CollectionText = MosaicSize & {
  position: number;
  text: string;
  style?: CollectionTextStyle;
  align?: CollectionTextAlign;
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
  /** Omitted keeps the saved blocks; an empty list removes them. */
  texts?: CollectionText[];
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
  /** Absent from an API older than text blocks. */
  texts?: CollectionText[];
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
