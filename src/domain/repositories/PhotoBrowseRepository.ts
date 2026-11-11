import { CatalogTile } from "../catalogSelection";
import {
  PhotoFacets,
  PhotoMetadataFilters,
} from "../entities/PhotoMetadataFilters";

export type PhotoPageQuery = {
  page?: number;
  limit?: number;
  seed?: string;
  category?: string;
  /** Category groups separated by "|", ids by ",": a photo matches one id of each group. */
  categories?: string;
  collection?: string;
  search?: string;
  target?: "gallery" | "home" | "collection";
  layout?: string;
  /** Camera, lens, exposure ranges and tone; empty filters are left out. */
  metadata?: PhotoMetadataFilters;
};
export type PhotoPage = {
  page: number;
  limit: number;
  total: number;
  tiles: CatalogTile[];
};
export interface PhotoBrowseRepository {
  browse(query: PhotoPageQuery, signal?: AbortSignal): Promise<PhotoPage>;
}

/** What the public gallery's photographs offer to filter by. */
export interface PhotoFacetsRepository {
  facets(): Promise<PhotoFacets>;
}
