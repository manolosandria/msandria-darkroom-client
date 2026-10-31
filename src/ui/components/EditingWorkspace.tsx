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
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

type Editor = {
  label: string;
  save: () => Promise<boolean>;
  discard: () => void;
};
type Question = {
  title: string;
  message: string;
  resolve: (accepted: boolean) => void;
};
type Workspace = {
  register: (id: string, editor: Editor) => () => void;
  confirm: (title: string, message: string) => Promise<boolean>;
  requestExit: (action: () => void) => void;
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

export function useUnsavedEditor(dirty: boolean, editor: Editor) {
  const id = useId();
  const { register } = useEditingWorkspace();
  useEffect(() => {
    if (dirty) return register(id, editor);
  }, [dirty, editor, id, register]);
}

const navigateTo = (url: string) => window.location.assign(url);

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
  const editors = useRef(new Map<string, Editor>());
  const [question, setQuestion] = useState<Question | null>(null);
  const [leaving, setLeaving] = useState<(() => void) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
  const register = useCallback((id: string, editor: Editor) => {
    allowed.current = false;
    editors.current.set(id, editor);
    syncLabels();
    return () => {
      editors.current.delete(id);
      syncLabels();
    };
  }, [syncLabels]);
  const saveAll = useCallback(async () => {
    setSaving(true);
    setSaveError("");
    try {
      for (const editor of Array.from(editors.current.values()))
        if (!(await editor.save())) {
          setSaveError(
            "Some changes could not be saved. Your drafts are still here.",
          );
          return false;
        }
      return true;
    } catch {
      setSaveError("Could not save all changes. Your drafts are still here.");
      return false;
    } finally {
      setSaving(false);
    }
  }, []);
  const requestExit = useCallback((action: () => void) => {
    if (!editors.current.size) {
      action();
      return;
    }
    setError("");
    setLeaving(() => action);
  }, []);
  const context = useMemo(
    () => ({ register, confirm, requestExit }),
    [register, confirm, requestExit],
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
  const pending = useMemo(
    () => ({ labels, saveAll, discardAll, saving, error: saveError }),
    [labels, saveAll, discardAll, saving, saveError],
  );
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
      setError("");
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
      setError("");
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
        inert={question || leaving ? true : undefined}
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
                "You have unsaved photo or collection changes. Save all before leaving, keep editing, or leave without saving."}
            </p>
            {error && <p role="alert">{error}</p>}
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
                    setError("");
                    try {
                      for (const editor of Array.from(
                        editors.current.values(),
                      )) {
                        if (!(await editor.save())) {
                          setError(
                            "Some changes could not be saved. Your drafts are still here. Cancel to review the affected editor.",
                          );
                          return;
                        }
                      }
                      leave();
                    } catch {
                      setError(
                        "Could not save all changes. Your drafts are still here.",
                      );
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
      </PendingContext.Provider>
    </Context.Provider>
  );
}
