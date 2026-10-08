import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PhotoGrid } from "../PhotoGrid";
import { Photo } from "@/src/domain/entities/Photo";

function makePhoto(id: string, width: number, height: number) {
  return new Photo({
    id,
    title: `Photo ${id}`,
    width,
    height,
    renditions: [
      { width: 640, url: `https://cdn/w_640/${id}` },
      { width: 1280, url: `https://cdn/w_1280/${id}` },
    ],
  });
}

describe("PhotoGrid", () => {
  const photos = [makePhoto("landscape", 3000, 2000), makePhoto("portrait", 2000, 3000)];

  it("gives each tile the proportion of its photo, in the given order", () => {
    render(<PhotoGrid photos={photos} />);

    const tiles = screen.getAllByRole("listitem");
    expect(tiles.map((tile) => Number(tile.style.getPropertyValue("--ratio")))).toEqual([1.5, 2 / 3]);
  });

  it("names every photo for screen readers and shows its title as a caption", () => {
    render(<PhotoGrid photos={photos} />);

    expect(screen.getByAltText("Photo landscape")).toBeInTheDocument();
    expect(screen.getByText("Photo portrait")).toBeInTheDocument();
  });

  it("only loads the renditions sent by the API", () => {
    render(<PhotoGrid photos={photos} />);

    const image = screen.getByAltText("Photo portrait");
    const candidates = [image.getAttribute("src"), ...image.getAttribute("srcset")!.split(", ").map((c) => c.split(" ")[0])];
    for (const candidate of candidates) {
      expect(candidate).toMatch(/^https:\/\/cdn\/w_(640|1280)\/portrait$/);
    }
  });

  it("loads the first photos right away and the rest when they come into view", () => {
    const many = Array.from({ length: 6 }, (_, i) => makePhoto(String(i), 1500, 1000));

    render(<PhotoGrid photos={many} />);

    const loading = screen.getAllByRole("img").map((image) => image.getAttribute("loading"));
    expect(loading).toEqual(["eager", "eager", "eager", "eager", "lazy", "lazy"]);
  });
});
