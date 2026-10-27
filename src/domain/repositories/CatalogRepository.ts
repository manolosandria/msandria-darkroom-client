import { Catalog, CatalogCollection, CatalogWork, CollectionDraft, WorkDraft } from "../entities/Catalog";

export interface CatalogRepository {
  load(): Promise<Catalog>;
  saveCollection(draft: CollectionDraft, id?: string): Promise<CatalogCollection>;
  saveCategory(name: string, id?: string): Promise<void>;
  saveWork(draft: WorkDraft, id?: string): Promise<CatalogWork>;
  setPhotoCategories(id: string, categoryIds: string[]): Promise<void>;
  remove(
    kind: "collections" | "categories" | "works",
    id: string,
  ): Promise<void>;
}
