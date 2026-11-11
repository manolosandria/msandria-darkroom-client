import { beforeEach, describe, expect, it } from "vitest";
import {
  readGalleryState,
  readMetadataFilters,
  writeGalleryState,
} from "../galleryNavigationState";
import { emptyMetadataFilters } from "@/src/domain/entities/PhotoMetadataFilters";

describe("gallery navigation state", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/gallery");
  });

  it("reads the place from the URL and keeps one seed per tab", () => {
    window.history.replaceState(
      null,
      "",
      "/gallery?category=street,night_1,bad%20id&q=night&page=3&layout=uniform&crops=square",
    );
    const state = readGalleryState();
    expect(state).toMatchObject({
      categories: ["street", "night_1"],
      search: "night",
      page: 3,
      display: { layout: "uniform", crops: "square" },
    });
    expect(state.seed).toMatch(/^\d+$/);
    expect(readGalleryState().seed).toBe(state.seed);
  });

  it("ignores the URL for a preview and invalid pages", () => {
    window.history.replaceState(null, "", "/curator?category=street&page=x");
    expect(readGalleryState(false)).toMatchObject({ categories: [], page: 1 });
    expect(readGalleryState().page).toBe(1);
  });

  it("writes the place without dropping other parameters", () => {
    window.history.replaceState(null, "", "/gallery?ref=home&page=4");
    writeGalleryState({
      categories: ["city", "rain"],
      search: "rain",
      page: 1,
      display: { layout: "random" },
      metadata: emptyMetadataFilters(),
    });
    expect(window.location.search).toBe(
      "?ref=home&category=city%2Crain&q=rain&layout=random",
    );
  });

  it("keeps camera, lens, exposure ranges and tone in the URL", () => {
    window.history.replaceState(null, "", "/gallery?ref=home&tone=color");
    writeGalleryState({
      categories: [],
      search: "",
      page: 2,
      display: {},
      metadata: {
        ...emptyMetadataFilters(),
        cameras: ["FUJIFILM|X-T4", "Canon|EOS R6, Mark II"],
        lenses: ["XF23mmF1.4 R"],
        focalLength: { min: 23, max: 56 },
        exposureTime: { max: 0.004 },
        iso: { min: 100 },
        tone: "monochrome",
      },
    });
    const params = new URLSearchParams(window.location.search);
    expect(params.getAll("camera")).toEqual([
      "FUJIFILM|X-T4",
      "Canon|EOS R6, Mark II",
    ]);
    expect(params.get("focalMin")).toBe("23");
    expect(params.get("shutterMax")).toBe("0.004");
    expect(params.get("tone")).toBe("monochrome");
    expect(params.get("ref")).toBe("home");
    expect(readGalleryState().metadata).toEqual({
      cameras: ["FUJIFILM|X-T4", "Canon|EOS R6, Mark II"],
      lenses: ["XF23mmF1.4 R"],
      focalLength: { min: 23, max: 56 },
      exposureTime: { max: 0.004 },
      aperture: {},
      iso: { min: 100 },
      tone: "monochrome",
    });
    // Clearing them removes every key they used.
    writeGalleryState({
      categories: [],
      search: "",
      page: 1,
      display: {},
      metadata: emptyMetadataFilters(),
    });
    expect(window.location.search).toBe("?ref=home");
  });

  it("drops metadata values the API would refuse", () => {
    const filters = readMetadataFilters(
      new URLSearchParams(
        [
          "camera=" + "c".repeat(202),
          "camera=ok%01bad",
          "lens=Good",
          "lens=Good",
          "focalMin=-5",
          "focalMax=abc",
          "isoMin=1.5",
          "isoMax=800",
          "apertureMin=8",
          "apertureMax=2",
          "shutterMin=",
          "tone=sepia",
        ].join("&"),
      ),
    );
    expect(filters).toEqual({
      cameras: [],
      lenses: ["Good"],
      focalLength: {},
      exposureTime: {},
      aperture: { min: 8 },
      iso: { max: 800 },
    });
  });
});
