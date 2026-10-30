import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GalleryFilters } from "../GalleryFilters";

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

function Harness({ onChange = vi.fn() }: { onChange?: (ids: string[]) => void }) {
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
        display={<span>12 photographs</span>}
      />
      <button>Outside</button>
    </>
  );
}

describe("Gallery filters", () => {
  it("offers the curator's departments in one bar with search and display", () => {
    render(<Harness />);
    const bar = screen.getByRole("region", { name: "Gallery filters" });
    expect(within(bar).getByLabelText("Search")).toBeInTheDocument();
    expect(
      within(screen.getByRole("toolbar", { name: "Departments" }))
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Mood", "Subjects", "Other"]);
    expect(within(bar).getByText("12 photographs")).toBeInTheDocument();
  });

  it("opens one panel where every department is a column", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const panel = document.getElementById(
      screen.getByRole("button", { name: "Subjects" }).getAttribute("aria-controls")!,
    )!;
    expect(panel).toHaveAttribute("aria-label", "Browse by department");
    expect(panel).not.toBeVisible();
    await user.click(screen.getByRole("button", { name: "Subjects" }));
    expect(panel).toBeVisible();
    expect(screen.getByRole("button", { name: "Subjects" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      within(panel)
        .getAllByRole("group")
        .map((group) => group.getAttribute("aria-label")),
    ).toEqual(["Mood", "Subjects", "Other"]);
    const subjects = within(panel).getByRole("group", { name: "Subjects" });
    expect(subjects).toHaveAttribute("data-current", "true");
    expect(
      within(subjects)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Street", "Animal"]);
    await user.click(within(panel).getByRole("button", { name: "Rain" }));
    await user.click(within(panel).getByRole("button", { name: "Animal" }));
    expect(onChange).toHaveBeenLastCalledWith(["rain", "animal"]);
    expect(
      within(screen.getByRole("button", { name: /Subjects/ })).getByText("1"),
    ).toBeInTheDocument();
    const chips = screen.getByRole("list", { name: "Active filters" });
    expect(chips).toHaveTextContent("MoodRain");
    await user.click(
      within(chips).getByRole("button", { name: "Remove filter Rain" }),
    );
    expect(onChange).toHaveBeenLastCalledWith(["animal"]);
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(panel).not.toBeVisible();
    expect(screen.getByRole("button", { name: /Subjects/ })).toHaveFocus();
  });

  it("moves through departments and categories with the keyboard", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole("button", { name: "Mood" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Subjects" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Other" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    await act(() => new Promise(requestAnimationFrame));
    expect(screen.getByRole("button", { name: "Monochrome" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Street" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Animal" })).toHaveFocus();
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(screen.getByRole("button", { name: "Subjects" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    await act(() => new Promise(requestAnimationFrame));
    await user.keyboard("{ArrowRight}{Escape}");
    expect(document.querySelector(".gallery-browse__panel")).not.toBeVisible();
    expect(screen.getByRole("button", { name: "Other" })).toHaveFocus();
  });

  it("closes on a press outside and opens on hover with the mouse", async () => {
    vi.useFakeTimers();
    try {
      render(<Harness />);
      const mood = screen.getByRole("button", { name: "Mood" });
      fireEvent.pointerEnter(mood, { pointerType: "mouse" });
      act(() => vi.advanceTimersByTime(200));
      expect(mood).toHaveAttribute("aria-expanded", "true");
      // A click right after the hover opened it keeps it open.
      fireEvent.click(mood);
      expect(mood).toHaveAttribute("aria-expanded", "true");
      fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
      expect(mood).toHaveAttribute("aria-expanded", "false");
      fireEvent.pointerEnter(mood, { pointerType: "mouse" });
      act(() => vi.advanceTimersByTime(200));
      fireEvent.pointerLeave(
        screen.getByRole("region", { name: "Gallery filters" }),
        { pointerType: "mouse" },
      );
      act(() => vi.advanceTimersByTime(400));
      expect(mood).toHaveAttribute("aria-expanded", "false");
    } finally {
      vi.useRealTimers();
    }
  });
});
