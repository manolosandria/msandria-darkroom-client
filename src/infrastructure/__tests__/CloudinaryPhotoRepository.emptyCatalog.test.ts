import { describe, expect, it, vi } from "vitest";
import { CloudinaryPhotoRepository } from "../CloudinaryPhotoRepository";

vi.mock("next-cloudinary", () => ({
  getCldImageUrl: vi.fn(() => "https://cloudinary/placeholder.jpg"),
}));

vi.mock("../../data/photoData", () => ({ photoData: [] }));

describe("CloudinaryPhotoRepository with an empty catalog", () => {
  it("findAll returns null instead of an empty array", async () => {
    const photos = await new CloudinaryPhotoRepository().findAll();

    expect(photos).toBeNull();
  });
});
