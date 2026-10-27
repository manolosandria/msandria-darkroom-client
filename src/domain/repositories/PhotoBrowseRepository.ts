import { CatalogTile } from "../catalogSelection";

export type PhotoPageQuery = {
  page?: number;
  limit?: number;
  seed?: string;
  category?: string;
  collection?: string;
  search?: string;
  target?: "gallery" | "home" | "collection";
  layout?: string;
  crops?: string;
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
