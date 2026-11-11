import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  cameraName,
  formatRange,
  GalleryMetadataFilters,
  hasMetadataFacets,
  metadataChips,
} from "../GalleryMetadataFilters";
import {
  emptyMetadataFilters,
  PhotoFacets,
} from "@/src/domain/entities/PhotoMetadataFilters";

const facets: PhotoFacets = {
  cameras: [
    { value: "FUJIFILM|X-T4", make: "FUJIFILM", model: "X-T4", count: 3 },
    { value: "Canon|Canon EOS R6", make: "Canon", model: "Canon EOS R6", count: 1 },
  ],
  lenses: [{ value: "XF23mmF1.4 R", count: 2 }],
  focalLength: { min: 23, max: 85 },
  exposureTime: { min: 1 / 1000, max: 1 / 60 },
  aperture: { min: 2, max: 2 },
  iso: null,
  tonality: { color: 3, monochrome: 1 },
};

describe("GalleryMetadataFilters", () => {
  it("offers tone, cameras, lenses and the ranges that vary", async () => {
    const onChange = vi.fn();
    render(
      <GalleryMetadataFilters
        facets={facets}
        value={emptyMetadataFilters()}
        onChange={onChange}
      />,
    );
    expect(
      screen.getByRole("group", { name: "Camera and exposure" }),
    ).toBeInTheDocument();
    // Aperture does not vary and ISO is unknown: nothing to choose.
    expect(screen.getByRole("group", { name: "Focal length" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Shutter speed" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Aperture" })).toBeNull();
    expect(screen.queryByRole("group", { name: "ISO" })).toBeNull();

    await userEvent.click(screen.getByRole("radio", { name: "Black & white" }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ tone: "monochrome" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "FUJIFILM X-T4" }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ cameras: ["FUJIFILM|X-T4"] }),
    );
    // A model that already names its brand is not repeated.
    expect(screen.getByRole("button", { name: "Canon EOS R6" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "XF23mmF1.4 R" }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ lenses: ["XF23mmF1.4 R"] }),
    );
  });

  it("removes a chosen camera and commits a range a moment after the slider stops", () => {
    vi.useFakeTimers();
    try {
      const onChange = vi.fn();
      render(
        <GalleryMetadataFilters
          facets={facets}
          value={{ ...emptyMetadataFilters(), cameras: ["FUJIFILM|X-T4"] }}
          onChange={onChange}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "FUJIFILM X-T4" }));
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ cameras: [] }),
      );
      onChange.mockClear();
      const [from, to] = screen.getAllByRole("slider").slice(0, 2);
      // Focal stops between 23 and 85: 23, 24, 28, 35, 40, 50, 60, 70, 85.
      fireEvent.change(from, { target: { value: "3" } });
      fireEvent.change(to, { target: { value: "5" } });
      expect(screen.getByText("35 mm – 50 mm")).toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(400));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ focalLength: { min: 35, max: 50 } }),
      );
      // The low end cannot pass the high one; back at the limits, the range is open.
      fireEvent.change(from, { target: { value: "8" } });
      fireEvent.change(to, { target: { value: "8" } });
      fireEvent.change(from, { target: { value: "0" } });
      act(() => vi.advanceTimersByTime(400));
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ focalLength: {} }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("follows a range changed from outside", () => {
    const { rerender } = render(
      <GalleryMetadataFilters
        facets={facets}
        value={{ ...emptyMetadataFilters(), focalLength: { min: 35 } }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("≥ 35 mm")).toBeInTheDocument();
    rerender(
      <GalleryMetadataFilters
        facets={facets}
        value={emptyMetadataFilters()}
        onChange={() => {}}
      />,
    );
    expect(screen.getAllByText("Any").length).toBeGreaterThan(0);
  });
});

describe("metadata chips and labels", () => {
  it("names each choice and what is left without it", () => {
    const filters = {
      ...emptyMetadataFilters(),
      cameras: ["FUJIFILM|X-T4"],
      lenses: ["XF23"],
      exposureTime: { max: 1 / 250 },
      iso: { min: 400, max: 400 },
      tone: "color" as const,
    };
    const chips = metadataChips(filters);
    expect(chips.map((chip) => [chip.department, chip.label])).toEqual([
      ["Tone", "Color"],
      ["Camera", "FUJIFILM X-T4"],
      ["Lens", "XF23"],
      ["Shutter speed", "≤ 1/250 s"],
      ["ISO", "ISO 400"],
    ]);
    expect(chips[1].without.cameras).toEqual([]);
    expect(chips[2].without.lenses).toEqual([]);
    expect(chips[0].without.tone).toBeUndefined();
    expect(chips[4].without.iso).toEqual({});
    expect(formatRange("aperture", { min: 2, max: 8 })).toBe("f/2 – f/8");
    expect(cameraName("|iPhone 15")).toBe("iPhone 15");
    expect(cameraName("Leica|")).toBe("Leica");
  });

  it("knows when the facets offer nothing", () => {
    expect(hasMetadataFacets(null)).toBe(false);
    expect(
      hasMetadataFacets({
        cameras: [],
        lenses: [],
        focalLength: { min: 50, max: 50 },
        exposureTime: null,
        aperture: null,
        iso: null,
        tonality: { color: 0, monochrome: 0 },
      }),
    ).toBe(false);
    expect(hasMetadataFacets(facets)).toBe(true);
  });
});
