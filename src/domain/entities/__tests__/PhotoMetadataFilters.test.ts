import { describe, expect, it } from "vitest";
import {
  activeMetadataCount,
  emptyMetadataFilters,
  metadataQuery,
  rangeStops,
} from "../PhotoMetadataFilters";

describe("photo metadata filters", () => {
  it("counts each choice and leaves empty ones out of the query", () => {
    expect(activeMetadataCount(emptyMetadataFilters())).toBe(0);
    expect(metadataQuery(emptyMetadataFilters())).toEqual({});
    const filters = {
      ...emptyMetadataFilters(),
      cameras: ["a|b", "c|d"],
      focalLength: { min: 24 },
      aperture: { min: 2, max: 8 },
      tone: "color" as const,
    };
    expect(activeMetadataCount(filters)).toBe(5);
    expect(metadataQuery(filters)).toEqual({
      camera: ["a|b", "c|d"],
      focalMin: 24,
      apertureMin: 2,
      apertureMax: 8,
      tone: "color",
    });
  });

  it("offers a range's ends and the usual stops between them", () => {
    expect(rangeStops("aperture", { min: 1.7, max: 5.6 })).toEqual([
      1.7, 1.8, 2, 2.8, 4, 5.6,
    ]);
    expect(rangeStops("iso", { min: 160, max: 160 })).toEqual([160]);
    expect(rangeStops("exposureTime", { min: 1 / 500, max: 1 / 60 })).toEqual(
      [1 / 500, 1 / 250, 1 / 125, 1 / 60],
    );
  });
});
