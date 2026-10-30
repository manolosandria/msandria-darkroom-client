import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { useLiveSort } from "../useLiveSort";

function List({
  onMove = vi.fn(),
  disabled = false,
}: {
  onMove?: (from: number, to: number) => void;
  disabled?: boolean;
}) {
  const [items, setItems] = useState(["a", "b", "c"]);
  const {
    order,
    dragging,
    attachList,
    attachItem,
    itemStyle,
    gripProps,
    takeDrop,
  } = useLiveSort({
    keys: items,
    disabled,
    onMove: (from, to) => {
      onMove(from, to);
      const next = [...items];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      setItems(next);
    },
  });
  return (
    <ul ref={attachList}>
      {order.map((key) => (
        <li
          key={key}
          ref={(element) => {
            attachItem(key)(element);
            if (element)
              element.getBoundingClientRect = () =>
                ({
                  left: order.indexOf(key) * 100,
                  top: 0,
                  width: 90,
                  height: 90,
                }) as DOMRect;
          }}
          style={itemStyle(key)}
          data-dragging={dragging === key || undefined}
        >
          <button
            {...gripProps(key)}
            onClick={() => takeDrop()}
          >{`grip ${key}`}</button>
        </li>
      ))}
    </ul>
  );
}
const labels = () =>
  screen.getAllByRole("button").map((button) => button.textContent);

describe("useLiveSort", () => {
  it("lets the others make room while dragging and commits on drop", () => {
    const onMove = vi.fn();
    render(<List onMove={onMove} />);
    const grip = screen.getByText("grip a");
    fireEvent.pointerDown(grip, { button: 0, clientX: 10, clientY: 10 });
    // A small tremor is not a drag.
    fireEvent.pointerMove(grip, { clientX: 12, clientY: 10 });
    expect(grip.closest("li")).not.toHaveAttribute("data-dragging");
    fireEvent.pointerMove(grip, { clientX: 150, clientY: 10 });
    expect(labels()).toEqual(["grip b", "grip a", "grip c"]);
    expect(grip.closest("li")).toHaveAttribute("data-dragging", "true");
    expect(grip.closest("li")!.style.transform).toMatch(/^translate\(/);
    expect(onMove).not.toHaveBeenCalled();
    fireEvent.pointerUp(grip);
    expect(onMove).toHaveBeenCalledWith(0, 1);
    expect(labels()).toEqual(["grip b", "grip a", "grip c"]);
    expect(grip.closest("li")!.style.transform).toBe("");
  });

  it("puts everything back on Escape or a cancelled pointer", () => {
    const onMove = vi.fn();
    render(<List onMove={onMove} />);
    const grip = screen.getByText("grip a");
    fireEvent.pointerDown(grip, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(grip, { clientX: 250, clientY: 10 });
    expect(labels()).toEqual(["grip b", "grip c", "grip a"]);
    fireEvent.keyDown(grip, { key: "Escape" });
    expect(labels()).toEqual(["grip a", "grip b", "grip c"]);
    fireEvent.pointerDown(grip, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(grip, { clientX: 150, clientY: 10 });
    fireEvent.pointerCancel(grip);
    expect(labels()).toEqual(["grip a", "grip b", "grip c"]);
    expect(onMove).not.toHaveBeenCalled();
  });

  it("moves one place with the arrow keys and ignores the edges", () => {
    const onMove = vi.fn();
    render(<List onMove={onMove} />);
    fireEvent.keyDown(screen.getByText("grip a"), { key: "ArrowLeft" });
    expect(onMove).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByText("grip a"), { key: "ArrowRight" });
    expect(labels()).toEqual(["grip b", "grip a", "grip c"]);
    fireEvent.keyDown(screen.getByText("grip c"), { key: "ArrowUp" });
    expect(labels()).toEqual(["grip b", "grip c", "grip a"]);
    fireEvent.keyDown(screen.getByText("grip c"), { key: "Enter" });
    expect(onMove).toHaveBeenCalledTimes(2);
  });

  it("does nothing while disabled or for another button", () => {
    const onMove = vi.fn();
    render(<List onMove={onMove} disabled />);
    const grip = screen.getByText("grip a");
    fireEvent.pointerDown(grip, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(grip, { clientX: 150, clientY: 10 });
    fireEvent.pointerUp(grip);
    fireEvent.keyDown(grip, { key: "ArrowRight" });
    expect(onMove).not.toHaveBeenCalled();
    expect(labels()).toEqual(["grip a", "grip b", "grip c"]);
  });
});
