import { describe, expect, it } from "vitest";
import { PhotoCollection } from "../PhotoCollection";
import { Photo } from "../Photo";
import { Category } from "../Category";

function makePhoto(id: string) {
  return new Photo({ id, title: `Photo ${id}`, width: 1920, height: 1080, renditions: [{ width: 640, url: `https://cdn/${id}.jpg` }] });
}

describe("PhotoCollection", () => {
  it("exposes its id, title and photos", () => {
    const photos = [makePhoto("1"), makePhoto("2")];

    const collection = new PhotoCollection("col-1", "  Vacation  ", photos);

    expect(collection.getId()).toBe("col-1");
    expect(collection.getTitle()).toBe("Vacation");
    expect(collection.getPhotos()).toEqual(photos);
  });

  it("defaults to an empty category list when none is given", () => {
    const collection = new PhotoCollection("col-1", "Vacation", []);

    expect(collection.getPhotos()).toEqual([]);
  });

  it("accepts explicit categories without altering the id", () => {
    const collection = new PhotoCollection("col-1", "Vacation", [], [new Category("Nature")]);

    expect(collection.getId()).toBe("col-1");
  });
});
