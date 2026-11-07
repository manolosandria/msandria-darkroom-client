import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { BorderTrim } from "@/src/domain/borderTrim";
import { BorderTrimFields, FileBorderTrim } from "../BorderTrimFields";
import { findBorder } from "@/src/ui/borderTrimImage";

vi.mock("@/src/ui/borderTrimImage", () => ({
  findBorder: vi.fn(),
  trimmedPreview: vi.fn(),
}));

const found = vi.mocked(findBorder);

function Harness({
  onChange = () => undefined,
  initial = null,
}: {
  onChange?: (trim: BorderTrim | null) => void;
  initial?: BorderTrim | null;
}) {
  const [value, setValue] = useState<BorderTrim | null>(initial);
  return (
    <BorderTrimFields
      src="blob:original"
      width={1000}
      height={800}
      value={value}
      onChange={(trim) => {
        setValue(trim);
        onChange(trim);
      }}
    />
  );
}

afterEach(() => vi.clearAllMocks());

describe("BorderTrimFields", () => {
  it("looks for the border when switched on and shows its sides in pixels", async () => {
    found.mockResolvedValue({ x: 0, y: 0.125, width: 1, height: 0.75 });
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Remove border" }));

    expect(found).toHaveBeenCalledWith("blob:original");
    expect(await screen.findByLabelText("Top border in pixels")).toHaveValue(100);
    expect(screen.getByLabelText("Bottom border in pixels")).toHaveValue(100);
    expect(screen.getByLabelText("Left border in pixels")).toHaveValue(0);
    expect(screen.getByRole("status")).toHaveTextContent(/border found: top 100 px/i);
    expect(screen.getByText(/keeps 1000 × 600 px of 1000 × 800/i)).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith({ x: 0, y: 0.125, width: 1, height: 0.75 });
  });

  it("lets each side be set by hand when no border is found", async () => {
    found.mockResolvedValue(null);
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Remove border" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/no border/i);
    fireEvent.change(screen.getByLabelText("Left border in pixels"), {
      target: { value: "50" },
    });

    expect(onChange).toHaveBeenLastCalledWith({ x: 0.05, y: 0, width: 0.95, height: 1 });
  });

  it("never lets a side swallow the photo", async () => {
    const onChange = vi.fn();
    render(
      <Harness onChange={onChange} initial={{ x: 0, y: 0, width: 1, height: 1 }} />,
    );

    fireEvent.change(screen.getByLabelText("Right border in pixels"), {
      target: { value: "5000" },
    });

    expect(screen.getByLabelText("Right border in pixels")).toHaveValue(900);
  });

  it("falls back to manual sides when the image cannot be read", async () => {
    found.mockRejectedValue(new Error("no canvas"));
    render(<Harness />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Remove border" }));

    expect(await screen.findByRole("status")).toHaveTextContent(/could not be read/i);
    expect(screen.getByLabelText("Top border in pixels")).toHaveValue(0);
  });

  it("drags an edge of the kept area", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <Harness onChange={onChange} initial={{ x: 0, y: 0, width: 1, height: 1 }} />,
    );
    const stage = container.querySelector(".border-trim__stage") as HTMLElement;
    stage.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 500, bottom: 400, width: 500, height: 400 }) as DOMRect;
    const handle = container.querySelector(".border-trim__handle--top") as HTMLElement;

    fireEvent.pointerDown(handle, { pointerId: 1, clientY: 0 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 40 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 200 });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({ x: 0, y: 0.1, width: 1, height: 0.9 });
  });

  it("switching it off keeps the file whole", async () => {
    const onChange = vi.fn();
    render(
      <Harness onChange={onChange} initial={{ x: 0, y: 0.1, width: 1, height: 0.8 }} />,
    );

    await userEvent.click(screen.getByRole("checkbox", { name: "Remove border" }));

    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.queryByLabelText("Top border in pixels")).not.toBeInTheDocument();
  });
});

describe("FileBorderTrim", () => {
  it("measures a chosen file before offering the trim", async () => {
    const createObjectURL = vi.fn(() => "blob:replacement");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const { container, unmount } = render(
      <FileBorderTrim
        file={new File(["x"], "new.jpg", { type: "image/jpeg" })}
        value={null}
        onChange={() => undefined}
      />,
    );
    const probe = container.querySelector("img") as HTMLImageElement;
    Object.defineProperties(probe, {
      naturalWidth: { value: 1200 },
      naturalHeight: { value: 900 },
    });
    fireEvent.load(probe);

    expect(
      await screen.findByRole("checkbox", { name: "Remove border" }),
    ).toBeInTheDocument();
    unmount();
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:replacement"));
    vi.unstubAllGlobals();
  });
});
