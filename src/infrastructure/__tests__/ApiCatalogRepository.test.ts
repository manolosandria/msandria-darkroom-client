import { describe, expect, it, vi } from "vitest";
import { ApiCatalogRepository } from "../ApiCatalogRepository";

describe("ApiCatalogRepository", () => {
  it("loads the public catalog and includes the session on every mutation", async () => {
    const catalog = { categories: [], collections: [], works: [], photos: [] };
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(catalog)));
    const repository = new ApiCatalogRepository(
      "https://api.example/",
      fetchFn,
    );
    expect(await repository.load()).toEqual(catalog);
    await repository.saveCollection({
      title: "City",
      categoryIds: [],
      entries: [],
    });
    await repository.saveCategory("Street", "a/b");
    await repository.saveWork({ title: "One work", photoIds: ["a", "b"] });
    await repository.setPhotoCategories("a/b", ["cat"]);
    await repository.remove("collections", "a/b");
    expect(
      fetchFn.mock.calls.every(([, init]) => init.credentials === "include"),
    ).toBe(true);
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.example/categories/a%2Fb",
      expect.objectContaining({ method: "PATCH", body: '{"name":"Street"}' }),
    );
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.example/photos/a%2Fb/categories",
      expect.objectContaining({ body: '{"categoryIds":["cat"]}' }),
    );
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.example/collections/a%2Fb",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it.each([400, 401, 403, 404, 409, 500])(
    "reports %s without replaying a mutation",
    async (status) => {
      const fetchFn = vi.fn().mockResolvedValue(new Response("", { status }));
      await expect(
        new ApiCatalogRepository("https://api", fetchFn).saveCategory("Street"),
      ).rejects.toThrow();
      expect(fetchFn).toHaveBeenCalledTimes(1);
    },
  );
});
