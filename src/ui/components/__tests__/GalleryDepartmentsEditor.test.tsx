import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GalleryDepartmentsEditor } from "../GalleryDepartmentsEditor";
import { GalleryDepartment } from "@/src/domain/entities/GallerySettings";

const categories = [
  { id: "animal", name: "Animal" },
  { id: "street", name: "Street" },
  { id: "bw", name: "Black and white" },
  { id: "rain", name: "Rain" },
];

function Harness({
  initial,
  onChange = vi.fn(),
}: {
  initial?: GalleryDepartment[];
  onChange?: (value: GalleryDepartment[] | undefined) => void;
}) {
  const [departments, setDepartments] = useState(initial);
  return (
    <GalleryDepartmentsEditor
      categories={categories}
      settings={{ categories: [], departments }}
      disabled={false}
      onChange={(value) => {
        setDepartments(value);
        onChange(value);
      }}
    />
  );
}
const frame = () => act(() => new Promise(requestAnimationFrame));
const chipsOf = (name: string) =>
  within(screen.getByRole("list", { name })).queryAllByRole("button", {
    name: /^Move /,
  }).map((button) => button.textContent?.replace("⠿", ""));

describe("Gallery departments editor", () => {
  it("starts from the suggested departments and leaves the rest unsorted", () => {
    render(<Harness />);
    expect(screen.getByLabelText("Name of department 1")).toHaveValue("Subjects");
    expect(screen.getByLabelText("Name of department 2")).toHaveValue(
      "Color & treatment",
    );
    expect(chipsOf("Categories in Subjects")).toEqual(["Animal", "Street"]);
    expect(chipsOf("Unsorted categories")).toEqual(["Rain"]);
    expect(
      screen.queryByRole("button", { name: "Use suggested departments" }),
    ).not.toBeInTheDocument();
  });

  it("orders and moves categories with the arrow keys of their grips", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    screen.getByRole("button", { name: "Move Animal" }).focus();
    await user.keyboard("{ArrowRight}");
    await frame();
    expect(chipsOf("Categories in Subjects")).toEqual(["Street", "Animal"]);
    expect(screen.getByRole("button", { name: "Move Animal" })).toHaveFocus();
    expect(screen.getByText("Animal moved to Subjects, position 2.")).toBeInTheDocument();
    await user.keyboard("{ArrowLeft}");
    await frame();
    expect(chipsOf("Categories in Subjects")).toEqual(["Animal", "Street"]);
    await user.keyboard("{ArrowDown}");
    await frame();
    expect(chipsOf("Categories in Color & treatment")).toEqual([
      "Black and white",
      "Animal",
    ]);
    await user.keyboard("{ArrowDown}");
    await frame();
    expect(chipsOf("Unsorted categories")).toEqual(["Animal", "Rain"]);
    await user.keyboard("{ArrowUp}");
    await frame();
    expect(chipsOf("Categories in Color & treatment")).toContain("Animal");
    await user.keyboard("{ArrowUp}{ArrowUp}");
    await frame();
    expect(chipsOf("Categories in Subjects")).toEqual(["Street", "Animal"]);
    // Nothing above the first department.
    await user.keyboard("{ArrowUp}");
    expect(chipsOf("Categories in Subjects")).toEqual(["Street", "Animal"]);
    await user.click(
      screen.getByRole("button", { name: "Leave Street unsorted" }),
    );
    expect(onChange).toHaveBeenLastCalledWith([
      { id: "subjects", name: "Subjects", categoryIds: ["animal"] },
      { id: "color-treatment", name: "Color & treatment", categoryIds: ["bw"] },
    ]);
    await frame();
    expect(screen.getByRole("button", { name: "Move Street" })).toHaveFocus();
    // Rain waits unsorted; its up arrow joins the last department.
    screen.getByRole("button", { name: "Move Rain" }).focus();
    await user.keyboard("{ArrowUp}");
    await frame();
    expect(chipsOf("Categories in Color & treatment")).toEqual([
      "Black and white",
      "Rain",
    ]);
  });

  it("renames, adds, reorders and removes departments, and returns to the suggestion", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const name = screen.getByLabelText("Name of department 1");
    await user.clear(name);
    await user.type(name, "Who");
    expect(screen.getByLabelText("Name of department 1")).toHaveValue("Who");
    await user.click(screen.getByRole("button", { name: "+ Add department" }));
    await frame();
    expect(screen.getByLabelText("Name of department 3")).toHaveValue(
      "Department 3",
    );
    expect(screen.getByLabelText("Name of department 3")).toHaveFocus();
    screen.getByRole("button", { name: "Move department Department 3" }).focus();
    await user.keyboard("{ArrowUp}");
    await frame();
    expect(screen.getByLabelText("Name of department 2")).toHaveValue(
      "Department 3",
    );
    expect(
      screen.getByRole("button", { name: "Move department Department 3" }),
    ).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByLabelText("Name of department 3")).toHaveValue(
      "Department 3",
    );
    expect(screen.getByText("Drop categories here")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Remove department Who" }),
    );
    expect(chipsOf("Unsorted categories")).toEqual(["Animal", "Street", "Rain"]);
    await user.click(
      screen.getByRole("button", { name: "Use suggested departments" }),
    );
    expect(onChange).toHaveBeenLastCalledWith(undefined);
    expect(screen.getByLabelText("Name of department 1")).toHaveValue("Subjects");
  });

  it("drags categories between departments and departments into order", () => {
    render(
      <Harness
        initial={[
          { id: "a", name: "First", categoryIds: ["animal", "street", "gone"] },
          { id: "b", name: "Second", categoryIds: [] },
        ]}
      />,
    );
    const dataTransfer = { setData: vi.fn(), effectAllowed: "" };
    const chip = (name: string) =>
      screen.getByRole("button", { name: `Move ${name}` }).closest("li")!;
    // Street before Animal: on the first half of Animal's chip.
    fireEvent.dragStart(chip("Street"), { dataTransfer });
    expect(chip("Street")).toHaveAttribute("data-dragging", "true");
    fireEvent.dragOver(chip("Animal"), { dataTransfer, clientX: -1 });
    expect(chip("Animal")).toHaveAttribute("data-drop-before", "true");
    fireEvent.drop(chip("Animal"), { dataTransfer });
    expect(chipsOf("Categories in First")).toEqual(["Street", "Animal"]);
    // Into an empty department, then into the unsorted tray.
    const second = screen.getByRole("list", { name: "Categories in Second" })
      .parentElement!;
    fireEvent.dragStart(chip("Street"), { dataTransfer });
    fireEvent.dragOver(second, { dataTransfer });
    expect(second).toHaveAttribute("data-drop-target", "true");
    fireEvent.drop(second, { dataTransfer });
    expect(chipsOf("Categories in Second")).toEqual(["Street"]);
    const tray = screen.getByRole("list", { name: "Unsorted categories" })
      .parentElement!;
    fireEvent.dragStart(chip("Animal"), { dataTransfer });
    fireEvent.dragOver(tray, { dataTransfer });
    fireEvent.drop(tray, { dataTransfer });
    expect(chipsOf("Unsorted categories")).toContain("Animal");
    expect(screen.getByText("Drop categories here")).toBeInTheDocument();
    // Second before First.
    const grip = screen.getByRole("button", { name: "Move department Second" });
    fireEvent.dragStart(grip, { dataTransfer });
    const first = screen.getByRole("list", { name: "Categories in First" })
      .parentElement!;
    fireEvent.dragOver(first, { dataTransfer, clientY: -1 });
    expect(first).toHaveAttribute("data-drop-before", "true");
    fireEvent.drop(first, { dataTransfer });
    expect(screen.getByLabelText("Name of department 1")).toHaveValue("Second");
    // A drop without a drag in progress changes nothing.
    fireEvent.dragEnd(grip);
    fireEvent.drop(first, { dataTransfer });
    expect(screen.getByLabelText("Name of department 1")).toHaveValue("Second");
  });
});
