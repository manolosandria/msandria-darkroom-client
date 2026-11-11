import { describe, expect, it, vi } from "vitest";
import { Photo } from "@/src/domain/entities/Photo";
import { emptyMetadataFilters } from "@/src/domain/entities/PhotoMetadataFilters";
import { ApiPhotoRepository } from "../ApiPhotoRepository";

const API_URL = "http://api.test";

function respondWith(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

const photo = (tonality?: "COLOR" | "MONOCHROME" | null) =>
  new Photo({
    id: "p",
    version: 3,
    title: "Coast",
    width: 1200,
    height: 800,
    renditions: [{ width: 640, url: "https://cdn/p.jpg" }],
    tonality,
  });

describe("ApiPhotoRepository: metadata filters and tonality", () => {
  it("sends cameras and lenses as repeated parameters and the ranges by name", async () => {
    const fetchFn = respondWith({ page: 1, limit: 12, total: 0, tiles: [] });
    await new ApiPhotoRepository(API_URL, fetchFn).browse({
      page: 1,
      metadata: {
        ...emptyMetadataFilters(),
        cameras: ["FUJIFILM|X-T4", "Canon|EOS R6, Mark II"],
        lenses: ["XF23"],
        exposureTime: { min: 0.004, max: 1 },
        iso: { max: 3200 },
        tone: "monochrome",
      },
    });
    const url = new URL(fetchFn.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/photos/browse");
    expect(url.searchParams.getAll("camera")).toEqual([
      "FUJIFILM|X-T4",
      "Canon|EOS R6, Mark II",
    ]);
    expect(url.searchParams.getAll("lens")).toEqual(["XF23"]);
    expect(url.searchParams.get("shutterMin")).toBe("0.004");
    expect(url.searchParams.get("shutterMax")).toBe("1");
    expect(url.searchParams.get("isoMax")).toBe("3200");
    expect(url.searchParams.get("tone")).toBe("monochrome");
    expect(url.searchParams.has("metadata")).toBe(false);
    expect(url.searchParams.has("focalMin")).toBe(false);
  });

  it("reads the facets and explains a rate limit", async () => {
    const facets = {
      cameras: [],
      lenses: [{ value: "XF23", count: 2 }],
      focalLength: null,
      exposureTime: null,
      aperture: { min: 1.4, max: 8 },
      iso: null,
      tonality: { color: 1, monochrome: 1 },
    };
    const fetchFn = respondWith(facets);
    await expect(
      new ApiPhotoRepository(API_URL, fetchFn).facets(),
    ).resolves.toEqual(facets);
    expect(fetchFn).toHaveBeenCalledWith("http://api.test/photos/facets", {
      method: "GET",
      credentials: "include",
    });
    await expect(
      new ApiPhotoRepository(API_URL, respondWith({}, 429)).facets(),
    ).rejects.toThrow();
  });

  it("classifies a batch of older photos and reports a refusal", async () => {
    const fetchFn = respondWith({ classified: 3, failed: 1, remaining: 0 });
    await expect(
      new ApiPhotoRepository(API_URL, fetchFn).classifyPendingTonality(),
    ).resolves.toEqual({ classified: 3, failed: 1, remaining: 0 });
    expect(fetchFn).toHaveBeenCalledWith(
      "http://api.test/photos/tonality/classify",
      { method: "POST", credentials: "include" },
    );
    await expect(
      new ApiPhotoRepository(
        API_URL,
        respondWith({ message: "Forbidden" }, 403),
      ).classifyPendingTonality(),
    ).rejects.toThrow();
  });

  it("reads the tonality and sends it only when it changed", async () => {
    const listed = await new ApiPhotoRepository(
      API_URL,
      respondWith([
        {
          id: "p",
          title: "Coast",
          width: 1200,
          height: 800,
          createdAt: "2026-01-01T00:00:00.000Z",
          renditions: [{ width: 640, url: "https://cdn/p.jpg" }],
          tonality: "MONOCHROME",
        },
      ]),
    ).findAll();
    expect(listed?.[0].getTonality()).toBe("MONOCHROME");

    const fetchFn = respondWith({});
    const repository = new ApiPhotoRepository(API_URL, fetchFn);
    await repository.save(photo("MONOCHROME"), photo(null));
    expect(JSON.parse(fetchFn.mock.calls[0][1].body as string)).toEqual({
      version: 3,
      tonality: "MONOCHROME",
    });
    await repository.save(photo("COLOR"), photo("COLOR"));
    expect(JSON.parse(fetchFn.mock.calls[1][1].body as string)).toEqual({
      version: 3,
    });
    // Unclassified, nothing is sent: the API refuses null.
    await repository.save(photo(null));
    expect(
      JSON.parse(fetchFn.mock.calls[2][1].body as string),
    ).not.toHaveProperty("tonality");
  });
});
