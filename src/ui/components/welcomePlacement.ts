"use client";
import { PointerEvent, RefObject, useRef } from "react";
import { WelcomePlacement } from "@/src/domain/entities/HomeBanner";

const clamp = (value: number, min: number, max: number) =>
  Math.round(Math.min(max, Math.max(min, value)));

type Gesture = "move" | "width" | "scale";

/**
 * Curator's preview: the Welcome panel over the photograph moves with the pointer and
 * resizes from its right edge (width) or its corner (width and title size together).
 * Positions are shares of the banner, so the same placement fits any screen. Every
 * step reports a whole placement; the caller decides whose title it belongs to.
 */
export function useWelcomePlacement({
  stage,
  current,
  onPlace,
}: {
  stage: RefObject<HTMLElement | null>;
  /** x and y only when the panel is already placed freely. */
  current: { width: number; fontSize: number; x?: number; y?: number };
  onPlace?: (placement: WelcomePlacement) => void;
}) {
  const gesture = useRef<{
    kind: Gesture;
    pointer: { x: number; y: number };
    box: { x: number; y: number; width: number; height: number };
    banner: { width: number; height: number };
    width: number;
    fontSize: number;
    moved: boolean;
  } | null>(null);

  const start = (kind: Gesture) => (event: PointerEvent<HTMLElement>) => {
    if (!onPlace || event.button !== 0) return;
    // The grip and links keep their own jobs.
    if (
      kind === "move" &&
      (event.target as HTMLElement).closest(
        ".banner-live-handle,.welcome-resize,a,button",
      )
    )
      return;
    const banner = stage.current?.getBoundingClientRect();
    const panel = (
      kind === "move" ? event.currentTarget : event.currentTarget.parentElement
    )?.getBoundingClientRect();
    if (!banner || !panel || !banner.width || !banner.height) return;
    // No text selection or native drag while the panel follows the pointer.
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    gesture.current = {
      kind,
      pointer: { x: event.clientX, y: event.clientY },
      box: {
        x: ((panel.left - banner.left) / banner.width) * 100,
        y: ((panel.top - banner.top) / banner.height) * 100,
        width: (panel.width / banner.width) * 100,
        height: (panel.height / banner.height) * 100,
      },
      banner: { width: banner.width, height: banner.height },
      width: current.width,
      fontSize: current.fontSize,
      moved: false,
    };
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    const active = gesture.current;
    if (!active || !onPlace) return;
    const dx = event.clientX - active.pointer.x;
    const dy = event.clientY - active.pointer.y;
    if (!active.moved && Math.hypot(dx, dy) < 3) return;
    active.moved = true;
    const shareX = (dx / active.banner.width) * 100;
    const shareY = (dy / active.banner.height) * 100;
    // Resizing keeps an anchored panel on its anchor.
    const { x, y } = current;
    if (active.kind === "move")
      onPlace({
        x: clamp(
          active.box.x + shareX,
          0,
          100 - Math.min(active.box.width, 100),
        ),
        y: clamp(
          active.box.y + shareY,
          0,
          100 - Math.min(active.box.height, 100),
        ),
        width: active.width,
        fontSize: active.fontSize,
      });
    else if (active.kind === "width")
      onPlace({
        x,
        y,
        width: clamp(active.width + shareX, 25, 90),
        fontSize: active.fontSize,
      });
    else {
      const scale = (active.box.width + shareX) / active.box.width;
      onPlace({
        x,
        y,
        width: clamp(active.width * scale, 25, 90),
        fontSize: clamp(active.fontSize * scale, 24, 96),
      });
    }
  };
  const end = () => {
    gesture.current = null;
  };
  const handlers = (kind: Gesture) => ({
    onPointerDown: start(kind),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
  });
  return {
    panel: handlers("move"),
    edge: handlers("width"),
    corner: handlers("scale"),
  };
}
