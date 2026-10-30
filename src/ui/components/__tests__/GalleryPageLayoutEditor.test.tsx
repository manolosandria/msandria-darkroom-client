import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  buildGroups,
  flattenGroups,
  GalleryPageLayoutEditor,
} from "../GalleryPageLayoutEditor";
import { defaultGalleryPageLayout } from "@/src/domain/entities/GallerySettings";

describe("Gallery page layout editor", () => {
  it("turns cards into a reading order with joins and back", () => {
    const groups: ("heading" | "filters" | "photos")[][] = [
      ["filters"],
      ["heading", "photos"],
    ];
    const flat = flattenGroups(groups);
    expect(flat).toEqual({
      order: ["filters", "heading", "photos"],
      joined: [false, true],
    });
    expect(buildGroups(flat.order, flat.joined)).toEqual(groups);
  });

  it("chooses a drawing, joins or splits cards, reorders blocks and sets placement and alignment", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <GalleryPageLayoutEditor disabled={false} onChange={onChange} />,
    );
    expect(
      screen.getByRole("button", { name: /Title and filters together/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: /All in one card/ }));
    expect(onChange).toHaveBeenLastCalledWith({
      ...defaultGalleryPageLayout,
      groups: [["heading", "filters", "photos"]],
    });
    await user.click(screen.getByRole("button", { name: "New card" }));
    expect(onChange).toHaveBeenLastCalledWith({
      ...defaultGalleryPageLayout,
      groups: [["heading", "filters", "photos"]],
    });
    await user.click(screen.getByRole("button", { name: "Same card" }));
    expect(onChange).toHaveBeenLastCalledWith({
      ...defaultGalleryPageLayout,
      groups: [["heading"], ["filters"], ["photos"]],
    });
    await user.click(
      screen.getByRole("button", { name: "Move Photographs earlier" }),
    );
    expect(onChange).toHaveBeenLastCalledWith({
      ...defaultGalleryPageLayout,
      groups: [["heading", "photos"], ["filters"]],
    });
    expect(
      screen.getByRole("button", { name: "Move Title earlier" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: "Below the title" }));
    expect(onChange).toHaveBeenLastCalledWith({
      ...defaultGalleryPageLayout,
      filtersPlacement: "below",
    });
    rerender(
      <GalleryPageLayoutEditor
        value={{ ...defaultGalleryPageLayout, headingAlign: "end" }}
        disabled={false}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("radio", { name: "Right" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await user.click(screen.getByRole("radio", { name: "Centered" }));
    expect(onChange).toHaveBeenLastCalledWith({
      ...defaultGalleryPageLayout,
      headingAlign: "center",
    });
  });
});
