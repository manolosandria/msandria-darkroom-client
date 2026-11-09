import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { PostDatePicker } from "../PostDatePicker";

function Picker({ initial = "2026-11-09T16:37" }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <PostDatePicker value={value} onChange={setValue} />
      <output aria-label="Stored date">{value}</output>
    </>
  );
}

describe("PostDatePicker", () => {
  it("chooses dates across months, preserves time and clears to publication time", async () => {
    render(<Picker />);
    await userEvent.click(
      screen.getByRole("button", { name: /Publication date/ }),
    );
    expect(
      screen.getByRole("button", { name: "Monday, November 9, 2026" }),
    ).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Next month" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Tuesday, December 15, 2026" }),
    );
    expect(screen.getByLabelText("Stored date")).toHaveTextContent(
      "2026-12-15T16:37",
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Publication hour"),
      "09",
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Publication minute"),
      "05",
    );
    expect(screen.getByLabelText("Stored date")).toHaveTextContent(
      "2026-12-15T09:05",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "When published" }),
    );
    expect(screen.getByLabelText("Stored date")).toBeEmptyDOMElement();
    expect(
      screen.queryByRole("group", { name: "Choose publication date" }),
    ).toBeNull();
  });

  it("handles a leap day and closes with Escape without changing the selection", async () => {
    render(<Picker initial="2028-02-28T00:00" />);
    const trigger = screen.getByRole("button", { name: /Publication date/ });
    await userEvent.click(trigger);
    await userEvent.click(
      screen.getByRole("button", { name: "Tuesday, February 29, 2028" }),
    );
    await userEvent.keyboard("{Escape}");
    expect(screen.getByLabelText("Stored date")).toHaveTextContent(
      "2028-02-29T00:00",
    );
    expect(trigger).toHaveFocus();
  });
});
