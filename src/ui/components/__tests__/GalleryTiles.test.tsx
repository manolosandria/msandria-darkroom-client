import { describe, it, expect } from "vitest";
import { galleryPriorities } from "../GalleryTiles";
describe("Gallery emphasis", () => {
  it("keeps at most two large tiles and keeps the same layout when returning to a page", () => {
    for (let length = 0; length <= 25; length++) {
      const keys = Array.from({ length }, (_, i) => `photo-${i}`);
      const priorities = galleryPriorities(keys);
      expect(priorities.size).toBeLessThanOrEqual(2);
      expect(priorities.size).toBeLessThanOrEqual(Math.floor(length / 3));
      expect(galleryPriorities(keys)).toEqual(priorities);
      for (const index of priorities)
        expect(index >= 0 && index < length).toBe(true);
    }
  });
});

import { packGallery } from "../galleryPacking";
describe("Filled gallery rectangles", () => {
  it("packs mixed orientations and all-portrait sets without gaps, overlaps or excess emphasis", () => {
    for (const columns of [3, 4])
      for (let count = 1; count <= 12; count++)
        for (const mode of ["mixed", "portrait", "landscape"]) {
          const keys = Array.from({ length: count }, (_, i) => `photo-${i}`);
          const views = keys.map((_, i) => [
            {
              id: "original",
              name: "Original",
              ratio:
                mode === "portrait" || (mode === "mixed" && i % 3 === 0)
                  ? 0.65
                  : 1.5,
            },
          ]);
          const packed = packGallery(keys, views, columns);
          expect(packed.tiles).toHaveLength(count);
          expect(
            packed.tiles.filter((tile) => tile.large).length,
          ).toBeLessThanOrEqual(2);
          expect(
            packed.tiles.reduce(
              (area, tile) => area + tile.width * tile.height,
              0,
            ),
          ).toBeCloseTo(packed.rows, 8);
          if (count > 1)
            for (let row = 0; row < packed.rows; row++) {
              expect(
                packed.tiles.filter(
                  (tile) =>
                    tile.y <= row + 0.5 && tile.y + tile.height > row + 0.5,
                ).length,
              ).toBeGreaterThanOrEqual(2);
            }
          packed.tiles.forEach((tile, index) => {
            expect(tile.x).toBeGreaterThanOrEqual(0);
            expect(tile.x + tile.width).toBeLessThanOrEqual(1.000001);
            expect(tile.y + tile.height).toBeLessThanOrEqual(packed.rows);
            if (views[index][0].ratio < 0.85)
              expect(tile.height).toBeGreaterThanOrEqual(2);
            for (const other of packed.tiles.slice(index + 1)) {
              const overlapX =
                Math.min(tile.x + tile.width, other.x + other.width) -
                Math.max(tile.x, other.x);
              const overlapY =
                Math.min(tile.y + tile.height, other.y + other.height) -
                Math.max(tile.y, other.y);
              expect(overlapX < 0.000001 || overlapY < 0.000001).toBe(true);
            }
          });
          expect(packGallery(keys, views, columns)).toEqual(packed);
        }
  });
});
