import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { GalleryFilterBuilder } from "../GalleryFilterBuilder";
import { defaultGallerySettings } from "@/src/domain/entities/GallerySettings";
import { FilterGroup, findFilterNode } from "@/src/domain/galleryFilterLayout";

function Harness({
  onChange = vi.fn(),
}: {
  onChange?: (layout: FilterGroup | undefined) => void;
}) {
  const [filterLayout, setLayout] = useState<FilterGroup | undefined>();
  return (
    <GalleryFilterBuilder
      categories={[{ id: "animal", name: "Animal" }]}
      settings={{ ...defaultGallerySettings, filterLayout }}
      onChange={(next) => {
        setLayout(next);
        onChange(next);
      }}
    />
  );
}

describe("GalleryFilterBuilder", () => {
  it("keeps the usual bar until the curator starts arranging it", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    expect(screen.getByText(/shows its usual bar/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Arrange the filter bar" }),
    );
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "root", type: "group" }),
    );
    expect(
      screen.getByRole("list", { name: "Filter bar structure" }),
    ).toBeInTheDocument();
  });

  it("adds a piece with a button and returns to the usual bar", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Arrange the filter bar" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Add View options to the filter bar",
      }),
    );
    const layout = onChange.mock.lastCall![0] as FilterGroup;
    expect(findFilterNode(layout, "view")).not.toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Remove View options" }),
    );
    expect(
      findFilterNode(onChange.mock.lastCall![0] as FilterGroup, "view"),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Use the usual bar" }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it("moves a piece earlier with its button", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Arrange the filter bar" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Move Reset earlier" }));
    const bar = findFilterNode(
      onChange.mock.lastCall![0] as FilterGroup,
      "bar",
    )!.node as FilterGroup;
    expect(bar.children.map((child) => child.id)).toEqual([
      "search",
      "reset",
      "filters",
    ]);
  });
});
