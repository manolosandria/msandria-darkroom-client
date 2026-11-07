"use client";
import { useEffect, useRef, useState } from "react";
import { Photo, PhotoClassification } from "@/src/domain/entities/Photo";
import { PhotoHighlights } from "@/src/domain/entities/PhotoHighlights";
import { RateLimitError } from "@/src/domain/errors/RateLimitError";
import { uploadPhoto } from "@/src/infrastructure/photoServices";
import { apiFailureMessage } from "@/src/ui/apiFailureMessage";
import { HighlightEditor } from "./HighlightEditor";
import { BorderTrimFields } from "./BorderTrimFields";
import {
  BorderTrim,
  remapHighlights,
  trimmedSize,
} from "@/src/domain/borderTrim";
import { useTrimmedPreview } from "@/src/ui/hooks/useTrimmedPreview";
import { PhotoClassificationFields } from "./PhotoClassificationFields";

export const VARIANT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;
// Files sent at the same time. The API allows 30 uploads a minute per account.
const CONCURRENCY = 3;

export type VariantUpload = {
  id: number;
  file: File;
  preview: string;
  title: string;
  description: string;
  classification: PhotoClassification;
  highlights: PhotoHighlights;
  /** A border baked into the file, removed by the API. Highlights are drawn inside it. */
  trim: BorderTrim | null;
  width?: number;
  height?: number;
  status: "draft" | "queued" | "uploading" | "done" | "failed" | "cancelled";
  error?: string;
};

const fileTitle = (file: File) =>
  file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Variant";

const sendable = (item: VariantUpload) =>
  item.status === "draft" ||
  item.status === "failed" ||
  item.status === "cancelled";

/**
 * Files waiting to become variants, each with its own title, description,
 * classification and highlights. Up to three upload at once; each can be cancelled
 * while it waits or travels, and a cancelled or failed one keeps its edits.
 */
export function useVariantUploads(onUploaded: (photo: Photo) => void) {
  const [items, setItems] = useState<VariantUpload[]>([]);
  const [notice, setNotice] = useState("");
  const current = useRef(items);
  const waiting = useRef<number[]>([]);
  const controllers = useRef(new Map<number, AbortController>());
  const nextId = useRef(0);
  const uploaded = useRef(onUploaded);
  useEffect(() => {
    current.current = items;
    uploaded.current = onUploaded;
  });
  useEffect(() => {
    const travelling = controllers.current;
    return () => {
      travelling.forEach((controller) => controller.abort());
      current.current.forEach((item) => URL.revokeObjectURL(item.preview));
    };
  }, []);

  const patch = (id: number, fields: Partial<VariantUpload>) =>
    setItems((previous) =>
      previous.map((item) => (item.id === id ? { ...item, ...fields } : item)),
    );

  function pump() {
    while (controllers.current.size < CONCURRENCY && waiting.current.length) {
      const id = waiting.current.shift()!;
      const item = current.current.find((entry) => entry.id === id);
      if (!item) continue;
      const controller = new AbortController();
      controllers.current.set(id, controller);
      patch(id, { status: "uploading", error: undefined });
      void uploadPhoto
        .execute(
          {
            file: item.file,
            title: item.title.trim(),
            description: item.description.trim() || undefined,
            highlights: item.highlights,
            ...(item.trim ? { trim: item.trim } : {}),
            ...item.classification,
          },
          controller.signal,
        )
        .then(
          (published) => {
            patch(id, { status: "done" });
            uploaded.current(published.photo);
            window.dispatchEvent(new Event("curator:catalog-changed"));
          },
          (failure) => {
            if (controller.signal.aborted) {
              patch(id, { status: "cancelled" });
              // A file the API had already finished is published all the same.
              window.dispatchEvent(new Event("curator:catalog-changed"));
              return;
            }
            patch(id, { status: "failed", error: apiFailureMessage(failure) });
            if (failure instanceof RateLimitError) {
              const paused = waiting.current;
              waiting.current = [];
              setItems((previous) =>
                previous.map((entry) =>
                  paused.includes(entry.id)
                    ? { ...entry, status: "draft" }
                    : entry,
                ),
              );
              setNotice(
                "Uploads paused by the rate limit. Wait a moment, then upload again; your edits are kept.",
              );
            }
          },
        )
        .finally(() => {
          controllers.current.delete(id);
          pump();
        });
    }
  }

  return {
    items,
    notice,
    running: items.some(
      (item) => item.status === "queued" || item.status === "uploading",
    ),
    /** Turns files into drafts; returns why any were refused. */
    add(files: File[], defaults: Pick<VariantUpload, "title" | "classification">) {
      const refused: string[] = [];
      const additions: VariantUpload[] = [];
      for (const file of files) {
        if (!VARIANT_IMAGE_TYPES.includes(file.type)) {
          refused.push(file.name);
          continue;
        }
        if (file.size > MAX_BYTES) {
          refused.push(`${file.name} (over 10 MB)`);
          continue;
        }
        additions.push({
          id: nextId.current++,
          file,
          preview: URL.createObjectURL(file),
          title: defaults.title.trim() || fileTitle(file),
          description: "",
          classification: { ...defaults.classification },
          highlights: {},
          trim: null,
          status: "draft",
        });
      }
      if (additions.length) setItems((previous) => [...previous, ...additions]);
      setNotice("");
      return { added: additions.length, refused };
    },
    patch,
    remove(id: number) {
      const item = items.find((entry) => entry.id === id);
      if (!item || item.status === "uploading" || item.status === "queued")
        return;
      URL.revokeObjectURL(item.preview);
      setItems((previous) => previous.filter((entry) => entry.id !== id));
    },
    /** Sends the drafts (or only `id`); false when one still lacks a title. */
    start(id?: number) {
      const batch = current.current.filter(
        (item) => sendable(item) && (id === undefined || item.id === id),
      );
      if (!batch.length) return true;
      if (batch.some((item) => !item.title.trim())) {
        setNotice("Give every file a title before uploading.");
        return false;
      }
      setNotice("");
      const ids = batch.map((item) => item.id);
      waiting.current.push(...ids);
      setItems((previous) =>
        previous.map((item) =>
          ids.includes(item.id)
            ? { ...item, status: "queued", error: undefined }
            : item,
        ),
      );
      pump();
      return true;
    },
    cancel(id: number) {
      if (waiting.current.includes(id)) {
        waiting.current = waiting.current.filter((entry) => entry !== id);
        patch(id, { status: "draft" });
      } else controllers.current.get(id)?.abort();
    },
    cancelAll() {
      const queued = waiting.current;
      waiting.current = [];
      setItems((previous) =>
        previous.map((item) =>
          queued.includes(item.id) ? { ...item, status: "draft" } : item,
        ),
      );
      controllers.current.forEach((controller) => controller.abort());
    },
    clearDone() {
      setItems((previous) =>
        previous.filter((item) => {
          if (item.status !== "done") return true;
          URL.revokeObjectURL(item.preview);
          return false;
        }),
      );
    },
  };
}

const VISIBILITY: Record<PhotoClassification["visibility"], string> = {
  PUBLIC: "Public",
  COLLECTIONS_ONLY: "Collections only",
  POSTS_ONLY: "Posts only",
  PRIVATE: "Private",
  SELECT: "Select",
};

const STATUS: Record<VariantUpload["status"], string> = {
  draft: "Ready",
  queued: "Waiting",
  uploading: "Uploading…",
  done: "Uploaded",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** The files waiting to join the work, one card each, with the queue's controls. */
export function VariantUploadQueue({
  uploads,
  workVisibility,
}: {
  uploads: ReturnType<typeof useVariantUploads>;
  workVisibility: PhotoClassification["visibility"];
}) {
  const { items, running } = uploads;
  if (!items.length && !uploads.notice) return null;
  const ready = items.filter(sendable).length;
  const done = items.filter((item) => item.status === "done").length;
  return (
    <section className="variant-uploads" aria-label="Files to upload">
      <header className="variant-uploads__header">
        <div>
          <h4>Files to upload</h4>
          <p role="status">
            {items.length} {items.length === 1 ? "file" : "files"}
            {done ? ` · ${done} uploaded` : ""}
            {running ? " · up to three at a time" : ""}
          </p>
        </div>
        <div className="variant-uploads__tools">
          {done > 0 && !running && (
            <button
              type="button"
              className="variant-uploads__ghost"
              onClick={uploads.clearDone}
            >
              Clear uploaded
            </button>
          )}
          {running && (
            <button
              type="button"
              className="variant-uploads__cancel"
              onClick={uploads.cancelAll}
            >
              Cancel all
            </button>
          )}
          <button
            type="button"
            className="variant-uploads__send"
            disabled={!ready}
            onClick={() => uploads.start()}
          >
            Upload all ({ready})
          </button>
        </div>
      </header>
      {uploads.notice && (
        <p role="alert" className="variant-uploads__notice">
          {uploads.notice}
        </p>
      )}
      <ul className="variant-uploads__list">
        {items.map((item) => (
          <VariantUploadCard
            key={item.id}
            item={item}
            workVisibility={workVisibility}
            onChange={(fields) => uploads.patch(item.id, fields)}
            onUpload={() => uploads.start(item.id)}
            onCancel={() => uploads.cancel(item.id)}
            onRemove={() => uploads.remove(item.id)}
          />
        ))}
      </ul>
    </section>
  );
}

function VariantUploadCard({
  item,
  workVisibility,
  onChange,
  onUpload,
  onCancel,
  onRemove,
}: {
  item: VariantUpload;
  workVisibility: PhotoClassification["visibility"];
  onChange: (fields: Partial<VariantUpload>) => void;
  onUpload: () => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const busy = item.status === "queued" || item.status === "uploading";
  const locked = busy || item.status === "done";
  const trimmed = useTrimmedPreview(item.preview, item.trim);
  const kept =
    item.width && item.height
      ? trimmedSize(item.trim, item.width, item.height)
      : undefined;
  return (
    <li
      className="variant-upload"
      data-status={item.status}
      aria-label={`${item.file.name}: ${STATUS[item.status]}`}
    >
      <div className="variant-upload__preview">
        {/* eslint-disable-next-line @next/next/no-img-element -- A local object URL, before the API has any rendition. */}
        <img
          src={trimmed}
          alt=""
          onLoad={(event) => {
            const image = event.currentTarget;
            if (!item.width)
              onChange({
                width: image.naturalWidth,
                height: image.naturalHeight,
              });
          }}
        />
        <span className="variant-upload__status">{STATUS[item.status]}</span>
        {busy && <span className="variant-upload__progress" aria-hidden="true" />}
      </div>
      <fieldset className="variant-upload__fields" disabled={locked}>
        <label>
          Title
          <input
            required
            maxLength={160}
            value={item.title}
            aria-label={`Title of ${item.file.name}`}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </label>
        <label>
          <span>
            Description <span className="variant-upload__muted">optional</span>
          </span>
          <textarea
            rows={2}
            value={item.description}
            aria-label={`Description of ${item.file.name}`}
            placeholder="The story behind this variant…"
            onChange={(event) => onChange({ description: event.target.value })}
          />
        </label>
        <details className="variant-upload__more">
          <summary>
            Visibility, categories and collections
            <small>
              {VISIBILITY[item.classification.visibility]}
              {item.classification.categoryNames.length
                ? ` · ${item.classification.categoryNames.length} categories`
                : ""}
            </small>
          </summary>
          {item.classification.visibility !== workVisibility && (
            <p className="variant-upload__muted">
              The work&apos;s main photo is{" "}
              {VISIBILITY[workVisibility].toLowerCase()}; this file will be{" "}
              {VISIBILITY[item.classification.visibility].toLowerCase()}.
            </p>
          )}
          <PhotoClassificationFields
            value={item.classification}
            disabled={locked}
            onChange={(classification) => onChange({ classification })}
          />
        </details>
        {item.width && item.height ? (
          <details className="variant-upload__more">
            <summary>
              Border
              <small>{item.trim ? "Removed" : "Kept"}</small>
            </summary>
            <BorderTrimFields
              src={item.preview}
              width={item.width}
              height={item.height}
              value={item.trim}
              disabled={locked}
              onChange={(trim) =>
                onChange({
                  trim,
                  highlights: remapHighlights(item.highlights, item.trim, trim),
                })
              }
            />
          </details>
        ) : null}
        {kept ? (
          <details className="variant-upload__more">
            <summary>
              Highlights
              <small>
                {
                  [
                    item.highlights.square,
                    item.highlights.landscape,
                    item.highlights.portrait,
                    ...(item.highlights.custom ?? []),
                  ].filter(Boolean).length
                }{" "}
                chosen
              </small>
            </summary>
            <HighlightEditor
              src={trimmed}
              width={kept.width}
              height={kept.height}
              value={item.highlights}
              disabled={locked}
              onChange={(highlights) => onChange({ highlights })}
            />
          </details>
        ) : null}
      </fieldset>
      {item.error && (
        <p role="alert" className="variant-upload__error">
          {item.error}
        </p>
      )}
      {item.status === "cancelled" && (
        <p className="variant-upload__muted">
          Stopped. If the server had already received the whole file, it shows
          up in the library anyway.
        </p>
      )}
      <div className="variant-upload__actions">
        {busy ? (
          <button
            type="button"
            className="variant-uploads__cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
        ) : item.status === "done" ? (
          <button
            type="button"
            className="variant-uploads__ghost"
            onClick={onRemove}
          >
            Dismiss
          </button>
        ) : (
          <>
            <button
              type="button"
              className="variant-uploads__ghost"
              onClick={onRemove}
            >
              Remove
            </button>
            <button
              type="button"
              className="variant-uploads__send"
              onClick={onUpload}
            >
              {item.status === "draft" ? "Upload" : "Try again"}
            </button>
          </>
        )}
      </div>
    </li>
  );
}
