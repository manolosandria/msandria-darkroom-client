"use client";

import styles from "./EditorFeedback.module.css";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { usePathname } from "next/navigation";
import {
  changedFields,
  diffChanges,
  revertChange,
} from "@/src/ui/changeSummary";
import { ChangeReview, decisionKey, ReviewedEditor } from "./ChangeReview";

// What an editor edits, when it can say so: the saved version, the draft and a way to
// put a draft back. With it, every change can be undone step by step and reviewed field
// by field before saving; without it, the editor is saved or discarded whole.
export type EditorDocument = {
  original: unknown;
  draft: unknown;
  restore: (draft: unknown) => void;
  /** Keep a return to the saved draft undoable; reset history when this scope changes. */
  undoScope?: object;
};
/** What a save reports: `true` once saved; `false`, or why, when it was not. */
export type SaveOutcome = boolean | { error: string };
const savedOf = (outcome: SaveOutcome) => outcome === true;

/** The words for a save that failed: which editor, which of its fields and why, so
 *  the save bar and the leaving dialog never just say that something went wrong. */
export function saveFailureMessage(
  label: string,
  fields: string[],
  reason: string,
) {
  const what = fields.length ? ` (${fields.join(", ")})` : "";
  const why = reason.trim().replace(/\.$/, "");
  return why
    ? `“${label}”${what} was not saved: ${why}.`
    : `“${label}”${what} was not saved. Its editor says why.`;
}
type Editor = {
  label: string;
  save: () => Promise<SaveOutcome>;
  discard: () => void;
  document?: EditorDocument;
};
type RegisteredEditor = Omit<Editor, "document"> & {
  document: () => EditorDocument | undefined;
};
// One step back: the draft an editor had before a change.
type Step = { id: string; label: string; previous: unknown; key: string; at: number };
// Changes to the same fields of one editor within this time are one step, so typing a
// word is undone at once rather than letter by letter.
const STEP_MERGE_MS = 1000;
const MAX_STEPS = 200;
type Question = {
  title: string;
  message: string;
  resolve: (accepted: boolean) => void;
};
type Workspace = {
  register: (id: string, editor: RegisteredEditor) => () => void;
  confirm: (title: string, message: string) => Promise<boolean>;
  requestExit: (action: () => void) => void;
  track: (id: string, restore: (draft: unknown) => void) => () => void;
  record: (step: Omit<Step, "at">) => void;
  forget: (id: string) => void;
  consumeSkip: (id: string) => boolean;
  review: (ids?: string[]) => Promise<boolean>;
};
const Context = createContext<Workspace | null>(null);

// What the floating save bars need: the editors with unsaved changes, and a way to save
// or discard them all at once. Kept apart from the workspace so its identity changes
// only when the list does.
export type PendingEdits = {
  labels: string[];
  saveAll: () => Promise<boolean>;
  discardAll: () => Promise<void>;
  saving: boolean;
  error: string;
  /** Opens the review of every pending change; resolves true once saved. */
  review: () => Promise<boolean>;
  /** Takes back the last change of any editor; false when there is none. */
  undo: () => boolean;
  /** The editor whose change Undo would take back, if any. */
  undoLabel: string | null;
};
const PendingContext = createContext<PendingEdits | null>(null);
export const usePendingEdits = () => useContext(PendingContext);

export function useOptionalEditingWorkspace() {
  return useContext(Context);
}

export function EditingBoundary({ children }: { children: React.ReactNode }) {
  const existing = useContext(Context);
  return existing ? children : <EditingWorkspace>{children}</EditingWorkspace>;
}

export function useEditingWorkspace() {
  const workspace = useContext(Context);
  if (!workspace) throw new Error("An editing workspace is required.");
  return workspace;
}

// Editors pass fresh callbacks on every render. Registering them again each time would
// remove and re-add the entry, and every save bar would render twice per render of
// the editor; so the entry is registered once while dirty and reads the latest
// callbacks when it is used. An editor that passes its `document` also records each
// change of its draft as a step Undo can take back, and its changes are reviewed one by
// one before saving (`review`).
export function useUnsavedEditor(dirty: boolean, editor: Editor) {
  const id = useId();
  const { register, track, record, forget, consumeSkip, review } =
    useEditingWorkspace();
  const latest = useRef(editor);
  useEffect(() => {
    latest.current = editor;
  });
  const { label } = editor;
  useEffect(() => {
    if (!dirty) return;
    return register(id, {
      label,
      save: () => latest.current.save(),
      discard: () => latest.current.discard(),
      document: () => latest.current.document,
    });
  }, [dirty, label, id, register]);
  const documented = Boolean(editor.document);
  useEffect(() => {
    if (!documented) return;
    return track(id, (draft) => latest.current.document?.restore(draft));
  }, [documented, id, track]);
  const draftJson = editor.document
    ? JSON.stringify(editor.document.draft)
    : undefined;
  const before = useRef<{ json?: string; value?: unknown; scope?: object }>({});
  useEffect(() => {
    const current = latest.current.document;
    if (!current) return;
    const previous = before.current;
    before.current = {
      json: draftJson,
      value: current.draft,
      scope: current.undoScope,
    };
    if (current.undoScope && previous.scope !== current.undoScope) {
      forget(id);
      return;
    }
    if (previous.json === undefined || previous.json === draftJson) return;
    if (consumeSkip(id)) return;
    // Editors without a scope keep their existing reset-on-clean behavior.
    if (!current.undoScope && draftJson === JSON.stringify(current.original)) {
      forget(id);
      return;
    }
    record({
      id,
      label: latest.current.label,
      previous: previous.value,
      key:
        draftJson === JSON.stringify(current.original)
          ? "discard"
          : diffChanges(previous.value, current.draft)
              .map((change) => change.label)
              .join("|"),
    });
  }, [draftJson, editor.document?.undoScope, id, record, forget, consumeSkip]);
  // Nothing pending: nothing to review, and the editor saves as it always did.
  return {
    review: () =>
      dirty ? review([id]) : latest.current.save().then(savedOf),
  };
}

const navigateTo = (url: string) => window.location.assign(url);

// Saves one editor; null when it saved, otherwise what failed in words. The fields are
// read before saving, while the draft still differs from what was saved.
async function attemptSave(editor: RegisteredEditor): Promise<string | null> {
  const document = editor.document();
  const fields = document ? changedFields(document.original, document.draft) : [];
  const outcome = await editor.save();
  if (savedOf(outcome)) return null;
  return saveFailureMessage(
    editor.label,
    fields,
    typeof outcome === "object" ? outcome.error : "",
  );
}
const KEPT = "Your drafts are still here.";
const failureText = (failures: string[]) => `${failures.join(" ")} ${KEPT}`;

// Fields whose own undo handles Ctrl+Z.
const TEXT_FIELDS =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]), textarea, select, [contenteditable="true"]';

export function EditingWorkspace({
  children,
  navigate = navigateTo,
}: {
  children: React.ReactNode;
  navigate?: (url: string) => void;
}) {
  const pathname = usePathname();
  const locationRef = useRef<{ url: string; state: unknown } | null>(null);
  useEffect(() => {
    locationRef.current = { url: location.href, state: history.state };
  }, [pathname]);
  const editors = useRef(new Map<string, RegisteredEditor>());
  const restorers = useRef(new Map<string, (draft: unknown) => void>());
  const steps = useRef<Step[]>([]);
  const skips = useRef(new Set<string>());
  const [undoLabel, setUndoLabel] = useState<string | null>(null);
  const syncUndo = useCallback(
    () => setUndoLabel(steps.current.at(-1)?.label ?? null),
    [],
  );
  const [reviewing, setReviewing] = useState<{
    ids: string[];
    resolve: (saved: boolean) => void;
  } | null>(null);
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [question, setQuestion] = useState<Question | null>(null);
  const [leaving, setLeaving] = useState<(() => void) | null>(null);
  const [busy, setBusy] = useState(false);
  const allowed = useRef(false);
  const questionRef = useRef<Question | null>(null);
  const [labels, setLabels] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  // Editors register again whenever their callbacks change, so the list is only
  // replaced when its labels do: anything else would render the workspace in a loop.
  const syncLabels = useCallback(() => {
    const next = Array.from(editors.current.values(), (editor) => editor.label);
    setLabels((previous) =>
      previous.join("\n") === next.join("\n") ? previous : next,
    );
  }, []);
  const confirm = useCallback(
    (title: string, message: string) =>
      new Promise<boolean>((resolve) => {
        const next = { title, message, resolve };
        questionRef.current = next;
        setQuestion(next);
      }),
    [],
  );
  const track = useCallback(
    (id: string, restore: (draft: unknown) => void) => {
      restorers.current.set(id, restore);
      return () => {
        restorers.current.delete(id);
        steps.current = steps.current.filter((step) => step.id !== id);
        syncUndo();
      };
    },
    [syncUndo],
  );
  const record = useCallback(
    (step: Omit<Step, "at">) => {
      const last = steps.current.at(-1);
      const now = Date.now();
      if (
        last &&
        last.id === step.id &&
        last.key === step.key &&
        now - last.at < STEP_MERGE_MS
      )
        last.at = now;
      else
        steps.current = [...steps.current, { ...step, at: now }].slice(
          -MAX_STEPS,
        );
      syncUndo();
    },
    [syncUndo],
  );
  const forget = useCallback(
    (id: string) => {
      steps.current = steps.current.filter((step) => step.id !== id);
      syncUndo();
    },
    [syncUndo],
  );
  const consumeSkip = useCallback(
    (id: string) => skips.current.delete(id),
    [],
  );
  const undo = useCallback(() => {
    while (steps.current.length) {
      const step = steps.current[steps.current.length - 1];
      steps.current = steps.current.slice(0, -1);
      const restore = restorers.current.get(step.id);
      if (!restore) continue;
      skips.current.add(step.id);
      restore(step.previous);
      syncUndo();
      return true;
    }
    syncUndo();
    return false;
  }, [syncUndo]);
  const review = useCallback(
    (ids?: string[]) =>
      new Promise<boolean>((resolve) => {
        const chosen = Array.from(editors.current.keys()).filter(
          (id) => !ids || ids.includes(id),
        );
        if (!chosen.length) {
          resolve(true);
          return;
        }
        setDecisions({});
        setReviewError("");
        setReviewing({ ids: chosen, resolve });
      }),
    [],
  );
  const register = useCallback((id: string, editor: RegisteredEditor) => {
    allowed.current = false;
    editors.current.set(id, editor);
    syncLabels();
    return () => {
      editors.current.delete(id);
      syncLabels();
    };
  }, [syncLabels]);
  // Every editor is tried, so one refusal does not hold back the others; the message
  // names each one that failed. It stays until the next outcome replaces it.
  const saveEvery = useCallback(async (): Promise<string> => {
    const failures: string[] = [];
    try {
      for (const editor of Array.from(editors.current.values())) {
        const failure = await attemptSave(editor);
        if (failure) failures.push(failure);
      }
    } catch {
      failures.push("The changes could not be sent to the API.");
    }
    return failures.length ? failureText(failures) : "";
  }, []);
  const saveAll = useCallback(async () => {
    setSaving(true);
    try {
      const failure = await saveEvery();
      setSaveError(failure);
      return !failure;
    } finally {
      setSaving(false);
    }
  }, [saveEvery]);
  // Nothing pending, nothing left to report.
  useEffect(() => {
    if (!labels.length) queueMicrotask(() => setSaveError(""));
  }, [labels.length]);
  const requestExit = useCallback((action: () => void) => {
    if (!editors.current.size) {
      action();
      return;
    }
    setLeaving(() => action);
  }, []);
  const context = useMemo(
    () => ({
      register,
      confirm,
      requestExit,
      track,
      record,
      forget,
      consumeSkip,
      review,
    }),
    [register, confirm, requestExit, track, record, forget, consumeSkip, review],
  );
  const discardAll = useCallback(async () => {
    if (
      !(await confirm(
        "Discard all changes?",
        `Unsaved changes in ${Array.from(editors.current.values(), (editor) => editor.label).join(", ")} will be lost.`,
      ))
    )
      return;
    for (const editor of Array.from(editors.current.values())) editor.discard();
    setSaveError("");
  }, [confirm]);
  const reviewAll = useCallback(() => review(), [review]);
  const pending = useMemo(
    () => ({
      labels,
      saveAll,
      discardAll,
      saving,
      error: saveError,
      review: reviewAll,
      undo,
      undoLabel,
    }),
    [labels, saveAll, discardAll, saving, saveError, reviewAll, undo, undoLabel],
  );
  // Ctrl+Z (Cmd+Z) outside a text field takes back the last change; inside one, the
  // field's own undo works as always.
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.shiftKey ||
        event.altKey ||
        event.key.toLowerCase() !== "z" ||
        questionRef.current
      )
        return;
      const target = event.target as HTMLElement | null;
      if (target?.closest?.(TEXT_FIELDS)) return;
      if (undo()) event.preventDefault();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [undo]);
  // The editors under review, with their changes field by field.
  const reviewed: ReviewedEditor[] = (reviewing?.ids ?? []).flatMap((id) => {
    const editor = editors.current.get(id);
    if (!editor) return [];
    const document = editor.document();
    const changes = document
      ? diffChanges(document.original, document.draft)
      : [];
    return [{ id, label: editor.label, changes: changes.length ? changes : null }];
  });
  function closeReview(saved: boolean) {
    reviewing?.resolve(saved);
    setReviewing(null);
    setReviewBusy(false);
  }
  async function confirmReview() {
    setReviewBusy(true);
    setReviewError("");
    const failures: string[] = [];
    try {
      for (const item of reviewed) {
        const editor = editors.current.get(item.id);
        if (!editor) continue;
        const dropped = item.changes
          ? item.changes.filter(
              (change) => decisions[decisionKey(item.id, change.path)] === false,
            )
          : [];
        const dropAll = item.changes
          ? dropped.length === item.changes.length
          : decisions[decisionKey(item.id, null)] === false;
        if (dropAll) {
          editor.discard();
          continue;
        }
        const document = editor.document();
        if (document && dropped.length) {
          const kept = dropped.reduce<unknown>(
            (draft, change) =>
              revertChange(draft, document.original, change.path),
            document.draft,
          );
          skips.current.add(item.id);
          flushSync(() => document.restore(kept));
          // Lets the editor render the kept draft before it saves it.
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        // A failed save keeps its draft; the editor and the save bar say why.
        const failure = await attemptSave(editor);
        if (failure) failures.push(failure);
      }
      setSaveError(failures.length ? failureText(failures) : "");
      closeReview(!failures.length);
    } catch {
      setReviewError("Could not save the changes. Your drafts are still there.");
      setReviewBusy(false);
    }
  }
  useEffect(() => () => questionRef.current?.resolve(false), []);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (editors.current.size && !allowed.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const click = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        !editors.current.size
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.download ||
        (link.target && link.target !== "_self")
      )
        return;
      const target = new URL(link.href);
      if (!["http:", "https:"].includes(target.protocol)) return;
      if (
        target.href === location.href ||
        (target.pathname === location.pathname &&
          target.search === location.search &&
          target.hash)
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setLeaving(() => () => {
        navigate(target.href);
      });
    };
    // Back/forward navigations cannot be cancelled, so restore this history entry
    // before asking. Only an explicit choice may leave the mounted drafts behind.
    const remember = () => {
      locationRef.current = { url: location.href, state: history.state };
    };
    const back = (event: PopStateEvent) => {
      if (!editors.current.size || allowed.current) {
        remember();
        return;
      }
      const target = location.href;
      if (!locationRef.current || target === locationRef.current.url) return;
      event.stopImmediatePropagation();
      history.pushState(locationRef.current.state, "", locationRef.current.url);
      setLeaving(() => () => {
        navigate(target);
      });
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    window.addEventListener("popstate", back, true);
    window.addEventListener("focus", remember);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
      window.removeEventListener("popstate", back, true);
      window.removeEventListener("focus", remember);
    };
  }, [navigate]);
  function answer(accepted: boolean) {
    questionRef.current?.resolve(accepted);
    questionRef.current = null;
    setQuestion(null);
  }
  function leave() {
    allowed.current = true;
    leaving?.();
    setLeaving(null);
  }
  return (
    <Context.Provider value={context}>
      <PendingContext.Provider value={pending}>
      <div
        className="editor-workspace-content"
        inert={question || leaving || reviewing ? true : undefined}
      >
        {children}
      </div>
      {(question || leaving) && createPortal(
        <div className={styles.backdrop} onClick={(event) => {
          if (event.target === event.currentTarget && !busy) {
            if (question) answer(false);
            else setLeaving(null);
          }
        }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-dialog-title"
            className={styles.dialog}
            onKeyDown={(event) => {
              if (event.key === "Escape" && !busy) {
                event.preventDefault();
                if (question) answer(false);
                else setLeaving(null);
              }
              if (event.key === "Tab") {
                const controls = Array.from(
                  event.currentTarget.querySelectorAll<HTMLButtonElement>(
                    "button:not(:disabled)",
                  ),
                );
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <h2 id="editor-dialog-title">
              {question?.title ?? "Unsaved changes"}
            </h2>
            <p>
              {question?.message ??
                `Unsaved changes in ${labels.map((label) => `“${label}”`).join(", ")}. Save them before leaving, keep editing, or leave without saving.`}
            </p>
            {/* The last failure stays put while a new attempt runs, so the dialog
                never blinks; only the next outcome replaces it. */}
            {!question && saveError && (
              <p role="alert" className={styles.failure}>
                {saveError} Cancel to fix it in its editor.
              </p>
            )}
            <div className={styles.actions}>
              {question ? (
                <button
                  type="button"
                  autoFocus
                  className="upload-primary"
                  onClick={() => answer(true)}
                >
                  Accept
                </button>
              ) : (
                <button
                  type="button"
                  autoFocus
                  className="upload-primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const failure = await saveEvery();
                      setSaveError(failure);
                      if (!failure) leave();
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? "Saving…" : "Save all and leave"}
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => (question ? answer(false) : setLeaving(null))}
              >
                Cancel
              </button>
              {!question && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    for (const editor of editors.current.values())
                      editor.discard();
                    editors.current.clear();
                    leave();
                  }}
                >
                  Leave without saving
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
      {reviewing && !question && !leaving && createPortal(
        <div className={styles.backdrop} onClick={(event) => {
          if (event.target === event.currentTarget && !reviewBusy)
            closeReview(false);
        }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-review-title"
            className={`${styles.dialog} change-review-dialog`}
            onKeyDown={(event) => {
              if (event.key === "Escape" && !reviewBusy) {
                event.preventDefault();
                closeReview(false);
              }
            }}
          >
            <ChangeReview
              editors={reviewed}
              decisions={decisions}
              onDecide={(key, keep) =>
                setDecisions((previous) => ({ ...previous, [key]: keep }))
              }
              onConfirm={() => void confirmReview()}
              onCancel={() => closeReview(false)}
              busy={reviewBusy}
              error={reviewError}
            />
          </div>
        </div>,
        document.body,
      )}
      </PendingContext.Provider>
    </Context.Provider>
  );
}
