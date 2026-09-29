import { describe, expect, it, vi } from "vitest";
import { UploadPhoto } from "../UploadPhoto";
import type { PhotoRepository } from "@/src/domain/repositories/PhotoRepository";
import { Photo } from "@/src/domain/entities/Photo";

function makeRepository(overrides: Partial<PhotoRepository> = {}): PhotoRepository {
  return {
    findById: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn(),
    findCollection: vi.fn(),
    ...overrides,
  };
}

function makeInput() {
  return {
    file: new File(["binary"], "photo.jpg", { type: "image/jpeg" }),
    title: "Esfera",
    description: "A sphere",
  };
}

describe("UploadPhoto", () => {
  it("saves the input through the repository and returns the created photo", async () => {
    const photo = new Photo({ id: "1", title: "Esfera", url: "https://cdn/1.jpg" });
    const repository = makeRepository({ save: vi.fn().mockResolvedValue(photo) });
    const input = makeInput();

    const result = await new UploadPhoto(repository).execute(input);

    expect(repository.save).toHaveBeenCalledWith(input);
    expect(result).toBe(photo);
  });

  it("propagates repository failures", async () => {
    const repository = makeRepository({ save: vi.fn().mockRejectedValue(new Error("upload failed")) });

    await expect(new UploadPhoto(repository).execute(makeInput())).rejects.toThrow("upload failed");
  });
});
