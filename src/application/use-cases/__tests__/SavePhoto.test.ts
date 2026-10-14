import { describe, expect, it, vi } from "vitest";
import { Photo } from "@/src/domain/entities/Photo";
import { SavePhoto } from "../SavePhoto";

const photo = new Photo({
  id: "1",
  title: "Virgencita",
  width: 1920,
  height: 1080,
  renditions: [{ width: 640, url: "https://cdn/1.jpg" }],
  highlights: { square: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 } },
});

describe("SavePhoto", () => {
  it("hands the photo to the repository", async () => {
    const save = vi.fn().mockResolvedValue(undefined);

    await new SavePhoto({ save }).execute(photo);

    expect(save).toHaveBeenCalledWith(photo);
  });

  // Whoever is editing has to hear about a refusal, so the screen can keep the edits.
  it("lets a refusal through", async () => {
    const save = vi.fn().mockRejectedValue(new Error("nope"));

    await expect(new SavePhoto({ save }).execute(photo)).rejects.toThrow("nope");
  });
});
