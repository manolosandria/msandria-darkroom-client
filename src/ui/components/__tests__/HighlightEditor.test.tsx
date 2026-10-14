import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhotoHighlights } from "@/src/domain/entities/PhotoHighlights";
import { HighlightEditor } from "../HighlightEditor";

// The editor is controlled, so the test holds the crops the way the upload card does.
function Harness({
  initial = {},
  disabled = false,
  onChange,
}: {
  initial?: PhotoHighlights;
  disabled?: boolean;
  onChange?: (value: PhotoHighlights) => void;
}) {
  const [highlights, setHighlights] = useState<PhotoHighlights>(initial);
  return (
    <HighlightEditor
      src="blob:photo"
      width={1800}
      height={1200}
      value={highlights}
      disabled={disabled}
      onChange={(value) => {
        setHighlights(value);
        onChange?.(value);
      }}
    />
  );
}

const stage = () => document.querySelector(".highlight-stage") as HTMLElement;

describe("HighlightEditor", () => {
  it("offers one shape at a time and keeps the others addable", async () => {
    render(<Harness />);

    expect(
      screen.getByRole("button", { name: "Add square highlight" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Portrait/ }));

    expect(
      screen.getByRole("button", { name: "Add portrait highlight" }),
    ).toBeInTheDocument();
  });

  // Nothing is cropped automatically: the first crop appears when it is asked for.
  it("proposes a crop inside the photo and previews it", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Add square highlight" }),
    );

    const { x, y, width, height } = onChange.mock.calls[0][0].square!;
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(x + width).toBeLessThanOrEqual(1);
    expect(y + height).toBeLessThanOrEqual(1);
    expect(
      screen.getByAltText("square thumbnail preview"),
    ).toBeInTheDocument();
  });

  it("marks the shapes that already have a crop", async () => {
    render(<Harness initial={{ landscape: { x: 0, y: 0, width: 1, height: 0.6 } }} />);

    expect(screen.getByRole("button", { name: /Landscape · 3:2 ✓/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Square · 1:1" })).toBeInTheDocument();
  });

  it("removes only the shape on screen", async () => {
    const onChange = vi.fn();
    render(
      <Harness
        initial={{
          square: { x: 0, y: 0, width: 0.5, height: 0.5 },
          portrait: { x: 0, y: 0, width: 0.3, height: 0.9 },
        }}
        onChange={onChange}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Remove square highlight" }),
    );

    expect(onChange).toHaveBeenCalledWith({
      portrait: { x: 0, y: 0, width: 0.3, height: 0.9 },
    });
  });

  // The slider is the keyboard way in, and a bigger crop still has to fit.
  it("resizes without leaving the photo", async () => {
    const onChange = vi.fn();
    render(
      <Harness
        initial={{ square: { x: 0.55, y: 0.3, width: 0.4, height: 0.6 } }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Crop size"), {
      target: { value: "100" },
    });

    const { x, y, width, height } = onChange.mock.calls[0][0].square!;
    expect(x + width).toBeLessThanOrEqual(1);
    expect(y + height).toBeLessThanOrEqual(1);
  });

  it("moves the crop where it is dragged", async () => {
    const onChange = vi.fn();
    render(
      <Harness
        initial={{ square: { x: 0, y: 0, width: 0.4, height: 0.6 } }}
        onChange={onChange}
      />,
    );
    const target = stage();
    target.setPointerCapture = vi.fn();
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 600,
      height: 400,
    } as DOMRect);

    fireEvent.pointerDown(target, { pointerId: 1, clientX: 300, clientY: 200 });

    // Dropped at the middle of the stage, the crop centres itself there.
    expect(onChange).toHaveBeenCalledWith({
      square: expect.objectContaining({ x: 0.3, y: 0.2 }),
    });
  });

  it("stays put while the photo is being published", async () => {
    render(
      <Harness disabled initial={{ square: { x: 0, y: 0, width: 0.5, height: 0.5 } }} />,
    );

    expect(
      screen.getByRole("button", { name: "Remove square highlight" }),
    ).toBeDisabled();
  });
});
