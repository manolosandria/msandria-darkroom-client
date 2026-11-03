import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { defaultGallerySettings } from "@/src/domain/entities/GallerySettings";
import {
  defaultFilterLayout,
  FilterGroup,
  placedPieces,
} from "@/src/domain/galleryFilterLayout";
import { GalleryFilterPieces } from "../GalleryFilterPieces";
import { GalleryFilters } from "../GalleryFilters";

const categories = [{ id: "animal", name: "animal" }] as never[];

describe("GalleryFilterPieces", () => {
  it("switches pieces on and off the bar", () => {
    const onChange = vi.fn();
    render(
      <GalleryFilterPieces
        categories={categories}
        settings={{ ...defaultGallerySettings, filterLayout: defaultFilterLayout() }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "View options" }));
    expect(placedPieces(onChange.mock.lastCall![0] as FilterGroup).has("view")).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Reset" }));
    expect(placedPieces(onChange.mock.lastCall![0] as FilterGroup).has("reset")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "+ Container" }));
    expect((onChange.mock.lastCall![0] as FilterGroup).children.at(-1)).toMatchObject({
      type: "group",
      surface: "card",
    });
  });
});

describe("GalleryFilterPieces beside the preview", () => {
  it("lights the piece pointed at in the list where the preview shows it", () => {
    render(
      <>
        <GalleryFilterPieces
          categories={categories}
          settings={defaultGallerySettings}
          onChange={() => {}}
        />
        <GalleryFilters
          categories={categories}
          settings={defaultGallerySettings}
          selected={[]}
          onChange={() => {}}
          search={<input aria-label="Search" />}
          count={<span>3 photographs</span>}
          onArrange={() => {}}
        />
      </>,
    );
    const item = screen.getByRole("checkbox", { name: "Search" }).closest("li")!;
    const piece = document.querySelector('[data-filter-piece="search"]')!;
    fireEvent.pointerEnter(item);
    expect(piece).toHaveAttribute("data-spotlight");
    fireEvent.pointerLeave(item);
    expect(piece).not.toHaveAttribute("data-spotlight");
  });
});

describe("GalleryFilters arranged in the preview", () => {
  it("gives every piece and container a grip, starting from the usual bar", () => {
    render(
      <GalleryFilters
        categories={categories}
        settings={defaultGallerySettings}
        selected={[]}
        onChange={() => {}}
        search={<input aria-label="Search" />}
        count={<span>3 photographs</span>}
        onArrange={() => {}}
      />,
    );
    const grips = document.querySelectorAll("[data-filter-grip]");
    expect(Array.from(grips).map((grip) => grip.getAttribute("data-filter-grip"))).toEqual(
      expect.arrayContaining(["bar", "meta", "search", "count"]),
    );
    expect(document.querySelector(".gallery-browse.is-arranging")).not.toBeNull();
  });
});
