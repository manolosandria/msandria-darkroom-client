import { Catalog, CollectionDraft, WorkDraft } from "../entities/Catalog";

export interface CatalogRepository {
  load(): Promise<Catalog>;
  saveCollection(draft: CollectionDraft, id?: string): Promise<void>;
  saveCategory(name: string, id?: string): Promise<void>;
  saveWork(draft: WorkDraft, id?: string): Promise<void>;
  setPhotoCategories(id: string, categoryIds: string[]): Promise<void>;
  remove(
    kind: "collections" | "categories" | "works",
    id: string,
  ): Promise<void>;
}
