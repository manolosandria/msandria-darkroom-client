import { CatalogRepository } from "../../domain/repositories/CatalogRepository";
import { CollectionDraft, WorkDraft } from "../../domain/entities/Catalog";

export class EditCatalog {
  constructor(private readonly repository: CatalogRepository) {}
  load() {
    return this.repository.load();
  }
  saveCollection(draft: CollectionDraft, id?: string) {
    return this.repository.saveCollection(draft, id);
  }
  saveCategory(name: string, id?: string) {
    return this.repository.saveCategory(name, id);
  }
  saveWork(draft: WorkDraft, id?: string) {
    return this.repository.saveWork(draft, id);
  }
  setPhotoCategories(id: string, categoryIds: string[]) {
    return this.repository.setPhotoCategories(id, categoryIds);
  }
  remove(kind: "collections" | "categories" | "works", id: string) {
    return this.repository.remove(kind, id);
  }
}
