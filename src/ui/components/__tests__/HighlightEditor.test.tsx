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
    expect(screen.getByAltText("square thumbnail preview")).toBeInTheDocument();
  });

  it("marks the shapes that already have a crop", async () => {
    render(
      <Harness
        initial={{ landscape: { x: 0, y: 0, width: 1, height: 0.6 } }}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Landscape · 3:2 ✓/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Square · 1:1" }),
    ).toBeInTheDocument();
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
      <Harness
        disabled
        initial={{ square: { x: 0, y: 0, width: 0.5, height: 0.5 } }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Remove square highlight" }),
    ).toBeDisabled();
  });
});

it("keeps independent custom sizes, names and primary crops", async () => {
  const onChange = vi.fn();
  render(
    <Harness
      initial={{ square: { x: 0, y: 0, width: 0.4, height: 0.6 } }}
      onChange={onChange}
    />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Add custom highlight" }),
  );
  fireEvent.change(screen.getByLabelText("Highlight name"), {
    target: { value: "Eye detail" },
  });
  fireEvent.change(screen.getByLabelText("Crop width (px)"), {
    target: { value: "300" },
  });
  fireEvent.change(screen.getByLabelText("Crop height (px)"), {
    target: { value: "200" },
  });
  await userEvent.click(
    screen.getByRole("button", { name: "Add custom highlight" }),
  );
  let saved = onChange.mock.lastCall![0] as PhotoHighlights;
  expect(saved.custom).toHaveLength(2);
  expect(saved.custom![0]).toMatchObject({
    name: "Eye detail",
    crop: { width: 300 / 1800, height: 200 / 1200 },
  });
  expect(saved.square).toEqual({ x: 0, y: 0, width: 0.4, height: 0.6 });
  await userEvent.click(
    screen.getByRole("button", { name: "Remove custom highlight" }),
  );
  saved = onChange.mock.lastCall![0];
  expect(saved.custom).toHaveLength(1);
  expect(
    screen.getByAltText("Eye detail thumbnail preview"),
  ).toBeInTheDocument();
});
it("duplicates a primary without replacing it and bounds custom dimensions", async () => {
  const onChange = vi.fn();
  render(
    <Harness
      initial={{ portrait: { x: 0.8, y: 0.8, width: 0.1, height: 0.2 } }}
      onChange={onChange}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: /Portrait/ }));
  await userEvent.click(
    screen.getByRole("button", { name: "Duplicate as custom highlight" }),
  );
  fireEvent.change(screen.getByLabelText("Crop width (px)"), {
    target: { value: "9000" },
  });
  const saved = onChange.mock.lastCall![0] as PhotoHighlights;
  expect(saved.portrait).toEqual({ x: 0.8, y: 0.8, width: 0.1, height: 0.2 });
  expect(saved.custom![0].crop.width).toBe(1);
  expect(saved.custom![0].crop.x).toBe(0);
});
it("caps custom crops and disables additions during saving", () => {
  render(
    <Harness
      disabled
      initial={{
        custom: Array.from({ length: 20 }, (_, i) => ({
          id: `id-${i}`,
          name: `Detail ${i}`,
          crop: { x: 0, y: 0, width: 0.5, height: 0.5 },
        })),
      }}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Add custom highlight" }),
  ).toBeDisabled();
});
