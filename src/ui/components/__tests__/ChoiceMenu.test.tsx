import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Choice, ChoiceMenu } from "../ChoiceMenu";

const options: Choice<string>[] = [
  { value: "dots", label: "Dots" },
  { value: "thumbs", label: "Thumbnails", description: "Small photographs" },
  { value: "bar", label: "Progress bar", disabled: true },
  { value: "none", label: "None", swatch: ["#000", "#fff"] },
];

function Menu({ onChange = vi.fn() }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState("dots");
  return (
    <label>
      Navigation
      <ChoiceMenu
        value={value}
        options={options}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    </label>
  );
}

describe("ChoiceMenu", () => {
  it("is named by its label and picks an option with the pointer", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Menu onChange={onChange} />);
    const button = screen.getByLabelText("Navigation");
    expect(button).toHaveTextContent("Dots");
    expect(screen.queryByRole("listbox")).toBeNull();

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("option", { name: "Dots" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("option", { name: "Thumbnails" }),
    ).toHaveAccessibleDescription("Small photographs");
    await user.click(screen.getByRole("option", { name: "Thumbnails" }));

    expect(onChange).toHaveBeenCalledWith("thumbs");
    expect(button).toHaveTextContent("Thumbnails");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("ignores a disabled option and the one already chosen", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Menu onChange={onChange} />);
    await user.click(screen.getByLabelText("Navigation"));
    await user.click(screen.getByRole("option", { name: "Progress bar" }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Dots" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("moves with the arrow keys past disabled options and picks with Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Menu onChange={onChange} />);
    const button = screen.getByLabelText("Navigation");
    button.focus();
    await user.keyboard("{ArrowDown}");
    expect(button).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(button).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "None" }).id,
    );
    await user.keyboard("{Home}{ArrowUp}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("none");
    await user.keyboard("{ArrowUp}{End}{Escape}");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("jumps to an option by typing its first letters, open or closed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Menu onChange={onChange} />);
    const button = screen.getByLabelText("Navigation");
    button.focus();
    await user.keyboard("th");
    expect(onChange).toHaveBeenLastCalledWith("thumbs");
    await user.keyboard("{ArrowDown}");
    await user.keyboard("zz");
    expect(button).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "Thumbnails" }).id,
    );
    // An arrow key starts the typed letters afresh.
    await user.keyboard("{ArrowUp}{ArrowDown}n");
    expect(button).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "None" }).id,
    );
    await user.keyboard(" ");
    expect(onChange).toHaveBeenLastCalledWith("none");
  });

  it("closes on a press outside and on Tab", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Menu />
        <button type="button">Elsewhere</button>
      </>,
    );
    const button = screen.getByLabelText("Navigation");
    await user.click(button);
    fireEvent.pointerDown(screen.getByText("Elsewhere"));
    expect(button).toHaveAttribute("aria-expanded", "false");
    await user.click(button);
    await user.click(screen.getByRole("option", { name: "Dots" }));
    await user.click(button);
    await user.tab();
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("opens upwards near the bottom of the window and shows a placeholder", async () => {
    const user = userEvent.setup();
    const spy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ top: 700, bottom: 740 } as DOMRect);
    render(
      <ChoiceMenu
        value=""
        options={[{ value: "a", label: "Alpha", icon: <svg /> }]}
        onChange={vi.fn()}
        ariaLabel="Letter"
        placeholder="Pick one"
      />,
    );
    const button = screen.getByRole("combobox", { name: "Letter" });
    expect(button).toHaveTextContent("Pick one");
    await user.click(button);
    expect(button.parentElement).toHaveClass("opens-up");
    spy.mockRestore();
  });
});
