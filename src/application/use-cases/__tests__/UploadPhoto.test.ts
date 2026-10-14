import { describe, expect, it, vi } from "vitest";
import { UploadPhoto } from "../UploadPhoto";
import type {
  PhotoDraft,
  PhotoRepository,
  PublishedPhoto,
} from "@/src/domain/repositories/PhotoRepository";
import { Photo } from "@/src/domain/entities/Photo";
import { PhotoOptimizationIssue } from "@/src/domain/entities/PhotoOptimizationIssue";

function makeRepository(overrides: Partial<PhotoRepository> = {}): PhotoRepository {
  return {
    findById: vi.fn(),
    upload: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn(),
    findCollection: vi.fn(),
    ...overrides,
  };
}

const draft: PhotoDraft = {
  file: new File(["bytes"], "virgencita.jpg", { type: "image/jpeg" }),
  title: "Virgencita",
};

const published: PublishedPhoto = {
  photo: new Photo({
    id: "1",
    title: "Virgencita",
    width: 1920,
    height: 1080,
    renditions: [{ width: 640, url: "https://cdn/1.jpg" }],
  }),
  optimizationIssues: [
    new PhotoOptimizationIssue({
      kind: "LOCATION",
      resolution: "FIXED_ON_UPLOAD",
      unit: "TAG_COUNT",
      currentValue: "2",
      recommendedValue: "0",
    }),
  ],
};

describe("UploadPhoto", () => {
  it("hands the draft to the repository and returns what was published", async () => {
    const upload = vi.fn().mockResolvedValue(published);

    const result = await new UploadPhoto(makeRepository({ upload })).execute(draft);

    expect(upload).toHaveBeenCalledWith(draft);
    expect(result).toBe(published);
  });

  it("lets a refusal through to its caller", async () => {
    const upload = vi.fn().mockRejectedValue(new Error("boom"));

    await expect(
      new UploadPhoto(makeRepository({ upload })).execute(draft),
    ).rejects.toThrow("boom");
  });
});
