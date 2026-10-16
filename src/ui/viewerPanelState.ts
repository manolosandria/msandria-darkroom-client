// Whether the viewer's info panel is open. The viewer is remounted for every photo (the
// route's segment changes), so this lives outside it: moving to another photo keeps
// the panel as it was. Memory only; a fresh page load starts with the panel closed.
let open = false;
const listeners = new Set<() => void>();

export function isViewerPanelOpen(): boolean {
  return open;
}

export function setViewerPanelOpen(next: boolean) {
  if (next === open) return;
  open = next;
  listeners.forEach((listener) => listener());
}

export function subscribeViewerPanel(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
