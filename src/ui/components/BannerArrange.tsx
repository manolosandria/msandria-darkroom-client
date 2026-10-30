"use client";
import { RefObject, useRef, useState } from "react";
import {
  welcomePositions,
  WelcomePosition,
} from "@/src/domain/entities/HomeBanner";

export type BannerBlock = "text" | "photo";
export type ArrangeTarget = { layout: string; position?: WelcomePosition };

const EDGE = 0.16;
const opposite: Record<string, string> = {
  left: "right",
  right: "left",
  top: "bottom",
  bottom: "top",
};
const sideName: Record<string, string> = {
  left: "left of the photographs",
  right: "right of the photographs",
  top: "above the photographs",
  bottom: "below the photographs",
};
const positionName = (position: WelcomePosition) =>
  position === "center" ? "center" : position.replace("-", " ");

/**
 * Where a drop at (x, y), as fractions of the banner, puts the blocks. Welcome
 * dropped on an edge band sits beside the photographs; dropped inside, it floats over
 * them, snapped to the nearest of nine anchors. Photographs only take an edge, and
 * Welcome moves to the opposite one.
 */
export function arrangeTargetAt(
  block: BannerBlock,
  x: number,
  y: number,
): ArrangeTarget {
  if (block === "photo") {
    const side = [
      ["left", x],
      ["right", 1 - x],
      ["top", y],
      ["bottom", 1 - y],
    ].sort((a, b) => (a[1] as number) - (b[1] as number))[0][0] as string;
    return { layout: `text-${opposite[side]}` };
  }
  if (x < EDGE) return { layout: "text-left" };
  if (x > 1 - EDGE) return { layout: "text-right" };
  if (y < EDGE) return { layout: "text-top" };
  if (y > 1 - EDGE) return { layout: "text-bottom" };
  const third = (value: number) =>
    Math.min(2, Math.floor(((value - EDGE) / (1 - 2 * EDGE)) * 3));
  return {
    layout: "text-overlay",
    position: welcomePositions[third(y) * 3 + third(x)],
  };
}

export const describeTarget = (target: ArrangeTarget) =>
  target.layout === "text-overlay"
    ? `Welcome over the photographs, ${positionName(target.position ?? "bottom-left")}`
    : `Welcome ${sideName[target.layout.slice(5)]}`;

const sameTarget = (a: ArrangeTarget | null, b: ArrangeTarget) =>
  !!a && a.layout === b.layout && a.position === b.position;

/**
 * Drag handle plus the drop map it shows over the banner while dragging. Arrow keys
 * move the block without a pointer: Welcome walks the nine anchors while it is over the
 * photographs and the four edges otherwise; Escape cancels a drag.
 */
export function useBannerArrange({
  stage,
  layout,
  position,
  onArrange,
}: {
  stage: RefObject<HTMLElement | null>;
  layout: string;
  position: WelcomePosition;
  onArrange?: (target: ArrangeTarget) => void;
}) {
  const start = useRef<{ block: BannerBlock; x: number; y: number } | null>(
    null,
  );
  const [drag, setDrag] = useState<{
    block: BannerBlock;
    x: number;
    y: number;
    moved: boolean;
    target: ArrangeTarget | null;
  } | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const targetAt = (block: BannerBlock, clientX: number, clientY: number) => {
    const rect = stage.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return null;
    return arrangeTargetAt(
      block,
      Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    );
  };
  const commit = (target: ArrangeTarget | null) => {
    if (!target || !onArrange) return;
    if (target.layout === layout && (target.position ?? position) === position)
      return;
    setAnnouncement(`${describeTarget(target)}.`);
    const apply = () => onArrange(target);
    const transition = (
      document as Document & { startViewTransition?: (fn: () => void) => void }
    ).startViewTransition;
    if (
      transition &&
      !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      transition.call(document, apply);
    else apply();
  };

  const handle = (block: BannerBlock) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!onArrange || event.button !== 0) return;
      event.stopPropagation();
      event.preventDefault();
      start.current = { block, x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDrag({
        block,
        x: event.clientX,
        y: event.clientY,
        moved: false,
        target: null,
      });
    },
    onPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => {
      const origin = start.current;
      if (!origin) return;
      const moved =
        Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 6;
      setDrag({
        block: origin.block,
        x: event.clientX,
        y: event.clientY,
        moved,
        target: moved ? targetAt(origin.block, event.clientX, event.clientY) : null,
      });
    },
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      const origin = start.current;
      start.current = null;
      setDrag(null);
      if (
        origin &&
        Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 6
      )
        commit(targetAt(origin.block, event.clientX, event.clientY));
    },
    onPointerCancel: () => {
      start.current = null;
      setDrag(null);
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Escape") {
        start.current = null;
        setDrag(null);
        return;
      }
      const direction = (
        {
          ArrowLeft: "left",
          ArrowRight: "right",
          ArrowUp: "top",
          ArrowDown: "bottom",
        } as Record<string, string>
      )[event.key];
      if (!direction || !onArrange) return;
      event.preventDefault();
      if (block === "photo") {
        commit({ layout: `text-${opposite[direction]}` });
        return;
      }
      if (layout === "text-overlay") {
        const index = welcomePositions.indexOf(position);
        const row = Math.floor(index / 3),
          col = index % 3;
        const next =
          direction === "left"
            ? [row, col - 1]
            : direction === "right"
              ? [row, col + 1]
              : direction === "top"
                ? [row - 1, col]
                : [row + 1, col];
        // Past the last anchor, Welcome leaves the photographs for that edge.
        if (next[0] < 0 || next[0] > 2 || next[1] < 0 || next[1] > 2)
          commit({ layout: `text-${direction}` });
        else
          commit({
            layout: "text-overlay",
            position: welcomePositions[next[0] * 3 + next[1]],
          });
        return;
      }
      commit({ layout: `text-${direction}` });
    },
  });

  // The map drawn over the banner during a drag: the four edge bands and, for Welcome,
  // the nine anchors over the photographs. The current target lights up.
  const dropMap = drag ? (
    <div
      className={`banner-drop-map banner-drop-map--${drag.block}${drag.moved ? " is-active" : ""}`}
      aria-hidden="true"
    >
      {(["top", "left", "right", "bottom"] as const).map((side) => {
        const target: ArrangeTarget = {
          layout: `text-${drag.block === "photo" ? opposite[side] : side}`,
        };
        return (
          <span
            key={side}
            className={`banner-drop-map__edge banner-drop-map__edge--${side}${sameTarget(drag.target, target) ? " is-over" : ""}`}
          >
            {drag.block === "photo" ? "Photographs here" : "Welcome here"}
          </span>
        );
      })}
      {drag.block === "text" && (
        <span className="banner-drop-map__anchors">
          {welcomePositions.map((item) => (
            <i
              key={item}
              className={
                sameTarget(drag.target, {
                  layout: "text-overlay",
                  position: item,
                })
                  ? "is-over"
                  : undefined
              }
            />
          ))}
        </span>
      )}
    </div>
  ) : null;
  const ghost =
    drag?.moved ? (
      <div
        className="banner-drag-ghost"
        style={{ left: drag.x, top: drag.y }}
        aria-hidden="true"
      >
        <strong>{drag.block === "text" ? "Welcome" : "Photographs"}</strong>
        <small>
          {drag.target ? describeTarget(drag.target) : "Move over the banner"}
        </small>
      </div>
    ) : null;
  return { handle, dropMap, ghost, dragging: !!drag, announcement };
}

export function BannerHandle({
  block,
  props,
}: {
  block: BannerBlock;
  props: ReturnType<ReturnType<typeof useBannerArrange>["handle"]>;
}) {
  const name = block === "text" ? "Welcome" : "Photographs";
  return (
    <button
      type="button"
      draggable={false}
      className={`banner-live-handle banner-live-handle--${block}`}
      title={`Drag ${name} to arrange · arrow keys move it`}
      aria-label={`Drag ${name} to arrange`}
      {...props}
    >
      <span aria-hidden="true">⠿</span>
      <small>{name}</small>
    </button>
  );
}
