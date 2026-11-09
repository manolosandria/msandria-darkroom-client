const STORAGE_KEY = "photoInspectorHiddenSections";

// Which sections of the Photos inspector this visitor chose to hide. A per-visitor
// convenience: storage can be missing or throw, and then the choice lasts while the
// page is open.
let hiddenInMemory: string[] | null = null;

export function readHiddenSections(known: readonly string[]): string[] {
  if (hiddenInMemory) return hiddenInMemory.filter((id) => known.includes(id));
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "[]",
    );
    if (!Array.isArray(parsed)) return [];
    return known.filter((id) => parsed.includes(id));
  } catch {
    return [];
  }
}

export function writeHiddenSections(hidden: readonly string[]) {
  hiddenInMemory = [...hidden];
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(hidden));
  } catch {
    // Kept in memory only.
  }
}

/**
 * How the inspector shows its sections: one at a time as tabs (the default), or all of
 * them in one scroll. Kept per visitor under `photoInspectorView`, guarded like the
 * hidden sections.
 */
export type InspectorView = "tabs" | "scroll";
const VIEW_KEY = "photoInspectorView";
let viewInMemory: InspectorView | null = null;

export function readInspectorView(): InspectorView {
  if (viewInMemory) return viewInMemory;
  try {
    return window.localStorage.getItem(VIEW_KEY) === "scroll"
      ? "scroll"
      : "tabs";
  } catch {
    return "tabs";
  }
}

export function writeInspectorView(view: InspectorView) {
  viewInMemory = view;
  try {
    window.localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Kept in memory only.
  }
}

/**
 * Parts of Photos a curator can fold out of the way: the inspector's grid of section
 * tabs (`photoInspectorTabsFolded`) and the library's strip of photos while one is open
 * (`photoStripFolded`), and the strip of photos to add to a collection or a post
 * (`photoPickerFolded`). Kept per visitor, guarded like the rest.
 */
export type FoldablePart =
  "photoInspectorTabsFolded" | "photoStripFolded" | "photoPickerFolded";
const foldedInMemory = new Map<FoldablePart, boolean>();

export function readFolded(part: FoldablePart): boolean {
  const remembered = foldedInMemory.get(part);
  if (remembered !== undefined) return remembered;
  try {
    return window.localStorage.getItem(part) === "true";
  } catch {
    return false;
  }
}

export function writeFolded(part: FoldablePart, folded: boolean) {
  foldedInMemory.set(part, folded);
  try {
    window.localStorage.setItem(part, String(folded));
  } catch {
    // Kept in memory only.
  }
}

export function resetHiddenSectionsForTests() {
  hiddenInMemory = null;
  foldedInMemory.clear();
}
