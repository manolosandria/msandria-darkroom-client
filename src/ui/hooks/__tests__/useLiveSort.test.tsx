import { afterEach, describe, expect, it, vi } from "vitest";
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

// Browsers release pointer capture when the captured node is moved in the document,
// and then deliver the pointer's events to whatever lies under it. jsdom does neither,
// so this models it: events go to the captured element while it holds the capture.
const cleanups: (() => void)[] = [];
function capturingPointer() {
  let captured: Element | null = null;
  const insertBefore = Node.prototype.insertBefore;
  const appendChild = Node.prototype.appendChild;
  const release = (node: Node) => {
    if (captured && node.contains(captured)) captured = null;
  };
  vi.spyOn(Node.prototype, "insertBefore").mockImplementation(function <
    T extends Node,
  >(this: Node, node: T, child: Node | null) {
    release(node);
    return insertBefore.call(this, node, child) as T;
  });
  vi.spyOn(Node.prototype, "appendChild").mockImplementation(function <
    T extends Node,
  >(this: Node, node: T) {
    release(node);
    return appendChild.call(this, node) as T;
  });
  // The hook captures the pointer on the element pressed.
  const press = (event: Event) => (captured = event.target as Element);
  document.addEventListener("pointerdown", press, true);
  cleanups.push(() => document.removeEventListener("pointerdown", press, true));
  return {
    target: () => captured ?? document.body,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  cleanups.splice(0).forEach((cleanup) => cleanup());
});

describe("useLiveSort", () => {
  it("keeps following a drag to the right after the dragged node moves", () => {
    const pointer = capturingPointer();
    const onMove = vi.fn();
    render(<List onMove={onMove} />);
    const grip = screen.getByText("grip a");
    fireEvent.pointerDown(grip, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(pointer.target(), { clientX: 150, clientY: 10 });
    expect(labels()).toEqual(["grip b", "grip a", "grip c"]);
    // Passing b moved a's own node, which lost the capture.
    expect(pointer.target()).toBe(document.body);
    fireEvent.pointerMove(pointer.target(), { clientX: 250, clientY: 10 });
    expect(labels()).toEqual(["grip b", "grip c", "grip a"]);
    fireEvent.pointerUp(pointer.target());
    expect(onMove).toHaveBeenCalledWith(0, 2);
    expect(grip.closest("li")).not.toHaveAttribute("data-dragging");
  });

  it("follows the last item to the left and back to the right", () => {
    const pointer = capturingPointer();
    const onMove = vi.fn();
    render(<List onMove={onMove} />);
    const grip = screen.getByText("grip c");
    fireEvent.pointerDown(grip, { button: 0, clientX: 210, clientY: 10 });
    fireEvent.pointerMove(pointer.target(), { clientX: 50, clientY: 10 });
    expect(labels()).toEqual(["grip c", "grip a", "grip b"]);
    fireEvent.pointerMove(pointer.target(), { clientX: 250, clientY: 10 });
    expect(labels()).toEqual(["grip a", "grip b", "grip c"]);
    fireEvent.pointerMove(pointer.target(), { clientX: 150, clientY: 10 });
    fireEvent.pointerUp(pointer.target());
    expect(onMove).toHaveBeenCalledWith(2, 1);
  });

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
