import { describe, expect, it } from "vitest";
import {
  FILTER_LAYOUT_MAX_DEPTH,
  defaultFilterLayout,
  findFilterNode,
  newFilterGroup,
  nextFilterId,
  placeFilterNode,
  placedPieces,
  pruneFilterLayout,
  removeFilterNode,
  updateFilterGroup,
} from "../galleryFilterLayout";

describe("galleryFilterLayout", () => {
  it("starts from the usual bar with every piece but view placed", () => {
    expect([...placedPieces(defaultFilterLayout())].sort()).toEqual([
      "chips",
      "count",
      "filters",
      "reset",
      "search",
    ]);
  });

  it("moves a piece to another group, taking it out of the first", () => {
    const root = defaultFilterLayout();
    const reset = findFilterNode(root, "reset")!.node;
    const next = placeFilterNode(root, reset, "meta", 0);
    expect(findFilterNode(next, "reset")!.parent!.id).toBe("meta");
    expect(placedPieces(next).size).toBe(5);
  });

  it("moves later within a group counting the slot it leaves", () => {
    const root = defaultFilterLayout();
    const search = findFilterNode(root, "search")!.node;
    const next = placeFilterNode(root, search, "bar", 3);
    const bar = findFilterNode(next, "bar")!.node;
    expect(bar.type === "group" && bar.children.map((c) => c.id)).toEqual([
      "filters",
      "reset",
      "search",
    ]);
  });

  it("refuses to put a group inside itself or past the depth limit", () => {
    const root = defaultFilterLayout();
    const bar = findFilterNode(root, "bar")!.node;
    expect(placeFilterNode(root, bar, "bar", 0)).toBe(root);
    let deep = root;
    let parent = "root";
    for (let depth = 2; depth <= FILTER_LAYOUT_MAX_DEPTH + 1; depth += 1) {
      const id = `g${depth}`;
      deep = placeFilterNode(deep, newFilterGroup(id), parent, 0);
      parent = id;
    }
    expect(findFilterNode(deep, `g${FILTER_LAYOUT_MAX_DEPTH + 1}`)).toBeNull();
  });

  it("updates, removes and names nodes without touching the root", () => {
    const root = defaultFilterLayout();
    expect(
      findFilterNode(
        updateFilterGroup(root, "meta", { surface: "card" }),
        "meta",
      )!.node,
    ).toMatchObject({ surface: "card" });
    expect(removeFilterNode(root, "root")).toBe(root);
    expect(findFilterNode(removeFilterNode(root, "count"), "count")).toBeNull();
    expect(nextFilterId(root, "bar")).toBe("bar-2");
    expect(nextFilterId(root, "new group!")).toBe("new-group-");
  });

  it("drops departments that no longer exist", () => {
    const root = placeFilterNode(
      defaultFilterLayout(),
      { id: "department-x", type: "department", departmentId: "x" },
      "bar",
      0,
    );
    expect(placedPieces(root).has("department:x")).toBe(true);
    expect(
      placedPieces(pruneFilterLayout(root, ["y"])).has("department:x"),
    ).toBe(false);
  });
});
