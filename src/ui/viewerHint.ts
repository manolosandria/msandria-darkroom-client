const STORAGE_KEY = "viewerHintSeen";

// Whether this visitor has already been told that a click hides the viewer's controls.
// Storage can be missing or throw; the hint is then shown once per page load at most,
// which is better than never or every time.
let seenInMemory = false;

export function hasSeenViewerHint(): boolean {
  if (seenInMemory) return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markViewerHintSeen() {
  seenInMemory = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Kept in memory only.
  }
}

export function resetViewerHintForTests() {
  seenInMemory = false;
}
