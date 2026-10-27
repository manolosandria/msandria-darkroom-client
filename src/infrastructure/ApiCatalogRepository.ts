import {
  Catalog,
  CatalogCollection,
  CatalogWork,
  CollectionDraft,
  WorkDraft,
} from "../domain/entities/Catalog";
import { CatalogRepository } from "../domain/repositories/CatalogRepository";
import { CatalogConflictError } from "../domain/errors/CatalogConflictError";

export class ApiCatalogRepository implements CatalogRepository {
  private pending: Promise<Catalog> | null = null;
  constructor(
    private readonly baseUrl: string | undefined,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
    private readonly admin = false,
    private readonly categoriesOnly = false,
  ) {}
  load(): Promise<Catalog> {
    if (this.pending) return this.pending;
    const request = this.request(
      "GET",
      this.categoriesOnly
        ? "/catalog/categories"
        : this.admin
          ? "/catalog/manage"
          : "/catalog",
    )
      .then((response) => response.json() as Promise<Catalog>)
      .then((result) =>
        this.categoriesOnly
          ? {
              categories: result as unknown as Catalog["categories"],
              photos: [],
              collections: [],
              works: [],
            }
          : result,
      )
      .finally(() => {
        if (this.pending === request) this.pending = null;
      });
    this.pending = request;
    return request;
  }
  async saveCollection(draft: CollectionDraft, id?: string) {
    return (
      await this.save("collections", draft, id)
    ).json() as Promise<CatalogCollection>;
  }
  async saveCategory(name: string, id?: string) {
    await this.save("categories", { name }, id);
  }
  async saveWork(draft: WorkDraft, id?: string) {
    return (await this.save("works", draft, id)).json() as Promise<CatalogWork>;
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
    if (method !== "GET") this.pending = null;
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
      if (
        response.status === 409 &&
        method === "PATCH" &&
        /^\/(collections|works)\//.test(path)
      ) {
        const detail = (await response.json().catch(() => null)) as {
          code?: string;
        } | null;
        if (detail?.code === "CATALOG_CHANGED")
          throw new CatalogConflictError();
      }
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
