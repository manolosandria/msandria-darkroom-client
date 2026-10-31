/**
 * The gallery's filter bar as a tree the curator arranges by dragging: groups (rows or
 * columns, plain or as a card) holding the bar's pieces. The API validates the same
 * shape (`filterLayout` in the gallery settings). Each piece appears at most once; a
 * department placed in the bar leaves the Filters panel, and so does View.
 */
export const filterElements = [
  "search",
  "filters",
  "reset",
  "chips",
  "count",
  "view",
] as const;
export type FilterElement = (typeof filterElements)[number];

export const filterElementLabels: Record<FilterElement, string> = {
  search: "Search",
  filters: "Filters button",
  reset: "Reset",
  chips: "Chosen filters",
  count: "Photograph count",
  view: "View options",
};

export type FilterLeaf =
  | { id: string; type: FilterElement; grow?: boolean }
  | { id: string; type: "department"; departmentId: string; grow?: boolean };

export type FilterGroup = {
  id: string;
  type: "group";
  direction: "row" | "column";
  gap: number;
  align: "start" | "center" | "end" | "stretch";
  justify: "start" | "center" | "end" | "between";
  wrap: boolean;
  surface: "none" | "card";
  label?: string;
  grow?: boolean;
  children: FilterNode[];
};
export type FilterNode = FilterGroup | FilterLeaf;

export const FILTER_LAYOUT_MAX_DEPTH = 4;
export const FILTER_LAYOUT_MAX_NODES = 40;
export const FILTER_GROUP_MAX_CHILDREN = 12;

export const newFilterGroup = (
  id: string,
  patch: Partial<FilterGroup> = {},
): FilterGroup => ({
  id,
  type: "group",
  direction: "row",
  gap: 8,
  align: "center",
  justify: "start",
  wrap: true,
  surface: "none",
  children: [],
  ...patch,
});

/** The bar the gallery has always shown, as a tree to start from. */
export const defaultFilterLayout = (): FilterGroup =>
  newFilterGroup("root", {
    direction: "column",
    align: "stretch",
    children: [
      newFilterGroup("bar", {
        wrap: false,
        children: [
          { id: "search", type: "search", grow: true },
          { id: "filters", type: "filters" },
          { id: "reset", type: "reset" },
        ],
      }),
      newFilterGroup("meta", {
        justify: "between",
        children: [
          { id: "chips", type: "chips" },
          { id: "count", type: "count" },
        ],
      }),
    ],
  });

/** Every node of the tree, depth first, with its depth (the root is 1). */
export function walkFilterLayout(
  node: FilterNode,
  depth = 1,
): { node: FilterNode; depth: number }[] {
  return [
    { node, depth },
    ...(node.type === "group"
      ? node.children.flatMap((child) => walkFilterLayout(child, depth + 1))
      : []),
  ];
}

/** The key a piece is unique by: its type, or the department it shows. */
export const pieceKey = (node: FilterLeaf) =>
  node.type === "department" ? `department:${node.departmentId}` : node.type;

export function placedPieces(root: FilterGroup): Set<string> {
  return new Set(
    walkFilterLayout(root).flatMap(({ node }) =>
      node.type === "group" ? [] : [pieceKey(node)],
    ),
  );
}

export function findFilterNode(
  root: FilterGroup,
  id: string,
): { node: FilterNode; parent: FilterGroup | null; index: number } | null {
  if (root.id === id) return { node: root, parent: null, index: 0 };
  for (const [index, child] of root.children.entries()) {
    if (child.id === id) return { node: child, parent: root, index };
    if (child.type === "group") {
      const found = findFilterNode(child, id);
      if (found) return found;
    }
  }
  return null;
}

const mapGroups = (
  node: FilterGroup,
  change: (group: FilterGroup) => FilterGroup,
): FilterGroup =>
  change({
    ...node,
    children: node.children.map((child) =>
      child.type === "group" ? mapGroups(child, change) : child,
    ),
  });

export function updateFilterGroup(
  root: FilterGroup,
  id: string,
  patch: Partial<FilterGroup>,
): FilterGroup {
  return mapGroups(root, (group) =>
    group.id === id ? { ...group, ...patch } : group,
  );
}

export function removeFilterNode(root: FilterGroup, id: string): FilterGroup {
  if (root.id === id) return root;
  return mapGroups(root, (group) => ({
    ...group,
    children: group.children.filter((child) => child.id !== id),
  }));
}

const contains = (node: FilterNode, id: string): boolean =>
  walkFilterLayout(node).some((entry) => entry.node.id === id);

/**
 * Puts `node` into the group `groupId` at `index`, taking it out of wherever it was.
 * Returns the tree unchanged when the move would break it: into itself, past the
 * depth or size limits, or into a full group.
 */
export function placeFilterNode(
  root: FilterGroup,
  node: FilterNode,
  groupId: string,
  index: number,
): FilterGroup {
  if (node.id === root.id || contains(node, groupId)) return root;
  const existing = findFilterNode(root, node.id);
  let next = existing ? removeFilterNode(root, node.id) : root;
  const target = findFilterNode(next, groupId);
  if (!target || target.node.type !== "group") return root;
  // Moving within one group: the slot after removal shifts by one.
  const at =
    existing?.parent?.id === groupId && existing.index < index
      ? index - 1
      : index;
  if (target.node.children.length >= FILTER_GROUP_MAX_CHILDREN) return root;
  next = mapGroups(next, (group) =>
    group.id === groupId
      ? {
          ...group,
          children: [
            ...group.children.slice(0, Math.max(0, at)),
            node,
            ...group.children.slice(Math.max(0, at)),
          ],
        }
      : group,
  );
  const nodes = walkFilterLayout(next);
  if (
    nodes.length > FILTER_LAYOUT_MAX_NODES ||
    nodes.some(
      ({ node: entry, depth }) =>
        entry.type === "group" && depth > FILTER_LAYOUT_MAX_DEPTH,
    )
  )
    return root;
  return next;
}

/** A fresh identifier not yet in the tree. */
export function nextFilterId(root: FilterGroup, base: string): string {
  const used = new Set(walkFilterLayout(root).map(({ node }) => node.id));
  const clean = base.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 56) || "node";
  if (!used.has(clean)) return clean;
  let index = 2;
  while (used.has(`${clean}-${index}`)) index += 1;
  return `${clean}-${index}`;
}

/** Drops departments that no longer exist, so the bar never shows an empty piece. */
export function pruneFilterLayout(
  root: FilterGroup,
  departmentIds: string[],
): FilterGroup {
  return mapGroups(root, (group) => ({
    ...group,
    children: group.children.filter(
      (child) =>
        child.type !== "department" ||
        departmentIds.includes(child.departmentId),
    ),
  }));
}
