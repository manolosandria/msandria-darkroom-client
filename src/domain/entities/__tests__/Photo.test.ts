import { describe, expect, it } from "vitest";
import { Photo } from "../Photo";

describe("Photo", () => {
  it("stores the given id, title and url", () => {
    const photo = new Photo({ id: "esferabalero", title: "Esfera", url: "https://cdn/esfera.jpg" });

    expect(photo.getId()).toBe("esferabalero");
    expect(photo.getTitle()).toBe("Esfera");
    expect(photo.getUrl()).toBe("https://cdn/esfera.jpg");
  });

  it("trims title and url on creation", () => {
    const photo = new Photo({ id: "1", title: "  Esfera  ", url: "  https://cdn/esfera.jpg  " });

    expect(photo.getTitle()).toBe("Esfera");
    expect(photo.getUrl()).toBe("https://cdn/esfera.jpg");
  });

  it.each([
    ["", "Esfera", "https://cdn/x"],
    ["id-1", "", "https://cdn/x"],
    ["id-1", "Esfera", ""],
  ])("rejects id=%s title=%s url=%s", (id, title, url) => {
    expect(() => new Photo({ id, title, url })).toThrow();
  });

  it("renames an existing photo", () => {
    const photo = new Photo({ id: "1", title: "Esfera", url: "https://cdn/x" });

    photo.rename("Nuevo nombre");

    expect(photo.getTitle()).toBe("Nuevo nombre");
  });

  it("rejects renaming to an empty title, keeping the previous one", () => {
    const photo = new Photo({ id: "1", title: "Esfera", url: "https://cdn/x" });

    expect(() => photo.rename("   ")).toThrow();
    expect(photo.getTitle()).toBe("Esfera");
  });

  it("updates the description, trimming it", () => {
    const photo = new Photo({ id: "1", title: "Esfera", url: "https://cdn/x" });

    photo.updateDescription("  A round sphere  ");

    expect(photo.getDescription()).toBe("A round sphere");
  });
});
