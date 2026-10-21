import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { FrameFields } from "../FrameFields";
import { PhotoFrame } from "@/src/domain/entities/PhotoFrame";

function Harness({
  initial = null,
  onChange = () => {},
}: {
  initial?: PhotoFrame | null;
  onChange?: (frame: PhotoFrame | null) => void;
}) {
  const [frame, setFrame] = useState(initial);
  return (
    <FrameFields
      src="https://cdn/p.jpg"
      width={1500}
      height={1000}
      value={frame}
      onChange={(next) => {
        setFrame(next);
        onChange(next);
      }}
    />
  );
}

describe("FrameFields", () => {
  it("starts without a frame and offers only the switch", () => {
    render(<Harness />);

    expect(screen.getByRole("checkbox", { name: /show a frame/i })).not.toBeChecked();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("turns on a white frame with equal sides", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: /show a frame/i }));

    expect(onChange).toHaveBeenLastCalledWith({ color: "#ffffff", leftRight: 4, topBottom: 4 });
    expect(screen.getByRole("slider", { name: "Sides thickness" })).toHaveValue("4");
  });

  it("sets the colour from a swatch or the picker", () => {
    const onChange = vi.fn();
    render(<Harness initial={{ color: "#ffffff", leftRight: 4, topBottom: 4 }} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Black" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ color: "#1b1b1b" }));
    expect(screen.getByRole("button", { name: "Black" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.change(screen.getByLabelText("Custom frame colour"), { target: { value: "#336699" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ color: "#336699" }));
  });

  it("sizes the sides and top and bottom separately", () => {
    const onChange = vi.fn();
    render(<Harness initial={{ color: "#ffffff", leftRight: 4, topBottom: 4 }} onChange={onChange} />);

    fireEvent.change(screen.getByRole("slider", { name: "Top and bottom thickness" }), { target: { value: "10" } });

    expect(onChange).toHaveBeenLastCalledWith({ color: "#ffffff", leftRight: 4, topBottom: 10 });
    expect(screen.getByTestId("frame-preview").style.padding).toBe(`${10 * (2 / 3)}% ${4 * (2 / 3)}%`);
  });

  it("removes the frame", () => {
    const onChange = vi.fn();
    render(<Harness initial={{ color: "#000000", leftRight: 2, topBottom: 2 }} onChange={onChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: /show a frame/i }));

    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByTestId("frame-preview").style.padding).toBe("0%");
  });
});
