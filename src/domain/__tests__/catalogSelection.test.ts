import { describe, expect, it } from "vitest";
import { Catalog } from "../entities/Catalog";
import { Photo } from "../entities/Photo";
import { selectCatalog } from "../catalogSelection";

const photos = ["a", "b", "c"].map(
  (id) =>
    new Photo({
      id,
      title: id,
      width: 100,
      height: 100,
      renditions: [{ url: `https://cdn/${id}`, width: 100 }],
    }),
);
const catalog: Catalog = {
  categories: [{ id: "cat", name: "Street" }],
  photos: [{ id: "c", categories: [{ id: "solo" }] }],
  collections: [
    {
      id: "col",
      title: "City",
      categories: [{ id: "cat", name: "Street" }],
      entries: [
        { photoId: "b", columns: 2, rows: 3 },
        { photoId: "a", columns: 1, rows: 1 },
      ],
    },
  ],
  works: [
    {
      id: "work",
      title: "Together",
      variants: [{ photoId: "a" }, { photoId: "b" }],
    },
  ],
};
describe("catalog selection", () => {
  it("groups variants into one work, retaining the selected collection variant and dimensions", () => {
    const tiles = selectCatalog(photos, catalog, "", "col");
    expect(tiles).toHaveLength(1);
    expect(tiles[0].photo.getId()).toBe("b");
    expect(tiles[0].entry).toEqual({ photoId: "b", columns: 2, rows: 3 });
    expect(tiles[0].variants.map((photo) => photo.getId())).toEqual(["a", "b"]);
  });
  it("includes categories from collections and standalone photos", () => {
    expect(
      selectCatalog(photos, catalog, "cat", "").map((tile) => tile.key),
    ).toEqual(["work:work"]);
    expect(
      selectCatalog(photos, catalog, "solo", "").map((tile) =>
        tile.photo.getId(),
      ),
    ).toEqual(["c"]);
    expect(selectCatalog(photos, catalog, "missing", "")).toEqual([]);
  });
  it("does not show the entire gallery for a removed collection or unavailable files", () => {
    expect(selectCatalog(photos, catalog, "", "gone")).toEqual([]);
    expect(selectCatalog([], catalog, "", "col")).toEqual([]);
  });
});
