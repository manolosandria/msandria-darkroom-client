import { describe, expect, it, vi } from "vitest";
import { ApiPhotoRepository } from "../ApiPhotoRepository";

const API_URL = "http://api.test";

function apiPhoto(id: string, renditions = [{ width: 640, url: `https://cdn/${id}-640.jpg` }]) {
  return {
    id,
    title: `Photo ${id}`,
    description: null,
    width: 1920,
    height: 1080,
    format: "jpg",
    capturedAt: null,
    lastEditDate: null,
    origin: "EDITED",
    createdAt: "2024-06-04T23:42:00.000Z",
    renditions,
  };
}

function respondWith(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
}

describe("ApiPhotoRepository", () => {
  describe("findAll", () => {
    it("maps the API listing into domain photos, keeping its order", async () => {
      const fetchFn = respondWith([apiPhoto("b"), apiPhoto("a")]);

      const photos = await new ApiPhotoRepository(API_URL, fetchFn).findAll();

      expect(fetchFn).toHaveBeenCalledWith("http://api.test/photos");
      expect(photos?.map((photo) => photo.getId())).toEqual(["b", "a"]);
      expect(photos?.[0].getTitle()).toBe("Photo b");
      expect(photos?.[0].getCreatedAt()).toEqual(new Date("2024-06-04T23:42:00.000Z"));
      expect(photos?.[0].urlForWidth(640)).toBe("https://cdn/b-640.jpg");
    });

    it("tolerates a trailing slash in the base url", async () => {
      const fetchFn = respondWith([]);

      await new ApiPhotoRepository("http://api.test/", fetchFn).findAll();

      expect(fetchFn).toHaveBeenCalledWith("http://api.test/photos");
    });

    it("leaves out photos without renditions", async () => {
      const fetchFn = respondWith([apiPhoto("a"), apiPhoto("gone", [])]);

      const photos = await new ApiPhotoRepository(API_URL, fetchFn).findAll();

      expect(photos?.map((photo) => photo.getId())).toEqual(["a"]);
    });

    it("returns null for an empty catalog", async () => {
      const photos = await new ApiPhotoRepository(API_URL, respondWith([])).findAll();

      expect(photos).toBeNull();
    });

    it("rejects when the API answers with an error", async () => {
      const repository = new ApiPhotoRepository(API_URL, respondWith({}, 500));

      await expect(repository.findAll()).rejects.toThrow(/500/);
    });

    it("rejects with a clear message when the API url is not configured", async () => {
      const fetchFn = vi.fn();

      await expect(new ApiPhotoRepository(undefined, fetchFn).findAll()).rejects.toThrow(
        /NEXT_PUBLIC_API_URL/,
      );
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });

  describe("findById", () => {
    it("fetches a single photo by its id", async () => {
      const fetchFn = respondWith(apiPhoto("a/b"));

      const photo = await new ApiPhotoRepository(API_URL, fetchFn).findById("a/b");

      expect(fetchFn).toHaveBeenCalledWith("http://api.test/photos/a%2Fb");
      expect(photo?.getTitle()).toBe("Photo a/b");
    });

    it("returns null when the API does not know the id", async () => {
      const photo = await new ApiPhotoRepository(API_URL, respondWith({}, 404)).findById("x");

      expect(photo).toBeNull();
    });

    it("returns null when the photo has no renditions", async () => {
      const photo = await new ApiPhotoRepository(API_URL, respondWith(apiPhoto("a", []))).findById("a");

      expect(photo).toBeNull();
    });

    it("rejects on any other API error", async () => {
      const repository = new ApiPhotoRepository(API_URL, respondWith({}, 503));

      await expect(repository.findById("a")).rejects.toThrow(/503/);
    });
  });

  describe("unsupported operations", () => {
    const repository = new ApiPhotoRepository(API_URL, vi.fn());

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
