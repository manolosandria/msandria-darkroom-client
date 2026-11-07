import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findBorder, trimmedPreview } from "../borderTrimImage";

/** An image element that "loads" with the given size, or fails. */
function stubImage(width: number, height: number, fails = false) {
  class FakeImage {
    naturalWidth = width;
    naturalHeight = height;
    onload: () => void = () => undefined;
    onerror: () => void = () => undefined;
    set src(_value: string) {
      queueMicrotask(() => (fails ? this.onerror() : this.onload()));
    }
  }
  vi.stubGlobal("Image", FakeImage);
}

const context = {
  drawImage: vi.fn(),
  getImageData: vi.fn(),
};
let blob: Blob | null = new Blob(["x"]);

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done) =>
    done(blob),
  );
  vi.stubGlobal(
    "URL",
    Object.assign(URL, { createObjectURL: vi.fn(() => "blob:trimmed") }),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  blob = new Blob(["x"]);
});

describe("findBorder", () => {
  it("samples a large image down before looking for its border", async () => {
    stubImage(4000, 3000);
    const width = 2000;
    const height = 1500;
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    // A busy photograph between two white bands of 300 sampled lines.
    for (let y = 300; y < 1200; y++)
      for (let x = 0; x < width; x++)
        data.set([(x * 31) % 256, (y * 17) % 256, 0], (y * width + x) * 4);
    context.getImageData.mockReturnValue({ data });

    const trim = await findBorder("blob:original");

    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2000, 1500);
    expect(trim?.y).toBeCloseTo(301 / 1500);
    expect(trim?.width).toBe(1);
  });

  it("fails when the image cannot be read", async () => {
    stubImage(10, 10, true);
    await expect(findBorder("blob:broken")).rejects.toThrow(/could not be read/);
  });

  it("fails when the browser has no canvas", async () => {
    stubImage(10, 10);
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    await expect(findBorder("blob:a")).rejects.toThrow(/cannot read/);
  });
});

describe("trimmedPreview", () => {
  it("draws only the kept part, capped for the editors", async () => {
    stubImage(6000, 4000);

    const url = await trimmedPreview("blob:original", {
      x: 0,
      y: 0.25,
      width: 1,
      height: 0.5,
    });

    expect(url).toBe("blob:trimmed");
    expect(context.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      1000,
      6000,
      2000,
      0,
      0,
      2560,
      853,
    );
  });

  it("fails when the canvas cannot be encoded", async () => {
    stubImage(100, 100);
    blob = null;
    await expect(
      trimmedPreview("blob:a", { x: 0, y: 0, width: 1, height: 1 }),
    ).rejects.toThrow(/could not be drawn/);
  });
});
