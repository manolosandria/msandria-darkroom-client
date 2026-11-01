"use client";
import { CancelIcon, RestoreIcon, SaveIcon } from "./CuratorSaveBar";
import "./curatorTheme.css";

/**
 * An editor's own Save, Cancel and (optionally) Restore, as a row of colored icons on
 * the line of its heading: green saves, neutral cancels, amber restores the original.
 * Save submits the editor's form, named by `form`, so it can sit outside it.
 */
export function EditorActions({
  form,
  busy,
  dirty,
  saveLabel,
  onCancel,
  onRestore,
}: {
  form: string;
  busy: boolean;
  dirty: boolean;
  saveLabel: string;
  onCancel: () => void;
  onRestore?: () => void;
}) {
  return (
    <span className="editor-icon-actions">
      <button
        type="submit"
        form={form}
        className="curator-icon-button curator-icon-button--save"
        aria-label={saveLabel}
        title={busy ? "Saving…" : saveLabel}
        aria-busy={busy || undefined}
        disabled={busy || !dirty}
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
