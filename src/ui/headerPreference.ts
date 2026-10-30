const STORAGE_KEY = "headerHidden";
const listeners = new Set<() => void>();

// Storage can be missing or throw (private windows, blocked site data), and the header
// has to work without it: the choice then lasts only until the page closes.
let fallback = false;

export function readHeaderHidden(): boolean {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === "true";
  } catch {
    return fallback;
  }
  return fallback;
}

export function writeHeaderHidden(hidden: boolean) {
  fallback = hidden;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(hidden));
  } catch {
    // Kept in memory only.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeHeaderHidden(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
