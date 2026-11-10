"use client";
import { useEffect, useRef, useState } from "react";
import {
  useEditingWorkspace,
  useUnsavedEditor,
} from "@/src/ui/components/EditingWorkspace";

type Prompt = readonly [title: string, message: string];

export type SettingsDocumentOptions<T, D> = {
  /** What is edited before the first answer arrives. */
  initial: D;
  /** Reads the saved document from the API. */
  read: () => Promise<T>;
  /** Saves the draft; the API answers with the document as saved, new version included. */
  write: (draft: D, saved: T) => Promise<T>;
  /** The part of the saved document the editor changes; the whole of it by default. */
  toDraft?: (saved: T) => D;
  /** How the draft is reviewed and undone, when it reads better in another shape. */
  reviewAs?: { wrap: (draft: D) => unknown; unwrap: (value: unknown) => D };
  /** The editor's name in the save bar and the review. */
  label: string;
  /** Said once a save goes through. */
  savedNotice: string;
  /** Told about every save, as soon as it goes through. */
  onSaved?: (saved: T) => void;
  /** Asked before Cancel throws the draft away. */
  cancelPrompt: Prompt;
  /** Asked before Reload state throws a draft with changes away. */
  reloadPrompt: Prompt;
};

const same = <T>(value: T) => value as unknown;

/**
 * One settings document edited in Curator (Home, Gallery, Palettes, General): it is
 * read once, edited as a draft, saved with the version it was read with (the API
 * refuses a stale one with 409, and the draft stays) and registered with the save bar
 * while it has changes. A save in flight blocks another.
 *
 * Its collaborators are read when used, so an editor may pass fresh closures on every
 * render; the document is read once, on mount.
 */
export function useSettingsDocument<T, D = T>(
  options: SettingsDocumentOptions<T, D>,
) {
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  const toDraft = (value: T) =>
    (latest.current.toDraft ?? (same as (value: T) => D))(value);
  const [saved, setSaved] = useState<T | null>(null);
  const [draft, setDraft] = useState<D>(options.initial);
  // Busy from the start: the first read begins as soon as the editor mounts.
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const { confirm } = useEditingWorkspace();
  const original = saved === null ? null : toDraft(saved);
  const dirty =
    original !== null && JSON.stringify(original) !== JSON.stringify(draft);

  async function load() {
    setBusy(true);
    setError("");
    try {
      const value = await latest.current.read();
      setSaved(value);
      setDraft(toDraft(value));
      setNotice("");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
    // Only once: afterwards the draft is the curator's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (lock.current || saved === null) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await latest.current.write(draft, saved);
      setSaved(result);
      setDraft(toDraft(result));
      setNotice(latest.current.savedNotice);
      latest.current.onSaved?.(result);
      return true;
    } catch (failure) {
      setError((failure as Error).message);
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  /** Changes the draft and clears the last notice, which no longer describes it. */
  function edit(update: (previous: D) => D) {
    setDraft(update);
    setNotice("");
  }

  async function cancel() {
    if (original === null) return;
    if (await confirm(...latest.current.cancelPrompt)) {
      setDraft(original);
      setNotice("");
    }
  }

  async function reload() {
    if (!dirty || (await confirm(...latest.current.reloadPrompt))) await load();
  }

  const reviewAs = options.reviewAs;
  const { review } = useUnsavedEditor(dirty, {
    label: options.label,
    save,
    discard: () => {
      if (original !== null) setDraft(original);
    },
    document:
      original !== null
        ? {
            original: reviewAs ? reviewAs.wrap(original) : original,
            draft: reviewAs ? reviewAs.wrap(draft) : draft,
            restore: (value) =>
              setDraft(reviewAs ? reviewAs.unwrap(value) : (value as D)),
          }
        : undefined,
  });

  return {
    saved,
    setSaved,
    draft,
    setDraft,
    edit,
    busy,
    error,
    notice,
    setNotice,
    dirty,
    load,
    save,
    cancel,
    reload,
    review,
  };
}
