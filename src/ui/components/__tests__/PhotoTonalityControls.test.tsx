import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  PhotoTonalityField,
  TonalityBackfill,
} from "../PhotoTonalityControls";

vi.mock("@/src/infrastructure/photoServices", () => ({
  classifyPhotoTonality: { execute: vi.fn() },
}));

describe("PhotoTonalityField", () => {
  it("says when a photo is not classified and chooses with a click or the arrows", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <PhotoTonalityField value={null} onChange={onChange} />,
    );
    expect(screen.getByText("Not classified yet")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Color" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    await userEvent.click(screen.getByRole("radio", { name: "Black & white" }));
    expect(onChange).toHaveBeenLastCalledWith("MONOCHROME");
    rerender(<PhotoTonalityField value="MONOCHROME" onChange={onChange} />);
    expect(
      screen.getByRole("radio", { name: "Black & white" }),
    ).toHaveAttribute("aria-checked", "true");
    screen.getByRole("radio", { name: "Black & white" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("COLOR");
    onChange.mockClear();
    // Choosing the current one changes nothing.
    await userEvent.click(screen.getByRole("radio", { name: "Black & white" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("TonalityBackfill", () => {
  it("classifies batch after batch until none are left, then reloads", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ classified: 20, failed: 0, remaining: 5 })
      .mockResolvedValueOnce({ classified: 4, failed: 1, remaining: 1 })
      .mockResolvedValueOnce({ classified: 0, failed: 1, remaining: 1 });
    const onDone = vi.fn();
    render(
      <TonalityBackfill
        pending={25}
        onDone={onDone}
        classify={{ execute }}
      />,
    );
    expect(screen.getByText(/25 photos are not classified/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Classify them" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(execute).toHaveBeenCalledTimes(3);
    expect(screen.getByText("24 photos classified")).toBeVisible();
    expect(screen.getByText(/1 could not be read/)).toBeVisible();
  });

  it("shows nothing when every photo is classified and explains a failure", async () => {
    const { container, rerender } = render(
      <TonalityBackfill pending={0} onDone={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
    const execute = vi.fn().mockRejectedValue(new Error("offline"));
    const onDone = vi.fn();
    rerender(
      <TonalityBackfill pending={1} onDone={onDone} classify={{ execute }} />,
    );
    expect(screen.getByText(/1 photo is not classified/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Classify them" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Classify them" })).toBeEnabled(),
    );
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).not.toBe("");
  });
});
