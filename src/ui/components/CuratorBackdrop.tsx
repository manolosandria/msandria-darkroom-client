"use client";
import { useEffect, useState } from "react";

const STORAGE_KEY = "curatorBackdrop";

/** The backgrounds Curator can wear: still paper, or a slow gradient with some grain. */
export const curatorBackdrops = [
  { id: "paper", name: "Paper" },
  { id: "meadow", name: "Meadow" },
  { id: "dusk", name: "Dusk" },
  { id: "tide", name: "Tide" },
  { id: "darkroom", name: "Darkroom" },
] as const;
export type CuratorBackdrop = (typeof curatorBackdrops)[number]["id"];
let remembered: CuratorBackdrop = "meadow";

const isBackdrop = (value: unknown): value is CuratorBackdrop =>
  curatorBackdrops.some((backdrop) => backdrop.id === value);

// Curator wears the backdrop; the account menu in the header chooses it. Every user
// of the hook hears a choice made anywhere.
const CHANGED = "curator:backdrop";

/** The chosen backdrop, kept per visitor in localStorage (guarded, else in memory). */
export function useCuratorBackdrop() {
  const [value, setValue] = useState<CuratorBackdrop>(remembered);
  useEffect(() => {
    const changed = () => setValue(remembered);
    window.addEventListener(CHANGED, changed);
    queueMicrotask(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (isBackdrop(stored)) {
          remembered = stored;
          setValue(stored);
        }
      } catch {
        /* Keep the one in memory. */
      }
    });
    return () => window.removeEventListener(CHANGED, changed);
  }, []);
  const choose = (next: CuratorBackdrop) => {
    remembered = next;
    setValue(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* Remembered in memory only. */
    }
    window.dispatchEvent(new Event(CHANGED));
  };
  return { value, choose };
}

/** One swatch per backdrop, in the account menu while Curator is open. */
export function CuratorBackdropPicker({
  state,
}: {
  state: ReturnType<typeof useCuratorBackdrop>;
}) {
  return (
    <div
      className="curator-backdrop-picker"
      role="radiogroup"
      aria-label="Backdrop"
    >
      {curatorBackdrops.map((backdrop) => (
        <button
          key={backdrop.id}
          type="button"
          role="radio"
          aria-checked={state.value === backdrop.id}
          aria-label={`${backdrop.name} backdrop`}
          title={backdrop.name}
          className={`curator-backdrop-swatch curator-backdrop-swatch--${backdrop.id}`}
          onClick={() => state.choose(backdrop.id)}
        />
      ))}
    </div>
  );
}
