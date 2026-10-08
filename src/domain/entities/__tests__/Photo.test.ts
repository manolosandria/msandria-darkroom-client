import { describe, expect, it } from "vitest";
import { Photo } from "../Photo";

const renditions = [
  { width: 640, url: "https://cdn/esfera-640.jpg" },
  { width: 1280, url: "https://cdn/esfera-1280.jpg" },
];

describe("Photo", () => {
  it("stores the given id, title and renditions", () => {
    const photo = new Photo({ id: "esferabalero", title: "Esfera", renditions });

    expect(photo.getId()).toBe("esferabalero");
    expect(photo.getTitle()).toBe("Esfera");
    expect(photo.getRenditions()).toEqual(renditions);
  });

  it("trims title and rendition urls on creation", () => {
    const photo = new Photo({
      id: "1",
      title: "  Esfera  ",
      renditions: [{ width: 640, url: "  https://cdn/esfera.jpg  " }],
    });

    expect(photo.getTitle()).toBe("Esfera");
    expect(photo.getRenditions()[0].url).toBe("https://cdn/esfera.jpg");
  });

  it.each([
    ["missing id", { id: "", title: "Esfera", renditions }],
    ["missing title", { id: "id-1", title: "", renditions }],
    ["no renditions", { id: "id-1", title: "Esfera", renditions: [] }],
    ["a rendition without url", { id: "id-1", title: "Esfera", renditions: [{ width: 640, url: " " }] }],
    ["a rendition without width", { id: "id-1", title: "Esfera", renditions: [{ width: 0, url: "https://cdn/x" }] }],
  ])("rejects a photo with %s", (_case, params) => {
    expect(() => new Photo(params)).toThrow();
  });

  describe("urlForWidth", () => {
    // Given out of order on purpose: the photo must not depend on the API's order.
    const photo = new Photo({ id: "1", title: "Esfera", renditions: [...renditions].reverse() });

    it("picks the smallest rendition that fills the requested width", () => {
      expect(photo.urlForWidth(600)).toBe("https://cdn/esfera-640.jpg");
      expect(photo.urlForWidth(640)).toBe("https://cdn/esfera-640.jpg");
      expect(photo.urlForWidth(641)).toBe("https://cdn/esfera-1280.jpg");
    });

    it("falls back to the largest rendition when none is wide enough", () => {
      expect(photo.urlForWidth(3840)).toBe("https://cdn/esfera-1280.jpg");
    });
  });

  it("renames an existing photo", () => {
    const photo = new Photo({ id: "1", title: "Esfera", renditions });

    photo.rename("Nuevo nombre");

    expect(photo.getTitle()).toBe("Nuevo nombre");
  });

  it("rejects renaming to an empty title, keeping the previous one", () => {
    const photo = new Photo({ id: "1", title: "Esfera", renditions });

    expect(() => photo.rename("   ")).toThrow();
    expect(photo.getTitle()).toBe("Esfera");
  });

  it("updates the description, trimming it", () => {
    const photo = new Photo({ id: "1", title: "Esfera", renditions });

    photo.updateDescription("  A round sphere  ");

    expect(photo.getDescription()).toBe("A round sphere");
  });
});
