import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { FilterGroup, newFilterGroup } from "@/src/domain/galleryFilterLayout";
import { useFilterArrange } from "../useFilterArrange";

// The bar: a column holding one container, which holds the search and the view options.
const layout: FilterGroup = newFilterGroup("root", {
  direction: "column",
  children: [
    newFilterGroup("box", {
      direction: "column",
      children: [
        { id: "search", type: "search" },
        { id: "view", type: "view" },
      ],
    }),
  ],
});

// The preview as the hook sees it: nodes marked by id, the container 100 px tall.
function preview() {
  const root = document.createElement("div");
  root.dataset.filterNode = "root";
  const box = document.createElement("div");
  box.dataset.filterNode = "box";
  const view = document.createElement("div");
  view.dataset.filterNode = "view";
  const grip = document.createElement("span");
  grip.dataset.filterGrip = "view";
  view.append(grip);
  box.append(view);
  root.append(box);
  document.body.append(root);
  box.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 300, bottom: 100, width: 300, height: 100 }) as DOMRect;
  document.elementsFromPoint = vi.fn(() => [box, root]);
  return { root, grip };
}

const pointer = (target: Element, x: number, y: number) =>
  ({
    target,
    button: 0,
    clientX: x,
    clientY: y,
    pointerId: 1,
    preventDefault: () => {},
    currentTarget: { setPointerCapture: () => {} },
  }) as unknown as React.PointerEvent;

function drag(to: { x: number; y: number }) {
  const { root, grip } = preview();
  const onChange = vi.fn();
  const { result } = renderHook(() => useFilterArrange(layout, onChange));
  act(() => result.current.handlers.onPointerDown!(pointer(grip, 150, 60)));
  act(() => result.current.handlers.onPointerMove!(pointer(grip, to.x, to.y)));
  act(() => result.current.handlers.onPointerUp!());
  root.remove();
  return onChange.mock.lastCall?.[0] as FilterGroup | undefined;
}

afterEach(() => vi.restoreAllMocks());

describe("useFilterArrange", () => {
  it("drops a piece after a container when let go at its far edge", () => {
    const next = drag({ x: 150, y: 95 });
    expect(next?.children.map((child) => child.id)).toEqual(["box", "view"]);
  });

  it("drops beside the container even when a piece fills it to its edge", () => {
    const { root, grip } = preview();
    const search = document.createElement("div");
    search.dataset.filterNode = "search";
    root.querySelector('[data-filter-node="box"]')!.prepend(search);
    document.elementsFromPoint = vi.fn(() => [
      search,
      root.querySelector('[data-filter-node="box"]')!,
      root,
    ]);
    const onChange = vi.fn();
    const { result } = renderHook(() => useFilterArrange(layout, onChange));
    act(() => result.current.handlers.onPointerDown!(pointer(grip, 150, 60)));
    act(() => result.current.handlers.onPointerMove!(pointer(grip, 150, 96)));
    act(() => result.current.handlers.onPointerUp!());
    root.remove();
    expect(
      (onChange.mock.lastCall?.[0] as FilterGroup).children.map((child) => child.id),
    ).toEqual(["box", "view"]);
  });

  it("drops a piece inside a container when let go in its middle", () => {
    const next = drag({ x: 150, y: 50 });
    const box = next?.children[0] as FilterGroup | undefined;
    expect(next?.children).toHaveLength(1);
    expect(box?.children.map((child) => child.id)).toContain("view");
  });
});
