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

  describe("unsupported operations", () => {
    it("rejects save with an explicit not-implemented error", async () => {
      await expect(repository.save({} as never)).rejects.toThrow(/not support/i);
    });

    it("rejects delete with an explicit not-implemented error", async () => {
      await expect(repository.delete("any-id")).rejects.toThrow(/not support/i);
    });

    it("rejects findCollection with an explicit not-implemented error", async () => {
      await expect(repository.findCollection("any-id")).rejects.toThrow(/not support/i);
    });
  });
});
