import { beforeEach, describe, expect, it } from "vitest";
import {
  rememberTilesOnViewerClick,
  rememberViewerSequence,
  sequenceNeighbors,
} from "../viewerSequence";

const photo = (id: string) => ({ getId: () => id });
const link = () => {
  const anchor = document.createElement("a");
  anchor.href = "/photo/b";
  anchor.setAttribute("href", "/photo/b");
  const inner = document.createElement("img");
  anchor.appendChild(inner);
  return inner;
};

describe("viewer sequence", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("gives the shown photo of the tiles around any photo of a tile", () => {
    rememberViewerSequence([["a"], ["b", "b2"], ["c"]]);
    expect(sequenceNeighbors("b2")).toEqual({ previousId: "a", nextId: "c" });
    expect(sequenceNeighbors("a")).toEqual({ previousId: null, nextId: "b" });
    expect(sequenceNeighbors("z")).toBeNull();
  });

  it("records tiles only when a click lands on a viewer link, shown photo first", () => {
    const tiles = [
      { photo: photo("a"), variants: [photo("a")] },
      { photo: photo("b"), variants: [photo("b"), photo("b2")] },
    ];
    rememberTilesOnViewerClick(document.createElement("button"), tiles);
    expect(sequenceNeighbors("a")).toBeNull();

    rememberTilesOnViewerClick(link(), tiles, (tile, index) =>
      index === 1 ? "b2" : tile.photo.getId(),
    );
    expect(JSON.parse(window.sessionStorage.getItem("viewerSequence")!)).toEqual([
      ["a"],
      ["b2", "b"],
    ]);
  });

  it("ignores malformed storage", () => {
    window.sessionStorage.setItem("viewerSequence", "{not json");
    expect(sequenceNeighbors("a")).toBeNull();
    window.sessionStorage.setItem("viewerSequence", JSON.stringify([[1], "a", []]));
    expect(sequenceNeighbors("a")).toBeNull();
  });
});
