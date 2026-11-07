import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  GalleryViewRule,
  PhotoHighlights,
} from "@/src/domain/entities/PhotoHighlights";
import { HighlightEditor } from "../HighlightEditor";

// The editor is controlled, so the test holds the crops the way the upload card does.
function Harness({
  initial = {},
  disabled = false,
  onChange,
  activeKey,
  onActiveChange,
}: {
  initial?: PhotoHighlights;
  disabled?: boolean;
  onChange?: (value: PhotoHighlights) => void;
  activeKey?: string;
  onActiveChange?: (key: string | null) => void;
}) {
  const [highlights, setHighlights] = useState<PhotoHighlights>(initial);
  return (
    <HighlightEditor
      src="blob:photo"
      width={1800}
      height={1200}
      value={highlights}
      disabled={disabled}
      activeKey={activeKey}
      onActiveChange={onActiveChange}
      onChange={(value) => {
        setHighlights(value);
        onChange?.(value);
      }}
    />
  );
}

const stage = () => document.querySelector(".highlight-stage") as HTMLElement;
const TAB = {
  original: "Original highlights",
  square: "Square · 1:1 highlights",
  landscape: "Landscape · 3:2 highlights",
  portrait: "Portrait · 2:3 highlights",
  free: "Free highlights",
};
const tab = (kind: keyof typeof TAB) =>
  screen.getByRole("tab", { name: TAB[kind] });
const rule = (
  highlights: PhotoHighlights,
  layout: string,
  aspect: string,
): GalleryViewRule =>
  highlights.presentation!.galleryRules!.find(
    (item) => item.layout === layout && item.aspect === aspect,
  )!;

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
function drag(from: [number, number], to: [number, number]) {
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
async function draw(
  kind: "square" | "landscape" | "portrait" | "free",
  from: [number, number],
  to: [number, number],
) {
  await userEvent.click(tab(kind));
  await userEvent.click(
    screen.getByRole("button", { name: `New ${kind} highlight` }),
  );
  drag(from, to);
}
const accept = () =>
  userEvent.click(screen.getByRole("button", { name: "Accept highlight" }));

describe("HighlightEditor", () => {
  // Nothing is cropped automatically: a crop exists only once drawn and accepted.
  it("draws a square by dragging and keeps it only when accepted", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    expect(screen.getByText(/No square highlights yet/)).toBeInTheDocument();
    await draw("square", [60, 40], [360, 240]);
    expect(onChange).not.toHaveBeenCalled();
    await accept();
    const square = onChange.mock.lastCall![0].square!;
    // Square in image pixels: 900 × 900 of a 1800 × 1200 photo.
    expect(square.x).toBeCloseTo(0.1);
    expect(square.y).toBeCloseTo(0.1);
    expect(square.width * 1800).toBeCloseTo(square.height * 1200);
    expect(screen.getByAltText("square thumbnail preview")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Square (main)" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  // A square, landscape or portrait highlight is meant for Gallery's grids.
  it("offers a new shaped crop to Grid and Random in its own proportion", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await draw("portrait", [60, 40], [160, 340]);
    await accept();
    const saved = onChange.mock.lastCall![0] as PhotoHighlights;
    expect(saved.presentation!.gallery).toEqual(["original", "portrait"]);
    expect(rule(saved, "uniform", "portrait").views).toContain("portrait");
    expect(rule(saved, "random", "portrait").views).toContain("portrait");
    expect(rule(saved, "justified", "portrait").views).not.toContain(
      "portrait",
    );
    // The photograph itself keeps its place.
    expect(rule(saved, "justified", "landscape").views).toEqual(["original"]);
  });

  it("discards a drawing on cancel and keeps it inside the photo", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await draw("portrait", [540, 360], [900, 900]);
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
    await draw("free", [0, 0], [300, 100]);
    await accept();
    const saved = onChange.mock.lastCall![0] as PhotoHighlights;
    expect(saved.custom![0]).toEqual({
      id: expect.any(String),
      name: "Detail 1",
      crop: { x: 0, y: 0, width: 0.5, height: 0.25 },
    });
    expect(saved.presentation).toBeUndefined();
  });

  // The sizes stay on screen while drawing; the one in use is marked, and choosing
  // another reshapes the drawing where it is.
  it("keeps the sizes on offer while drawing and reshapes the drawing", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await draw("square", [60, 40], [360, 240]);
    expect(tab("square")).toHaveAttribute("aria-selected", "true");
    expect(tab("original")).toBeDisabled();
    await userEvent.click(tab("landscape"));
    expect(tab("landscape")).toHaveAttribute("aria-selected", "true");
    expect(tab("square")).toHaveAttribute("aria-selected", "false");
    await accept();
    const saved = onChange.mock.lastCall![0] as PhotoHighlights;
    expect(saved.square).toBeUndefined();
    const { width, height } = saved.landscape!;
    expect((width * 1800) / (height * 1200)).toBeCloseTo(1.5);
  });

  it("counts the highlights of each size on its tab", () => {
    render(
      <Harness
        initial={{
          landscape: { x: 0, y: 0, width: 1, height: 0.6 },
          custom: [
            {
              id: "wide",
              name: "Wide",
              shape: "landscape",
              crop: { x: 0, y: 0, width: 0.5, height: 0.5 },
            },
          ],
        }}
      />,
    );
    const count = (kind: keyof typeof TAB) =>
      tab(kind).querySelector(".highlight-sizes__count")?.textContent;
    expect(count("landscape")).toBe("2");
    expect(count("square")).toBeUndefined();
  });

  it("adds a second crop of a size beside the main one", async () => {
    const onChange = vi.fn();
    render(
      <Harness
        initial={{ square: { x: 0, y: 0, width: 0.4, height: 0.6 } }}
        onChange={onChange}
      />,
    );
    await draw("square", [300, 100], [420, 220]);
    await accept();
    const saved = onChange.mock.lastCall![0] as PhotoHighlights;
    expect(saved.square).toEqual({ x: 0, y: 0, width: 0.4, height: 0.6 });
    expect(saved.custom).toEqual([
      expect.objectContaining({ name: "Square 2", shape: "square" }),
    ]);
    const key = `custom:${saved.custom![0].id}`;
    expect(rule(saved, "uniform", "square").views).toContain(key);
    expect(screen.getByRole("button", { name: "Square 2" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      tab("square").querySelector(".highlight-sizes__count")?.textContent,
    ).toBe("2");
  });

  // Thumbnails use the main crop of each shape, so another can take its place.
  it("makes a named crop the main one and moves its references", async () => {
    const onChange = vi.fn();
    const main = { x: 0, y: 0, width: 0.4, height: 0.6 };
    const other = { x: 0.5, y: 0.2, width: 0.2, height: 0.3 };
    render(
      <Harness
        initial={{
          square: main,
          custom: [{ id: "b", name: "Closer", shape: "square", crop: other }],
          presentation: { gallery: ["original", "square"], home: ["custom:b"] },
        }}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Closer" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Make main highlight" }),
    );
    const saved = onChange.mock.lastCall![0] as PhotoHighlights;
    expect(saved.square).toEqual(other);
    expect(saved.custom).toEqual([
      { id: "b", name: "Closer", shape: "square", crop: main },
    ]);
    expect(saved.presentation).toMatchObject({
      gallery: ["original", "custom:b"],
      home: ["square"],
    });
    expect(
      screen.getByRole("button", { name: "Square (main)" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("removes only the highlight on screen", async () => {
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
      screen.getByRole("button", { name: "New square highlight" }),
    ).toBeDisabled();
  });

  // Photos shows the chosen highlight large and lets its chips choose one too.
  it("follows a highlight chosen outside and reports its own choices", async () => {
    const onActiveChange = vi.fn();
    const initial = {
      square: { x: 0, y: 0, width: 0.5, height: 0.5 },
      portrait: { x: 0, y: 0, width: 0.3, height: 0.9 },
    };
    const { rerender } = render(
      <Harness
        initial={initial}
        activeKey="original"
        onActiveChange={onActiveChange}
      />,
    );
    expect(tab("original")).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("checkbox", { name: "Original in Gallery" }),
    ).toBeChecked();
    rerender(
      <Harness
        initial={initial}
        activeKey="portrait"
        onActiveChange={onActiveChange}
      />,
    );
    expect(tab("portrait")).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("button", { name: "Portrait (main)" }),
    ).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(tab("square"));
    expect(onActiveChange).toHaveBeenLastCalledWith("square");
    await userEvent.click(tab("original"));
    expect(onActiveChange).toHaveBeenLastCalledWith(null);
  });
});

it("keeps independent custom sizes, names and primary crops", async () => {
  const onChange = vi.fn();
  render(
    <Harness
      initial={{
        square: { x: 0, y: 0, width: 0.4, height: 0.6 },
        custom: [
          {
            id: "eye",
            name: "Detail 1",
            crop: { x: 0, y: 0, width: 0.5, height: 0.5 },
          },
        ],
      }}
      onChange={onChange}
    />,
  );
  await userEvent.click(tab("free"));
  fireEvent.change(screen.getByLabelText("Highlight name"), {
    target: { value: "Eye detail" },
  });
  fireEvent.change(screen.getByLabelText("Crop width (px)"), {
    target: { value: "300" },
  });
  fireEvent.change(screen.getByLabelText("Crop height (px)"), {
    target: { value: "200" },
  });
  await userEvent.click(tab("square"));
  await userEvent.click(
    screen.getByRole("button", { name: "Duplicate highlight" }),
  );
  let saved = onChange.mock.lastCall![0] as PhotoHighlights;
  expect(saved.custom).toHaveLength(2);
  expect(saved.custom![0]).toMatchObject({
    name: "Eye detail",
    crop: { width: 300 / 1800, height: 200 / 1200 },
  });
  // A duplicate of the main square is a second square, not a free crop.
  expect(saved.custom![1]).toMatchObject({
    name: "Square 2",
    shape: "square",
    crop: { x: 0, y: 0, width: 0.4, height: 0.6 },
  });
  expect(saved.square).toEqual({ x: 0, y: 0, width: 0.4, height: 0.6 });
  await userEvent.click(
    screen.getByRole("button", { name: "Remove Square 2 highlight" }),
  );
  saved = onChange.mock.lastCall![0];
  expect(saved.custom).toHaveLength(1);
  await userEvent.click(tab("free"));
  expect(
    screen.getByAltText("Eye detail thumbnail preview"),
  ).toBeInTheDocument();
});
it("bounds the dimensions of a free crop", async () => {
  const onChange = vi.fn();
  render(
    <Harness
      initial={{
        custom: [
          {
            id: "edge",
            name: "Edge",
            crop: { x: 0.8, y: 0.8, width: 0.1, height: 0.2 },
          },
        ],
      }}
      onChange={onChange}
    />,
  );
  fireEvent.change(screen.getByLabelText("Crop width (px)"), {
    target: { value: "9000" },
  });
  const saved = onChange.mock.lastCall![0] as PhotoHighlights;
  expect(saved.custom![0].crop.width).toBe(1);
  expect(saved.custom![0].crop.x).toBe(0);
});
it("caps named crops but still allows a missing main one", async () => {
  render(
    <Harness
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
    screen.getByRole("button", { name: "Duplicate highlight" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "New free highlight" }),
  ).toBeDisabled();
  await userEvent.click(tab("square"));
  expect(
    screen.getByRole("button", { name: "New square highlight" }),
  ).toBeEnabled();
});

it("manages destination eligibility one view at a time and removes references when a crop is deleted", async () => {
  const onChange = vi.fn();
  render(
    <Harness
      initial={{ square: { x: 0, y: 0, width: 0.4, height: 0.6 } }}
      onChange={onChange}
    />,
  );
  // Only the view on screen is offered.
  expect(
    screen.queryByRole("checkbox", { name: "Original in Gallery" }),
  ).toBeNull();
  expect(
    screen.getByRole("checkbox", { name: "Square in Gallery" }),
  ).not.toBeChecked();
  await userEvent.click(
    screen.getByRole("checkbox", { name: "Square in Gallery" }),
  );
  await userEvent.click(tab("original"));
  expect(
    screen.getByRole("checkbox", { name: "Original in Gallery" }),
  ).toBeChecked();
  await userEvent.click(
    screen.getByRole("checkbox", { name: "Original in Home" }),
  );
  expect(onChange.mock.lastCall![0].presentation).toMatchObject({
    gallery: ["original", "square"],
    home: [],
  });
  await userEvent.click(tab("square"));
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
  await userEvent.click(screen.getByText("Gallery layouts and proportions"));
  await userEvent.click(
    screen.getByRole("checkbox", { name: "Square in Random square" }),
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
