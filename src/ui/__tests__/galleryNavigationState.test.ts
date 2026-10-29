import { beforeEach, describe, expect, it } from "vitest";
import {
  readGalleryState,
  writeGalleryState,
} from "../galleryNavigationState";

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
    });
    expect(window.location.search).toBe(
      "?ref=home&category=city%2Crain&q=rain&layout=random",
    );
  });
});
