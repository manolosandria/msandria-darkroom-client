import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  titleFromFile,
  uploadRefusal,
} from "../uploadFiles";

const file = (name: string, type: string, size = 1024) => {
  const value = new File(["x"], name, { type });
  Object.defineProperty(value, "size", { value: size });
  return value;
};

describe("uploadRefusal", () => {
  it("accepts every format the API takes", () => {
    for (const type of ["jpeg", "png", "webp", "avif", "gif"])
      expect(uploadRefusal(file(`a.${type}`, `image/${type}`))).toBeNull();
  });

  it("names the file and the formats it could have been", () => {
    expect(uploadRefusal(file("scan.tiff", "image/tiff"))).toBe(
      "scan.tiff: choose a JPEG, PNG, WebP, AVIF or GIF.",
    );
  });

  it("refuses a file over 10 MB", () => {
    expect(
      uploadRefusal(file("big.jpg", "image/jpeg", MAX_UPLOAD_BYTES + 1)),
    ).toBe("big.jpg: exceeds the 10 MB limit.");
    expect(
      uploadRefusal(file("edge.jpg", "image/jpeg", MAX_UPLOAD_BYTES)),
    ).toBeNull();
  });
});

describe("titleFromFile", () => {
  it("drops the extension and turns underscores and dashes into spaces", () => {
    expect(titleFromFile(file("rain_on-the__glass.jpg", "image/jpeg"))).toBe(
      "rain on the glass",
    );
  });

  it("falls back when the name leaves nothing", () => {
    expect(titleFromFile(file("_.jpg", "image/jpeg"))).toBe("Untitled");
    expect(titleFromFile(file("-.png", "image/png"), "Variant")).toBe("Variant");
  });
});
