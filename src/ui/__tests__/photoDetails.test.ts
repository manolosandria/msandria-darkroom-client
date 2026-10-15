import { describe, expect, it } from "vitest";
import { formatCamera, formatExposure, photoDetails } from "../photoDetails";

describe("photoDetails", () => {
  it("lists what was recorded, in a fixed order and in photographers' notation", () => {
    expect(
      photoDetails({
        capturedAt: "2024-05-10T20:23:01.000Z",
        camera: {
          make: "Canon",
          model: "Canon EOS R6",
          lens: "RF50mm F1.8 STM",
          iso: 400,
          aperture: 2.8,
          exposureTime: 0.004,
          focalLength: 50,
        },
      }),
    ).toEqual([
      { label: "Captured", value: "May 10, 2024" },
      { label: "Camera", value: "Canon EOS R6" },
      { label: "Lens", value: "RF50mm F1.8 STM" },
      { label: "Focal length", value: "50 mm" },
      { label: "Aperture", value: "f/2.8" },
      { label: "Shutter speed", value: "1/250 s" },
      { label: "ISO", value: "400" },
    ]);
  });

  it("leaves out whatever is missing", () => {
    expect(photoDetails({})).toEqual([]);
    expect(
      photoDetails({
        capturedAt: null,
        camera: { make: null, model: null, lens: null, iso: 100, aperture: null, exposureTime: null, focalLength: null },
      }),
    ).toEqual([{ label: "ISO", value: "100" }]);
  });

  it("dates the capture in the project's time zone, not the visitor's", () => {
    // 03:00 UTC on the 11th is still the 10th in Mexico City.
    expect(photoDetails({ capturedAt: "2024-05-11T03:00:00.000Z" })[0].value).toBe("May 10, 2024");
  });

  it("skips a capture date it cannot read", () => {
    expect(photoDetails({ capturedAt: "not a date" })).toEqual([]);
  });
});

describe("formatExposure", () => {
  it("writes fast shutter speeds as fractions and slow ones in seconds", () => {
    expect(formatExposure(1 / 125)).toBe("1/125 s");
    expect(formatExposure(0.3)).toBe("1/3 s");
    expect(formatExposure(2.5)).toBe("2.5 s");
    expect(formatExposure(30)).toBe("30 s");
  });
});

describe("formatCamera", () => {
  it("adds the make only when the model does not already name it", () => {
    expect(formatCamera("NIKON CORPORATION", "NIKON Z 6")).toBe("NIKON Z 6");
    expect(formatCamera("FUJIFILM", "X-T4")).toBe("FUJIFILM X-T4");
    expect(formatCamera("Apple", null)).toBe("Apple");
    expect(formatCamera(null, "X100V")).toBe("X100V");
  });
});
