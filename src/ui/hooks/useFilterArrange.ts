import { useRef, useState } from "react";
import {
  findFilterNode,
  FilterGroup,
  placeFilterNode,
} from "@/src/domain/galleryFilterLayout";

export type FilterDrop = {
  targetId: string;
  mode: "before" | "after" | "inside";
  groupId: string;
  index: number;
};

const THRESHOLD = 5;
// How close to a container's edge a drop goes beside it rather than inside it.
const EDGE = 16;

/**
 * Drag the filter bar's pieces and containers in the Gallery preview itself. Each node
 * carries `data-filter-node` (and containers `data-filter-group`); a drag shows where
 * the node would land (a line before or after a piece or, at a container's edge, the
 * container; or inside a container) and the drop moves it there in the tree. Moves
 * that break the tree's limits are refused.
 */
export function useFilterArrange(
  layout: FilterGroup | undefined,
  onChange: ((layout: FilterGroup) => void) | undefined,
) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [drop, setDrop] = useState<FilterDrop | null>(null);
  const start = useRef<{ id: string; x: number; y: number } | null>(null);

  const dropAt = (x: number, y: number, draggedId: string): FilterDrop | null => {
    if (!layout) return null;
    const hit = document
      .elementsFromPoint(x, y)
      .map((element) => element.closest<HTMLElement>("[data-filter-node]"))
      .find(
        (element) =>
          element && !element.closest(`[data-filter-node="${CSS.escape(draggedId)}"]`),
      );
    if (!hit) return null;
    // Near a container's edge (along its parent's direction), the drop lands beside it
    // in the parent: the only way to place a piece under or after a container that its
    // pieces fill to the edge. The innermost container whose edge is under the pointer
    // wins, starting from the piece hit.
    for (
      let element: HTMLElement | null = hit;
      element;
      element =
        element.parentElement?.closest<HTMLElement>("[data-filter-node]") ?? null
    ) {
      const around = findFilterNode(layout, element.dataset.filterNode!);
      if (around?.node.type !== "group" || !around.parent) continue;
      const box = element.getBoundingClientRect();
      const row = around.parent.direction === "row";
      const band = Math.min(EDGE, (row ? box.width : box.height) / 4);
      const fromStart = row ? x - box.left : y - box.top;
      const fromEnd = row ? box.right - x : box.bottom - y;
      if (fromEnd < band || fromStart < band)
        return {
          targetId: around.node.id,
          mode: fromEnd < band ? "after" : "before",
          groupId: around.parent.id,
          index: around.index + (fromEnd < band ? 1 : 0),
        };
    }
    const id = hit.dataset.filterNode!;
    const found = findFilterNode(layout, id);
    if (!found) return null;
    if (found.node.type === "group") {
      // Inside a container: before the first child whose middle is past the pointer.
      const row = found.node.direction === "row";
      const children = Array.from(
        hit.querySelectorAll<HTMLElement>(":scope > [data-filter-node]"),
      );
      let index = children.findIndex((child) => {
        const box = child.getBoundingClientRect();
        return row ? x < box.left + box.width / 2 : y < box.top + box.height / 2;
      });
      if (index < 0) index = children.length;
      return { targetId: id, mode: "inside", groupId: id, index };
    }
    if (!found.parent) return null;
    const box = hit.getBoundingClientRect();
    const row = found.parent.direction === "row";
    const after = row
      ? x > box.left + box.width / 2
      : y > box.top + box.height / 2;
    return {
      targetId: id,
      mode: after ? "after" : "before",
      groupId: found.parent.id,
      index: found.index + (after ? 1 : 0),
    };
  };

  const active = Boolean(layout && onChange);
  const handlers = active
    ? {
        onPointerDown: (event: React.PointerEvent) => {
          const node = (event.target as Element).closest<HTMLElement>(
            "[data-filter-grip]",
          );
          if (!node || event.button !== 0) return;
          event.preventDefault();
          start.current = {
            id: node.dataset.filterGrip!,
            x: event.clientX,
            y: event.clientY,
          };
          (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        },
        onPointerMove: (event: React.PointerEvent) => {
          const origin = start.current;
          if (!origin) return;
          if (
            !dragging &&
            Math.hypot(event.clientX - origin.x, event.clientY - origin.y) <
              THRESHOLD
          )
            return;
          setDragging(origin.id);
          setDrop(dropAt(event.clientX, event.clientY, origin.id));
        },
        onPointerUp: () => {
          const origin = start.current;
          start.current = null;
          if (origin && dragging && drop && layout && onChange) {
            const found = findFilterNode(layout, origin.id);
            if (found) {
              const next = placeFilterNode(
                layout,
                found.node,
                drop.groupId,
                drop.index,
              );
              if (next !== layout) onChange(next);
            }
          }
          setDragging(null);
          setDrop(null);
        },
        onPointerCancel: () => {
          start.current = null;
          setDragging(null);
          setDrop(null);
        },
        onKeyDown: (event: React.KeyboardEvent) => {
          if (event.key === "Escape" && dragging) {
            start.current = null;
            setDragging(null);
            setDrop(null);
          }
        },
      }
    : {};
  return { active, dragging, drop, handlers };
}
