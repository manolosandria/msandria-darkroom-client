import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GalleryFilters } from "../GalleryFilters";
import {
  defaultFilterLayout,
  placeFilterNode,
} from "@/src/domain/galleryFilterLayout";

const categories = [
  { id: "animal", name: "Animal" },
  { id: "street", name: "Street" },
  { id: "bw", name: "Monochrome" },
  { id: "rain", name: "Rain" },
];
const departments = [
  { id: "mood", name: "Mood", categoryIds: ["rain"] },
  { id: "subjects", name: "Subjects", categoryIds: ["street", "animal"] },
];

function Harness({
  onChange = vi.fn(),
}: {
  onChange?: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <>
      <GalleryFilters
        categories={categories}
        settings={{ categories: [], departments }}
        selected={selected}
        onChange={(ids) => {
          setSelected(ids);
          onChange(ids);
        }}
        search={<input aria-label="Search" />}
        count={<span>12 photographs</span>}
        display={<button type="button">Squares</button>}
      />
      <button>Outside</button>
    </>
  );
}
const filtersButton = () => screen.getByRole("button", { name: /^Filters/ });

describe("Gallery filters", () => {
  it("keeps search, one Filters button, reset and the count in the bar", () => {
    render(<Harness />);
    const bar = screen.getByRole("region", { name: "Gallery filters" });
    expect(within(bar).getByLabelText("Search")).toBeInTheDocument();
    expect(filtersButton()).toHaveAttribute("aria-expanded", "false");
    expect(
      within(bar).getByRole("button", { name: "Clear all filters" }),
    ).toBeDisabled();
    expect(within(bar).getByText("12 photographs")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Squares" })).toBeNull();
  });

  it("opens one panel with every department as a column and the view options", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const panel = document.getElementById(
      filtersButton().getAttribute("aria-controls")!,
    )!;
    expect(panel).toHaveAttribute("aria-label", "Filters and view");
    expect(panel).not.toBeVisible();
    await user.click(filtersButton());
    expect(panel).toBeVisible();
    expect(filtersButton()).toHaveAttribute("aria-expanded", "true");
    expect(
      within(panel)
        .getAllByRole("group")
        .map((group) => group.getAttribute("aria-label")),
    ).toEqual(["Mood", "Subjects", "Other", "View"]);
    expect(
      within(within(panel).getByRole("group", { name: "Subjects" }))
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Street", "Animal"]);
    expect(
      within(panel).getByRole("button", { name: "Squares" }),
    ).toBeVisible();
    await user.click(within(panel).getByRole("button", { name: "Rain" }));
    await user.click(within(panel).getByRole("button", { name: "Animal" }));
    expect(onChange).toHaveBeenLastCalledWith(["rain", "animal"]);
    expect(within(filtersButton()).getByText("2")).toBeInTheDocument();
    expect(
      within(panel).getByRole("group", { name: "Subjects" }),
    ).toHaveAttribute("data-current", "true");
    const chips = screen.getByRole("list", { name: "Active filters" });
    expect(chips).toHaveTextContent("MoodRain");
    await user.click(
      within(chips).getByRole("button", { name: "Remove filter Rain" }),
    );
    expect(onChange).toHaveBeenLastCalledWith(["animal"]);
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(panel).not.toBeVisible();
    expect(filtersButton()).toHaveFocus();
  });

  it("moves through departments and categories with the keyboard", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    filtersButton().focus();
    await user.keyboard("{ArrowDown}");
    await act(() => new Promise(requestAnimationFrame));
    expect(screen.getByRole("button", { name: "Rain" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Street" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Animal" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Monochrome" })).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("button", { name: "Street" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}{ArrowUp}");
    expect(filtersButton()).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    await act(() => new Promise(requestAnimationFrame));
    await user.keyboard("{Escape}");
    expect(document.querySelector(".gallery-browse__panel")).not.toBeVisible();
    expect(filtersButton()).toHaveFocus();
  });

  it("closes on a press outside", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(filtersButton());
    expect(filtersButton()).toHaveAttribute("aria-expanded", "true");
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    expect(filtersButton()).toHaveAttribute("aria-expanded", "false");
  });

  it("builds the bar from the arranged tree, moving pieces out of the panel", () => {
    const onChange = vi.fn();
    let filterLayout = placeFilterNode(
      defaultFilterLayout(),
      { id: "department-mood", type: "department", departmentId: "mood" },
      "meta",
      0,
    );
    filterLayout = placeFilterNode(
      filterLayout,
      { id: "view", type: "view" },
      "bar",
      3,
    );
    render(
      <GalleryFilters
        categories={categories}
        settings={{ categories: [], departments }}
        layout={filterLayout}
        selected={[]}
        onChange={onChange}
        search={<input aria-label="Search" />}
        count={<span>12 photographs</span>}
        display={<button type="button">Squares</button>}
      />,
    );
    const bar = screen.getByRole("region", { name: "Gallery filters" });
    const mood = within(bar).getByRole("group", { name: "Mood" });
    fireEvent.click(within(mood).getByRole("button", { name: "Rain" }));
    expect(onChange).toHaveBeenLastCalledWith(["rain"]);
    expect(
      within(within(bar).getByRole("group", { name: "View" })).getByRole(
        "button",
        { name: "Squares" },
      ),
    ).toBeVisible();
  });
});
