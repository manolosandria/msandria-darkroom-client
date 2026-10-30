"use client";
import {
  CSSProperties,
  KeyboardEvent,
  PointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

type Rect = { left: number; top: number; width: number; height: number };
type Point = { x: number; y: number };
type Live<K> = {
  key: K;
  pointerId: number | undefined;
  from: number;
  pointer: Point;
  /** The dragged item's slot when the drag began, relative to the list. */
  start: Rect;
  order: K[];
  moved: boolean;
  delta: Point;
};

const MOVE_THRESHOLD = 4;
const ANIMATION = { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" };

function reduceMotion() {
  return (
    typeof window !== "undefined" &&
    Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
  );
}

/**
 * Reorders a list the way icons are arranged on a phone: the dragged item follows the
 * pointer while the others slide out of its way as it passes over them, and the new
 * order is committed when it is dropped (Escape puts everything back). Arrow keys on
 * the grip move an item one place. Works for rows, columns and wrapping grids, since
 * it only asks where each item was laid out.
 */
export function useLiveSort<K extends string>({
  keys,
  onMove,
  disabled = false,
}: {
  keys: K[];
  onMove: (from: number, to: number) => void;
  disabled?: boolean;
}) {
  const [preview, setPreview] = useState<K[] | null>(null);
  const [dragging, setDragging] = useState<K | null>(null);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const elements = useRef(new Map<K, HTMLElement>());
  const container = useRef<HTMLElement | null>(null);
  // Where each item is laid out, relative to the list, without any animation.
  const settled = useRef(new Map<K, Rect>());
  // Where each item showed before the last change of order, to slide it from there.
  const before = useRef<Map<K, DOMRect> | null>(null);
  const live = useRef<Live<K> | null>(null);
  const applied = useRef<Point>({ x: 0, y: 0 });
  // A press that became a drag must not also count as a click.
  const dropped = useRef(false);
  // Removes the window listeners that follow the drag in progress.
  const unlisten = useRef<(() => void) | null>(null);
  const order = preview ?? keys;

  const origin = () =>
    container.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
  const snapshot = () => {
    const rects = new Map<K, DOMRect>();
    elements.current.forEach((element, key) =>
      rects.set(key, element.getBoundingClientRect()),
    );
    before.current = rects;
  };
  // Running slides are stopped first, so what is measured is the layout itself.
  const measure = () => {
    const base = origin();
    settled.current = new Map();
    elements.current.forEach((element, key) => {
      element.getAnimations?.().forEach((animation) => animation.cancel());
      const rect = element.getBoundingClientRect();
      const shift =
        key === live.current?.key ? applied.current : { x: 0, y: 0 };
      settled.current.set(key, {
        left: rect.left - base.left - shift.x,
        top: rect.top - base.top - shift.y,
        width: rect.width,
        height: rect.height,
      });
    });
  };
  // The dragged item stays under the pointer wherever its slot has moved to.
  const follow = (current: Live<K>) => {
    const slot = settled.current.get(current.key) ?? current.start;
    const next = {
      x: current.delta.x - (slot.left - current.start.left),
      y: current.delta.y - (slot.top - current.start.top),
    };
    applied.current = next;
    setOffset(next);
  };

  useLayoutEffect(() => {
    const rects = before.current;
    if (!rects) return;
    before.current = null;
    measure();
    if (live.current?.moved) follow(live.current);
    if (reduceMotion()) return;
    elements.current.forEach((element, key) => {
      const previous = rects.get(key);
      if (!previous || key === live.current?.key) return;
      const now = element.getBoundingClientRect();
      const dx = previous.left - now.left;
      const dy = previous.top - now.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      element.animate?.(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: "translate(0, 0)" },
        ],
        ANIMATION,
      );
    });
  });

  const finish = (commit: boolean) => {
    const current = live.current;
    if (!current) return;
    unlisten.current?.();
    snapshot();
    live.current = null;
    dropped.current = current.moved;
    applied.current = { x: 0, y: 0 };
    setDragging(null);
    setPreview(null);
    setOffset({ x: 0, y: 0 });
    const to = current.order.indexOf(current.key);
    if (commit && current.moved && to !== current.from)
      onMove(current.from, to);
  };

  const pointerMove = (event: globalThis.PointerEvent) => {
    const current = live.current;
    if (!current || event.pointerId !== current.pointerId) return;
    current.delta = {
      x: event.clientX - current.pointer.x,
      y: event.clientY - current.pointer.y,
    };
    if (
      !current.moved &&
      Math.hypot(current.delta.x, current.delta.y) < MOVE_THRESHOLD
    )
      return;
    if (!current.moved) {
      current.moved = true;
      setDragging(current.key);
    }
    const base = origin();
    const x = event.clientX - base.left;
    const y = event.clientY - base.top;
    // The item under the pointer gives up its place; the others shift one step.
    const over = current.order.find((key) => {
      if (key === current.key) return false;
      const slot = settled.current.get(key);
      return (
        slot &&
        x >= slot.left &&
        x <= slot.left + slot.width &&
        y >= slot.top &&
        y <= slot.top + slot.height
      );
    });
    if (over) {
      const next = current.order.filter((key) => key !== current.key);
      next.splice(current.order.indexOf(over), 0, current.key);
      if (next.join("\n") !== current.order.join("\n")) {
        snapshot();
        current.order = next;
        setPreview(next);
      }
    }
    follow(current);
  };

  // The drag is followed from the window, not from the grip: when the dragged item
  // passes one to its right, React moves its own node, and moving a node makes the
  // browser drop its pointer capture, so the grip would stop hearing the pointer.
  const listen = () => {
    unlisten.current?.();
    const up = (event: globalThis.PointerEvent) => {
      if (event.pointerId === live.current?.pointerId) finish(true);
    };
    const cancel = (event: globalThis.PointerEvent) => {
      if (event.pointerId === live.current?.pointerId) finish(false);
    };
    window.addEventListener("pointermove", pointerMove);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    unlisten.current = () => {
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      unlisten.current = null;
    };
  };
  useEffect(() => () => unlisten.current?.(), []);

  const gripProps = (key: K) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (disabled || event.button !== 0) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      live.current = null;
      applied.current = { x: 0, y: 0 };
      measure();
      const start = settled.current.get(key);
      if (!start) return;
      live.current = {
        key,
        pointerId: event.pointerId,
        from: keys.indexOf(key),
        pointer: { x: event.clientX, y: event.clientY },
        start,
        order: [...keys],
        moved: false,
        delta: { x: 0, y: 0 },
      };
      listen();
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === "Escape" && live.current) {
        event.preventDefault();
        finish(false);
        return;
      }
      const step = (
        { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 } as Record<
          string,
          number
        >
      )[event.key];
      const from = keys.indexOf(key);
      if (!step || disabled) return;
      event.preventDefault();
      const to = from + step;
      if (to < 0 || to >= keys.length) return;
      snapshot();
      onMove(from, to);
    },
  });

  return {
    /** The order to render: the drag's preview while one is under way. */
    order,
    /** The key being dragged, once the pointer has moved. */
    dragging,
    /** The list the items are laid out in; positions are measured against it. */
    attachList: (element: HTMLElement | null) => {
      container.current = element;
    },
    attachItem: (key: K) => (element: HTMLElement | null) => {
      if (element) elements.current.set(key, element);
      else elements.current.delete(key);
    },
    itemStyle: (key: K): CSSProperties | undefined =>
      dragging === key
        ? {
            transform: `translate(${offset.x}px, ${offset.y}px)`,
            zIndex: 30,
            transition: "none",
            position: "relative",
          }
        : undefined,
    gripProps,
    /** True once after a drag ended, for the click that follows the drop. */
    takeDrop: () => {
      const value = dropped.current;
      dropped.current = false;
      return value;
    },
  };
}
