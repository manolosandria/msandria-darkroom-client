import {
  Catalog,
  CollectionDraft,
  WorkDraft,
} from "../domain/entities/Catalog";
import { CatalogRepository } from "../domain/repositories/CatalogRepository";

export class ApiCatalogRepository implements CatalogRepository {
  constructor(
    private readonly baseUrl: string | undefined,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
    private readonly admin = false,
  ) {}
  async load(): Promise<Catalog> {
    return (
      await this.request("GET", this.admin ? "/catalog/manage" : "/catalog")
    ).json();
  }
  async saveCollection(draft: CollectionDraft, id?: string) {
    await this.save("collections", draft, id);
  }
  async saveCategory(name: string, id?: string) {
    await this.save("categories", { name }, id);
  }
  async saveWork(draft: WorkDraft, id?: string) {
    await this.save("works", draft, id);
  }
  async setPhotoCategories(id: string, categoryIds: string[]) {
    await this.request(
      "PATCH",
      `/photos/${encodeURIComponent(id)}/categories`,
      { categoryIds },
    );
  }
  async remove(kind: "collections" | "categories" | "works", id: string) {
    await this.request("DELETE", `/${kind}/${encodeURIComponent(id)}`);
  }
  private save(kind: string, draft: unknown, id?: string) {
    return this.request(
      id ? "PATCH" : "POST",
      `/${kind}${id ? `/${encodeURIComponent(id)}` : ""}`,
      draft,
    );
  }
  private async request(method: string, path: string, body?: unknown) {
    if (!this.baseUrl) throw new Error("The gallery API is not configured.");
    const response = await this.fetchFn(
      `${this.baseUrl.replace(/\/+$/, "")}${path}`,
      {
        method,
        credentials: "include",
        ...(body === undefined
          ? {}
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }),
      },
    );
    if (!response.ok) {
      const messages: Record<number, string> = {
        400: "Check the fields. A referenced photo or category may have been removed.",
        401: "Sign in again to save your changes.",
        403: "Only the administrator can edit the catalog.",
        404: "This record has changed or was removed. Reload the catalog.",
        409: "That category name or photo variant is already in use.",
      };
      throw new Error(
        messages[response.status] ??
          "The catalog could not be reached. Try again.",
      );
    }
    return response;
  }
}
