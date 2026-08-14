import { describe, expect, it, vi } from "vitest";
import { GetPhotoById } from "../GetPhotoById";
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

describe("GetPhotoById", () => {
  it("returns the photo found by the repository", async () => {
    const photo = new Photo({ id: "1", title: "Esfera", url: "https://cdn/1.jpg" });
    const repository = makeRepository({ findById: vi.fn().mockResolvedValue(photo) });

    const result = await new GetPhotoById(repository).execute("1");

    expect(result).toBe(photo);
    expect(repository.findById).toHaveBeenCalledWith("1");
  });

  it("returns null when the photo does not exist", async () => {
    const repository = makeRepository({ findById: vi.fn().mockResolvedValue(null) });

    const result = await new GetPhotoById(repository).execute("missing");

    expect(result).toBeNull();
  });
});
