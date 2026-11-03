"use client";
import "./changeReview.css";
import { Change, isColor, previewValue } from "@/src/ui/changeSummary";

export type ReviewedEditor = {
  id: string;
  label: string;
  /** Field by field; null when the editor can only be kept or dropped whole. */
  changes: Change[] | null;
};

// One change's key in the decisions: the editor, then the path ("*" for a whole editor).
export const decisionKey = (id: string, path: string[] | null) =>
  `${id}::${path ? path.join(".") : "*"}`;

function Value({ value }: { value: unknown }) {
  return (
    <span className="change-review__value">
      {isColor(value) && (
        <span
          className="change-review__swatch"
          style={{ background: value }}
          aria-hidden="true"
        />
      )}
      {previewValue(value)}
    </span>
  );
}

/**
 * Before saving: every change of every editor being saved, each one kept by default
 * and dropped with a press. Saving keeps what is kept; what is dropped goes back to how
 * it was saved.
 */
export function ChangeReview({
  editors,
  decisions,
  onDecide,
  onConfirm,
  onCancel,
  busy,
  error,
}: {
  editors: ReviewedEditor[];
  decisions: Record<string, boolean>;
  onDecide: (key: string, keep: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
  error: string;
}) {
  const rows = editors.flatMap((editor) =>
    editor.changes
      ? editor.changes.map((change) => decisionKey(editor.id, change.path))
      : [decisionKey(editor.id, null)],
  );
  const kept = rows.filter((key) => decisions[key] !== false).length;
  const choice = (key: string, label: string) => {
    const keep = decisions[key] !== false;
    return (
      <span
        className="change-review__choice"
        role="radiogroup"
        aria-label={`Keep or discard: ${label}`}
      >
        <button
          type="button"
          role="radio"
          aria-checked={keep}
          disabled={busy}
          onClick={() => onDecide(key, true)}
        >
          Accept
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={!keep}
          disabled={busy}
          onClick={() => onDecide(key, false)}
        >
          Discard
        </button>
      </span>
    );
  };
  return (
    <div className="change-review">
      <h2 id="change-review-title">Review changes</h2>
      <p className="change-review__lead">
        Accept what should be saved and discard the rest; a discarded change goes
        back to how it was saved.
      </p>
      {editors.map((editor) => {
        const keys = editor.changes
          ? editor.changes.map((change) => decisionKey(editor.id, change.path))
          : [decisionKey(editor.id, null)];
        return (
          <section
            key={editor.id}
            className="change-review__editor"
            aria-label={editor.label}
          >
            <header>
              <h3>{editor.label}</h3>
              <span>
                <button
                  type="button"
                  className="change-review__all"
                  disabled={busy}
                  onClick={() => keys.forEach((key) => onDecide(key, true))}
                >
                  Accept all
                </button>
                <button
                  type="button"
                  className="change-review__all"
                  disabled={busy}
                  onClick={() => keys.forEach((key) => onDecide(key, false))}
                >
                  Discard all
                </button>
              </span>
            </header>
            <ul>
              {editor.changes ? (
                editor.changes.map((change) => {
                  const key = decisionKey(editor.id, change.path);
                  return (
                    <li
                      key={key}
                      data-discarded={decisions[key] === false ? "" : undefined}
                    >
                      <span className="change-review__what">
                        <strong>{change.label}</strong>
                        <span className="change-review__values">
                          <Value value={change.before} />
                          <span aria-hidden="true">→</span>
                          <span className="sr-only">becomes</span>
                          <Value value={change.after} />
                        </span>
                      </span>
                      {choice(key, change.label)}
                    </li>
                  );
                })
              ) : (
                <li
                  data-discarded={
                    decisions[decisionKey(editor.id, null)] === false
                      ? ""
                      : undefined
                  }
                >
                  <span className="change-review__what">
                    <strong>All changes</strong>
                    <span className="change-review__values">
                      Saved or discarded together
                    </span>
                  </span>
                  {choice(decisionKey(editor.id, null), editor.label)}
                </li>
              )}
            </ul>
          </section>
        );
      })}
      {error && (
        <p role="alert" className="change-review__error">
          {error}
        </p>
      )}
      <div className="change-review__actions">
        <button
          type="button"
          className="change-review__save"
          disabled={busy}
          onClick={onConfirm}
          autoFocus
        >
          {busy
            ? "Saving…"
            : kept === rows.length
              ? "Save all"
              : kept
                ? `Save ${kept} of ${rows.length}`
                : "Discard all"}
        </button>
        <button type="button" disabled={busy} onClick={onCancel}>
          Keep editing
        </button>
      </div>
    </div>
  );
}
