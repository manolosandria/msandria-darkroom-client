import { beforeEach, describe, expect, it, vi } from "vitest";
import { CloudinaryPhotoRepository } from "../CloudinaryPhotoRepository";

vi.mock("next-cloudinary", () => ({
  getCldImageUrl: vi.fn(({ src }: { src: string }) => `https://cloudinary/${src}.jpg`),
}));

vi.mock("../../data/photoData", () => ({
  photoData: [
    { id: "esferabalero", title: "Esfera", url: "" },
    { id: "Atardecer_heavy_zordwm", title: "Intenso Atardecer", url: "" },
  ],
}));

describe("CloudinaryPhotoRepository", () => {
  let repository: CloudinaryPhotoRepository;

  beforeEach(() => {
    repository = new CloudinaryPhotoRepository();
  });

  describe("findById", () => {
    it("maps a found entry into a domain Photo with a generated url", async () => {
      const photo = await repository.findById("esferabalero");

      expect(photo?.getTitle()).toBe("Esfera");
      expect(photo?.getUrl()).toBe("https://cloudinary/esferabalero.jpg");
    });

    it("returns null when the id is not in the catalog", async () => {
      const photo = await repository.findById("unknown");

      expect(photo).toBeNull();
    });
  });

  describe("findAll", () => {
    it("maps every catalog entry using the same rule as findById", async () => {
      const photos = await repository.findAll();

      expect(photos).toHaveLength(2);
      expect(photos?.[0].getUrl()).toBe("https://cloudinary/esferabalero.jpg");
    });
  });

  describe("save", () => {
    const input = {
      file: new File(["binary"], "photo.jpg", { type: "image/jpeg" }),
      title: "Esfera",
      description: "A sphere",
    };

    it("uploads the file and maps the response into a domain Photo", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "esferabalero",
            title: "Esfera",
            description: "A sphere",
            url: "https://cloudinary/esferabalero.jpg",
          }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const photo = await repository.save(input);

      expect(fetchMock).toHaveBeenCalledWith("/api/upload", expect.objectContaining({ method: "POST" }));
      expect(photo.getId()).toBe("esferabalero");
      expect(photo.getUrl()).toBe("https://cloudinary/esferabalero.jpg");

      vi.unstubAllGlobals();
    });

    it("throws with the server-provided message when the upload fails", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "A title is required." }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(repository.save(input)).rejects.toThrow("A title is required.");

      vi.unstubAllGlobals();
    });
  });

  describe("unsupported operations", () => {
    it("rejects delete with an explicit not-implemented error", async () => {
      await expect(repository.delete("any-id")).rejects.toThrow(/not support/i);
    });

    it("rejects findCollection with an explicit not-implemented error", async () => {
      await expect(repository.findCollection("any-id")).rejects.toThrow(/not support/i);
    });
  });
});
