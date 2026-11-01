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
 * Save and Cancel for every editor with unsaved changes: a small card floating in the
 * bottom corner of Curator, so it is always in reach and never takes a row of a panel.
 * Folded, it is a single round button in that corner with the count; the choice is
 * remembered per visitor.
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

export function SaveIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path
        d="M4.5 10.5 8.2 14 15.5 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CancelIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path
        d="M7.5 5.5 4 9l3.5 3.5M4.5 9h7a4 4 0 0 1 0 8h-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RestoreIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path
        d="M4 10a6 6 0 1 0 1.8-4.3M4 4v3.5h3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function CuratorSaveBar({
  state,
}: {
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
      <div className="curator-savebar is-folded">
        <button
          type="button"
          className="curator-savebar__tab"
          aria-label={`Show save buttons. ${summary}`}
          title={summary}
          onClick={() => toggle(false)}
        >
          <SaveIcon />
          <span className="curator-savebar__count" aria-hidden="true">
            {labels.length}
          </span>
        </button>
      </div>
    );
  return (
    <div className="curator-savebar" role="region" aria-label="Save changes">
      <span className="curator-savebar__summary" title={summary}>
        <span className="curator-savebar__dot" aria-hidden="true" />
        <span className="curator-savebar__text">{summary}</span>
      </span>
      {pending.error && (
        <span className="curator-savebar__error" role="alert">
          {pending.error}
        </span>
      )}
      <span className="curator-savebar__actions">
        <button
          type="button"
          className="curator-icon-button curator-icon-button--save"
          aria-label={labels.length === 1 ? "Save" : "Save all"}
          title={labels.length === 1 ? "Save" : "Save all"}
          aria-busy={pending.saving || undefined}
          disabled={pending.saving}
          onClick={() => void pending.saveAll()}
        >
          <SaveIcon />
        </button>
        <button
          type="button"
          className="curator-icon-button curator-icon-button--cancel"
          aria-label="Cancel"
          title="Cancel the changes"
          disabled={pending.saving}
          onClick={() => void pending.discardAll()}
        >
          <CancelIcon />
        </button>
        <button
          type="button"
          className="curator-icon-button curator-savebar__hide"
          aria-label="Hide the save buttons"
          title="Fold into the corner"
          onClick={() => toggle(true)}
        >
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
            <path
              d="M6 6l8 8M14 9v5H9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </span>
    </div>
  );
}
