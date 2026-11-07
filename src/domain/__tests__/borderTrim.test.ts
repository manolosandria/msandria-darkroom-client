import { describe, expect, it } from "vitest";
import {
  detectBorder,
  insetsToTrim,
  remapHighlights,
  trimToInsets,
  trimmedSize,
} from "../borderTrim";

/** An RGBA image filled with `ground`, with a `photo` rectangle painted on it. */
function image(
  width: number,
  height: number,
  ground: number[],
  photo?: { left: number; top: number; width: number; height: number },
) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const inside =
        photo &&
        x >= photo.left &&
        x < photo.left + photo.width &&
        y >= photo.top &&
        y < photo.top + photo.height;
      // The photograph is busy: neighbouring pixels differ a lot.
      const colour = inside ? [(x * 37) % 256, (y * 53) % 256, (x * y) % 256] : ground;
      data.set([...colour, 255], (y * width + x) * 4);
    }
  return data;
}

describe("detectBorder", () => {
  it("finds a letterbox: bands on top and bottom only", () => {
    const data = image(100, 80, [255, 255, 255], {
      left: 0,
      top: 20,
      width: 100,
      height: 40,
    });
    const insets = trimToInsets(detectBorder(data, 100, 80)!, 100, 80);
    // One line more than the band: the line where border and photo meet goes too.
    expect(insets).toEqual({ top: 21, bottom: 21, left: 0, right: 0 });
  });

  it("finds a mat on every side, eating at most one line of the photograph", () => {
    const data = image(100, 100, [20, 20, 20], {
      left: 10,
      top: 15,
      width: 70,
      height: 60,
    });
    const insets = trimToInsets(detectBorder(data, 100, 100)!, 100, 100);
    expect(insets).toEqual({ top: 16, bottom: 26, left: 11, right: 21 });
  });

  it("tolerates noise and a few odd pixels in the border", () => {
    const data = image(100, 60, [250, 250, 250], {
      left: 0,
      top: 10,
      width: 100,
      height: 40,
    });
    data.set([235, 255, 240, 255], (2 * 100 + 5) * 4);
    data.set([0, 0, 0, 255], (3 * 100 + 50) * 4);
    expect(trimToInsets(detectBorder(data, 100, 60)!, 100, 60).top).toBe(11);
  });

  it("returns null when there is no border", () => {
    const data = image(50, 40, [0, 0, 0], { left: 0, top: 0, width: 50, height: 40 });
    expect(detectBorder(data, 50, 40)).toBeNull();
  });

  it("returns null for an image of one colour", () => {
    expect(detectBorder(image(40, 40, [255, 255, 255]), 40, 40)).toBeNull();
  });
});

describe("insets and trims", () => {
  it("converts pixels per side to a trim and back", () => {
    const trim = insetsToTrim({ top: 100, right: 0, bottom: 100, left: 50 }, 1000, 800)!;
    expect(trim).toEqual({ x: 0.05, y: 0.125, width: 0.95, height: 0.75 });
    expect(trimToInsets(trim, 1000, 800)).toEqual({
      top: 100,
      right: 0,
      bottom: 100,
      left: 50,
    });
    expect(trimmedSize(trim, 1000, 800)).toEqual({ width: 950, height: 600 });
    expect(trimmedSize(null, 1000, 800)).toEqual({ width: 1000, height: 800 });
  });

  it("refuses a trim that keeps too little of the photo", () => {
    expect(insetsToTrim({ top: 0, right: 480, bottom: 0, left: 480 }, 1000, 800)).toBeNull();
  });
});

describe("remapHighlights", () => {
  const trim = { x: 0, y: 0.2, width: 1, height: 0.6 };

  it("keeps each crop on the same pixels when the image is trimmed", () => {
    const remapped = remapHighlights(
      { square: { x: 0.1, y: 0.3, width: 0.3, height: 0.3 } },
      null,
      trim,
    );
    expect(remapped.square!.y).toBeCloseTo(0.1 / 0.6);
    expect(remapped.square!.height).toBeCloseTo(0.5);
    expect(remapped.square!.width).toBeCloseTo(0.3);
  });

  it("returns a crop to the whole image when the trim is removed", () => {
    const back = remapHighlights(
      remapHighlights({ square: { x: 0.1, y: 0.3, width: 0.3, height: 0.3 } }, null, trim),
      trim,
      null,
    );
    expect(back.square!.y).toBeCloseTo(0.3);
  });

  it("drops crops that fall in the removed border, and the places that showed them", () => {
    const remapped = remapHighlights(
      {
        landscape: { x: 0, y: 0, width: 0.5, height: 0.3 },
        custom: [
          { id: "edge", name: "Edge", crop: { x: 0, y: 0.85, width: 0.2, height: 0.1 } },
          { id: "face", name: "Face", crop: { x: 0.4, y: 0.4, width: 0.2, height: 0.2 } },
        ],
        presentation: {
          gallery: ["original", "landscape", "custom:edge", "custom:face"],
          home: ["custom:edge"],
        },
      },
      null,
      trim,
    );
    expect(remapped.landscape).toBeUndefined();
    expect(remapped.custom!.map((item) => item.id)).toEqual(["face"]);
    expect(remapped.presentation).toMatchObject({
      gallery: ["original", "custom:face"],
      home: [],
    });
  });
});
