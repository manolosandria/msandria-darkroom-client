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

export function resetHiddenSectionsForTests() {
  hiddenInMemory = null;
}
