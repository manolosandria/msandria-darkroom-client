import { describe, expect, it, vi } from "vitest";
import { GetAllPhotos } from "../GetAllPhotos";
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

describe("GetAllPhotos", () => {
  it("returns every photo from the repository", async () => {
    const photos = [new Photo({ id: "1", title: "Esfera", renditions: [{ width: 640, url: "https://cdn/1.jpg" }] })];
    const repository = makeRepository({ findAll: vi.fn().mockResolvedValue(photos) });

    const result = await new GetAllPhotos(repository).execute();

    expect(result).toBe(photos);
  });

  it("returns null when the repository has no photos", async () => {
    const repository = makeRepository({ findAll: vi.fn().mockResolvedValue(null) });

    const result = await new GetAllPhotos(repository).execute();

    expect(result).toBeNull();
  });

  it("propagates repository failures", async () => {
    const repository = makeRepository({ findAll: vi.fn().mockRejectedValue(new Error("network down")) });

    await expect(new GetAllPhotos(repository).execute()).rejects.toThrow("network down");
  });
});
