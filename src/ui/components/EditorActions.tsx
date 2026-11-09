"use client";
import { CancelIcon, RestoreIcon, SaveIcon } from "./CuratorSaveBar";
import "./curatorTheme.css";

/**
 * An editor's own Save, Cancel and (optionally) Restore, as a row of colored icons on
 * the line of its heading: green saves, neutral cancels, amber restores the original.
 * Save submits the editor's form, named by `form`, so it can sit outside it, or calls
 * `onSave` for an editor without one. Home, Gallery, Palettes, General, Collections,
 * Photos and Posts all use it.
 */
export function EditorActions({
  form,
  onSave,
  busy,
  dirty,
  canSave = dirty,
  saveLabel,
  onCancel,
  onRestore,
}: {
  form?: string;
  onSave?: () => void;
  busy: boolean;
  dirty: boolean;
  /** Whether Save is offered; by default, while there are changes. */
  canSave?: boolean;
  saveLabel: string;
  onCancel: () => void;
  onRestore?: () => void;
}) {
  return (
    <span className="editor-icon-actions">
      <button
        type={onSave ? "button" : "submit"}
        form={onSave ? undefined : form}
        onClick={onSave}
        className="curator-icon-button curator-icon-button--save"
        aria-label={saveLabel}
        title={busy ? "Saving…" : saveLabel}
        aria-busy={busy || undefined}
        disabled={busy || !canSave}
      >
        <SaveIcon />
      </button>
      <button
        type="button"
        className="curator-icon-button curator-icon-button--cancel"
        aria-label="Cancel changes"
        title="Cancel changes"
        disabled={busy || !dirty}
        onClick={onCancel}
      >
        <CancelIcon />
      </button>
      {onRestore && (
        <button
          type="button"
          className="curator-icon-button curator-icon-button--restore"
          aria-label="Restore original"
          title="Restore the original design"
          disabled={busy}
          onClick={onRestore}
        >
          <RestoreIcon />
        </button>
      )}
    </span>
  );
}
