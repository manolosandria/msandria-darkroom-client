import { expect, it } from "vitest";
import { packGallery } from "../galleryPacking";
import { PhotoView } from "@/src/domain/photoPresentation";
it("can disable large photographs in random packing", () => {
  const keys = Array.from({ length: 12 }, (_, i) => String(i));
  const views = keys.map(() => [{ ratio: 1.5 } as PhotoView]);
  expect(
    packGallery(keys, views, 4, 0, 0).tiles.every((tile) => !tile.large),
  ).toBe(true);
});
it("honors a feasible minimum of large photographs", () => {
  const keys = Array.from({ length: 12 }, (_, i) => String(i));
  const views = keys.map(() => [{ ratio: 1.5 } as PhotoView]);
  const count = packGallery(keys, views, 4, 3, 4).tiles.filter(
    (tile) => tile.large,
  ).length;
  expect(count).toBeGreaterThanOrEqual(3);
  expect(count).toBeLessThanOrEqual(4);
});
