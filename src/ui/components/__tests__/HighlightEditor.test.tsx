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

// The stage is 600 × 400 on screen, so 60 px is a tenth of either side.
function measure() {
  const target = stage();
  target.setPointerCapture = vi.fn();
  vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 600,
    height: 400,
  } as DOMRect);
  return target;
}
async function draw(
  shape: string,
  from: [number, number],
  to: [number, number],
) {
  await userEvent.click(screen.getByRole("button", { name: "New highlight" }));
  await userEvent.click(screen.getByRole("button", { name: shape }));
  const target = measure();
  fireEvent.pointerDown(target, {
    pointerId: 1,
    clientX: from[0],
    clientY: from[1],
  });
  fireEvent.pointerMove(target, {
    pointerId: 1,
    clientX: to[0],
    clientY: to[1],
  });
  fireEvent.pointerUp(target, { pointerId: 1 });
}

describe("HighlightEditor", () => {
  // Nothing is cropped automatically: a crop exists only once drawn and accepted.
  it("draws a square by dragging and keeps it only when accepted", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    expect(screen.getByText(/No highlights yet/)).toBeInTheDocument();
    await draw("Draw square highlight", [60, 40], [360, 240]);
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Accept highlight" }),
    );
    const square = onChange.mock.lastCall![0].square!;
    // Square in image pixels: 900 × 900 of a 1800 × 1200 photo.
    expect(square.x).toBeCloseTo(0.1);
    expect(square.y).toBeCloseTo(0.1);
    expect(square.width * 1800).toBeCloseTo(square.height * 1200);
    expect(screen.getByAltText("square thumbnail preview")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Square · 1:1" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("discards a drawing on cancel and keeps it inside the photo", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await draw("Draw portrait highlight", [540, 360], [900, 900]);
    expect(
      screen.getByRole("button", { name: "Accept highlight" }),
    ).toBeEnabled();
    const box = document.querySelector(".highlight-selection") as HTMLElement;
    expect(
      parseFloat(box.style.left) + parseFloat(box.style.width),
    ).toBeLessThanOrEqual(100.0001);
    await userEvent.click(
      screen.getByRole("button", { name: "Cancel highlight" }),
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(document.querySelector(".highlight-selection")).toBeNull();
  });

  it("creates a free custom highlight with its own size", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await draw("Draw custom highlight", [0, 0], [300, 100]);
    await userEvent.click(
      screen.getByRole("button", { name: "Accept highlight" }),
    );
    expect(onChange.mock.lastCall![0].custom![0]).toMatchObject({
      name: "Detail 1",
      crop: { x: 0, y: 0, width: 0.5, height: 0.25 },
    });
  });

  it("marks the shapes that already have a crop", async () => {
    render(
      <Harness
        initial={{ landscape: { x: 0, y: 0, width: 1, height: 0.6 } }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "New highlight" }),
    );
    expect(
      screen.getByRole("button", { name: "Draw landscape highlight" }),
    ).toHaveTextContent("✓");
    expect(
      screen.getByRole("button", { name: "Draw square highlight" }),
    ).not.toHaveTextContent("✓");
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

  it("moves the crop where it is dragged and reverts it", async () => {
    const onChange = vi.fn();
    render(
      <Harness
        initial={{ square: { x: 0, y: 0, width: 0.4, height: 0.6 } }}
        onChange={onChange}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Revert highlight" }),
    ).toBeDisabled();
    const target = measure();

    fireEvent.pointerDown(target, { pointerId: 1, clientX: 300, clientY: 200 });

    // Dropped at the middle of the stage, the crop centres itself there.
    expect(onChange).toHaveBeenCalledWith({
      square: expect.objectContaining({ x: 0.3, y: 0.2 }),
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Revert highlight" }),
    );
    expect(onChange.mock.lastCall![0].square).toEqual({
      x: 0,
      y: 0,
      width: 0.4,
      height: 0.6,
    });
  });

  it("resizes from a corner and keeps the proportion of the shape", async () => {
    const onChange = vi.fn();
    render(
      <Harness
        initial={{ square: { x: 0, y: 0, width: 0.2, height: 0.3 } }}
        onChange={onChange}
      />,
    );
    const target = measure();
    const corner = document.querySelector(
      ".highlight-handle--se",
    ) as HTMLElement;
    fireEvent.pointerDown(corner, { pointerId: 1, clientX: 120, clientY: 120 });
    fireEvent.pointerMove(target, { pointerId: 1, clientX: 240, clientY: 120 });
    const square = onChange.mock.lastCall![0].square!;
    expect(square).toMatchObject({ x: 0, y: 0 });
    expect(square.width).toBeCloseTo(0.4);
    expect(square.width * 1800).toBeCloseTo(square.height * 1200);
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
    expect(
      screen.getByRole("button", { name: "New highlight" }),
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
    screen.getByRole("button", { name: "Duplicate as custom highlight" }),
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
  await userEvent.click(screen.getByRole("button", { name: "Square · 1:1" }));
  await userEvent.click(
    screen.getByRole("button", { name: "Duplicate as custom highlight" }),
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
    screen.getByRole("button", { name: "Duplicate as custom highlight" }),
  ).toBeDisabled();
});

it("manages destination eligibility visually and removes references when a crop is deleted", async () => {
  const onChange = vi.fn();
  render(
    <Harness
      initial={{ square: { x: 0, y: 0, width: 0.4, height: 0.6 } }}
      onChange={onChange}
    />,
  );
  expect(
    screen.getByRole("checkbox", { name: "Original in Gallery" }),
  ).toBeChecked();
  expect(
    screen.getByRole("checkbox", { name: "Square in Gallery" }),
  ).not.toBeChecked();
  await userEvent.click(
    screen.getByRole("checkbox", { name: "Square in Gallery" }),
  );
  await userEvent.click(
    screen.getByRole("checkbox", { name: "Original in Home" }),
  );
  expect(onChange.mock.lastCall![0].presentation).toMatchObject({
    gallery: ["original", "square"],
    home: [],
  });
  await userEvent.click(
    screen.getByRole("button", { name: "Remove square highlight" }),
  );
  expect(onChange.mock.lastCall![0].presentation).toMatchObject({
    gallery: ["original"],
    home: [],
  });
});

it("edits distribution and aspect cells without enabling other layouts", async () => {
  const onChange = vi.fn();
  render(
    <Harness
      initial={{ square: { x: 0, y: 0, width: 0.4, height: 0.6 } }}
      onChange={onChange}
    />,
  );
  const details = screen.getAllByText("Distribution & aspect eligibility");
  await userEvent.click(details[1]);
  await userEvent.click(
    screen.getByRole("checkbox", { name: "Square in Random emphasis square" }),
  );
  const rules = onChange.mock.lastCall![0].presentation.galleryRules;
  expect(
    rules.find(
      (rule: { layout: string; aspect: string }) =>
        rule.layout === "random" && rule.aspect === "square",
    ).views,
  ).toContain("square");
  expect(
    rules
      .filter(
        (rule: { layout: string; aspect: string }) =>
          rule.layout !== "random" || rule.aspect !== "square",
      )
      .every((rule: { views: string[] }) => !rule.views.includes("square")),
  ).toBe(true);
  await userEvent.click(
    screen.getByRole("button", { name: "Remove square highlight" }),
  );
  expect(
    onChange.mock.lastCall![0].presentation.galleryRules.every(
      (rule: { views: string[] }) => !rule.views.includes("square"),
    ),
  ).toBe(true);
});
