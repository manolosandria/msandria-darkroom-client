"use client";
import { useEffect, useState } from "react";
import { usePendingEdits } from "./EditingWorkspace";

const STORAGE_KEY = "curatorSaveBarHidden";
let remembered = false;

function readHidden() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return remembered;
  }
}

function writeHidden(hidden: boolean) {
  remembered = hidden;
  try {
    localStorage.setItem(STORAGE_KEY, String(hidden));
  } catch {
    /* Remembered in memory only. */
  }
}

/**
 * Save and Cancel for every editor with unsaved changes, at the top and at the bottom of
 * Curator, so they are never at the far end of a long panel. They sit beside each
 * editor's own buttons, and can be folded away to a small tab and brought back; that
 * choice is remembered per visitor. Both bars share one state.
 */
export function useCuratorSaveBar() {
  const pending = usePendingEdits();
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setHidden(readHidden()));
  }, []);
  const toggle = (next: boolean) => {
    setHidden(next);
    writeHidden(next);
  };
  return { pending, hidden, toggle };
}

export function CuratorSaveBar({
  edge,
  state,
}: {
  edge: "top" | "bottom";
  state: ReturnType<typeof useCuratorSaveBar>;
}) {
  const { pending, hidden, toggle } = state;
  const labels = pending?.labels ?? [];
  if (!pending || !labels.length) return null;
  const summary =
    labels.length === 1
      ? `Unsaved: ${labels[0]}`
      : `${labels.length} editors unsaved: ${labels.join(", ")}`;
  if (hidden)
    return (
      <div className={`curator-savebar curator-savebar--${edge} is-folded`}>
        <button
          type="button"
          className="curator-savebar__tab"
          aria-label={`Show save buttons. ${summary}`}
          title={summary}
          onClick={() => toggle(false)}
        >
          <span className="curator-savebar__dot" aria-hidden="true" />
          Save {edge === "top" ? "▾" : "▴"}
        </button>
      </div>
    );
  return (
    <div
      className={`curator-savebar curator-savebar--${edge}`}
      role="region"
      aria-label={`Save changes (${edge})`}
    >
      <span className="curator-savebar__summary" title={summary}>
        <span className="curator-savebar__dot" aria-hidden="true" />
        {summary}
      </span>
      {pending.error && (
        <span className="curator-savebar__error" role="alert">
          {pending.error}
        </span>
      )}
      <span className="curator-savebar__actions">
        <button
          type="button"
          className="upload-primary"
          disabled={pending.saving}
          onClick={() => void pending.saveAll()}
        >
          {pending.saving
            ? "Saving…"
            : labels.length === 1
              ? "Save"
              : "Save all"}
        </button>
        <button
          type="button"
          disabled={pending.saving}
          onClick={() => void pending.discardAll()}
        >
          Cancel
        </button>
        <button
          type="button"
          className="curator-savebar__hide"
          aria-label="Hide the save buttons"
          title="Hide the save buttons"
          onClick={() => toggle(true)}
        >
          <span aria-hidden="true">{edge === "top" ? "▴" : "▾"}</span>
        </button>
      </span>
    </div>
  );
}
