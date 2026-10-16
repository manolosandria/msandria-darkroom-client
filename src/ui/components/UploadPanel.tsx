"use client";

import Image from "next/image";
import { RateLimitError } from "@/src/domain/errors/RateLimitError";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { UploadPhoto } from "@/src/application/use-cases/UploadPhoto";
import { PhotoHighlights } from "@/src/domain/entities/PhotoHighlights";
import { PublishedPhoto } from "@/src/domain/repositories/PhotoRepository";
import { uploadPhoto as defaultUploadPhoto } from "@/src/infrastructure/photoServices";
import { apiFailureMessage } from "@/src/ui/apiFailureMessage";
import { ErrorMessage } from "./ErrorMessage";
import { HighlightEditor } from "./HighlightEditor";
import { OptimizationIssueList } from "./OptimizationIssueList";
import { useSessionValue } from "./SessionProvider";

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
];
const MAX_BYTES = 10 * 1024 * 1024;
type UploadItem = {
  id: number;
  file: File;
  preview: string;
  title: string;
  description: string;
  highlights: PhotoHighlights;
  width?: number;
  height?: number;
  status: "draft" | "queued" | "uploading" | "published" | "failed";
  error?: string;
  published?: PublishedPhoto;
};

export default function UploadPanel({
  uploadPhoto = defaultUploadPhoto,
}: {
  uploadPhoto?: Pick<UploadPhoto, "execute">;
}) {
  const session = useSessionValue();
  const [publisher] = useState(() => uploadPhoto);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [selectionError, setSelectionError] = useState("");
  const active = useRef(false);
  const mounted = useRef(true);
  const urls = useRef(new Set<string>());
  const nextId = useRef(0);
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mounted.current = true;
    const allocated = urls.current;
    return () => {
      mounted.current = false;
      allocated.forEach((url) => URL.revokeObjectURL(url));
      allocated.clear();
    };
  }, []);

  const patch = (id: number, fields: Partial<UploadItem>) => {
    if (mounted.current)
      setItems((previous) =>
        previous.map((item) =>
          item.id === id ? { ...item, ...fields } : item,
        ),
      );
  };
  const addFiles = (files: FileList | File[]) => {
    const errors: string[] = [];
    const additions: UploadItem[] = [];
    Array.from(files).forEach((file) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: choose a JPEG, PNG, WebP, AVIF or GIF.`);
        return;
      }
      if (file.size > MAX_BYTES) {
        errors.push(`${file.name}: exceeds the 10 MB limit.`);
        return;
      }
      const preview = URL.createObjectURL(file);
      urls.current.add(preview);
      additions.push({
        id: nextId.current++,
        file,
        preview,
        title: file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "),
        description: "",
        highlights: {},
        status: "draft",
      });
    });
    setSelectionError(errors.join(" "));
    setItems((previous) => [...previous, ...additions]);
  };
  const remove = (item: UploadItem) => {
    URL.revokeObjectURL(item.preview);
    urls.current.delete(item.preview);
    setItems((previous) => previous.filter((entry) => entry.id !== item.id));
  };
  const publish = async () => {
    if (active.current) return;
    const batch = items.filter(
      (item) => item.status === "draft" || item.status === "failed",
    );
    if (!batch.length) return;
    if (batch.some((item) => !item.title.trim())) {
      setSelectionError("Give every photo a title before publishing.");
      return;
    }
    active.current = true;
    setRunning(true);
    setSelectionError("");
    setItems((previous) =>
      previous.map((item) =>
        batch.some((entry) => entry.id === item.id)
          ? { ...item, status: "queued", error: undefined }
          : item,
      ),
    );
    try {
      for (const item of batch) {
        if (!mounted.current) break;
        patch(item.id, { status: "uploading" });
        try {
          const published = await publisher.execute({
            file: item.file,
            title: item.title.trim(),
            description: item.description.trim() || undefined,
            highlights: item.highlights,
          });
          patch(item.id, { status: "published", published });
        } catch (failure) {
          patch(item.id, { status: "failed", error: apiFailureMessage(failure) });
          if (failure instanceof RateLimitError) {
            setItems((previous) => previous.map((entry) =>
              entry.status === "queued" ? { ...entry, status: "draft" } : entry,
            ));
            setSelectionError("Publishing paused. Wait before retrying; your remaining photos and edits are kept.");
            break;
          }
        }
      }
    } finally {
      active.current = false;
      if (mounted.current) setRunning(false);
    }
  };

  if (session.loading) return <Shell aria-busy="true" />;
  if (session.error)
    return (
      <Shell>
        <ErrorMessage message={session.error} onRetry={session.reload} />
      </Shell>
    );
  if (!session.user)
    return (
      <Shell>
        <p>Sign in with the button in the header to publish a photo.</p>
      </Shell>
    );
  if (!session.user.isAdmin())
    return (
      <Shell>
        <p>Only the gallery&apos;s administrator can publish photos.</p>
        <Link href="/gallery">Back to the gallery</Link>
      </Shell>
    );

  const pending = items.filter(
    (item) => item.status === "draft" || item.status === "failed",
  ).length;
  const completed = items.filter((item) => item.status === "published").length;
  return (
    <Shell>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Link href="/manage" className="upload-link">
          Manage published photos →
        </Link>
        <Link href="/moderate" className="upload-link">
          Review comments →
        </Link>
          <Link href="/collections" className="upload-link">Manage collections →</Link>
      </div>
      <div
        className={`upload-dropzone ${dragging ? "is-dragging" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node))
            setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          addFiles(event.dataTransfer.files);
        }}
      >
        <input
          ref={picker}
          id="photos"
          type="file"
          multiple
          accept={ACCEPTED_TYPES.join(",")}
          aria-label="Photos"
          className="sr-only"
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          className="upload-drop-target"
          onClick={() => picker.current?.click()}
        >
          <span className="upload-drop-icon" aria-hidden="true">
            ↑
          </span>
          <strong>Drop your photos here</strong>
          <span>
            or <span className="upload-browse">browse files</span>
          </span>
          <small>JPEG, PNG, WebP, AVIF & GIF · Up to 10 MB each</small>
        </button>
      </div>
      <p className="upload-muted">
        Prepare each photo below, then publish. Photos upload one at a time.
        Keep this page open until the queue finishes.
      </p>
      {selectionError && (
        <div role="alert" className="upload-error">
          {selectionError}
        </div>
      )}
      {items.length > 0 && (
        <>
          <div className="upload-toolbar">
            <div>
              <strong>
                {items.length} {items.length === 1 ? "photo" : "photos"}
              </strong>
              <span className="upload-muted" role="status">
                {" "}
                · {completed} published
                {running ? " · Uploading one at a time…" : ""}
              </span>
            </div>
            <button
              type="button"
              className="upload-primary"
              disabled={running || !pending}
              onClick={publish}
            >
              {running
                ? "Publishing…"
                : `Publish ${pending} ${pending === 1 ? "photo" : "photos"}`}
            </button>
          </div>
          <div className="upload-items">
            {items.map((item, index) => (
              <UploadCard
                key={item.id}
                item={item}
                index={index}
                onChange={(fields) => patch(item.id, fields)}
                onRemove={() => remove(item)}
              />
            ))}
          </div>
        </>
      )}
      {!items.length && (
        <div className="upload-empty">
          <span>01 / SELECT</span>
          <span>02 / REFINE & FRAME</span>
          <span>03 / PUBLISH</span>
        </div>
      )}
    </Shell>
  );
}

function UploadCard({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: UploadItem;
  index: number;
  onChange: (fields: Partial<UploadItem>) => void;
  onRemove: () => void;
}) {
  const locked = ["queued", "uploading", "published"].includes(item.status);
  const metadata = item.published?.photo.getMetadata();
  const src = item.published?.photo.urlForWidth(960) ?? item.preview;
  return (
    <article
      className="upload-card"
      aria-label={`Photo ${index + 1}: ${item.file.name}`}
    >
      <header className="upload-card-header">
        <span className="upload-file-index">
          {String(index + 1).padStart(2, "0")}
        </span>
        <strong>{item.file.name}</strong>
        <span className={`upload-status status-${item.status}`} role="status">
          {item.status === "draft" ? "Ready to edit" : item.status}
        </span>
        <button
          type="button"
          className="upload-link"
          disabled={item.status === "queued" || item.status === "uploading"}
          onClick={onRemove}
        >
          {item.status === "published" ? "Dismiss" : "Remove"}
        </button>
      </header>
      <div className="upload-card-body">
        <div className="upload-visual">
          <div className="upload-preview">
            <Image
              src={src}
              alt={item.title || item.file.name}
              fill
              unoptimized
              sizes="(max-width: 800px) 100vw, 45vw"
              style={{ objectFit: "contain" }}
              onLoad={(event) => {
                const image = event.currentTarget;
                if (!item.width)
                  onChange({
                    width: image.naturalWidth,
                    height: image.naturalHeight,
                  });
              }}
              onError={() => {
                if (!item.published)
                  onChange({
                    error:
                      "This image could not be previewed. Check the file before publishing.",
                  });
              }}
            />
          </div>
          <details className="upload-metadata" open>
            <summary>Photo metadata</summary>
            <dl>
              <div>
                <dt>Original size</dt>
                <dd>{(item.file.size / 1024 / 1024).toFixed(2)} MB</dd>
              </div>
              <div>
                <dt>Original format</dt>
                <dd>{item.file.type.replace("image/", "").toUpperCase()}</dd>
              </div>
              {item.width && (
                <div>
                  <dt>Original dimensions</dt>
                  <dd>
                    {item.width} × {item.height} px
                  </dd>
                </div>
              )}
              {item.published && (
                <div>
                  <dt>Published dimensions</dt>
                  <dd>
                    {item.published.photo.getWidth()} ×{" "}
                    {item.published.photo.getHeight()} px
                  </dd>
                </div>
              )}
              {metadata?.format && (
                <div>
                  <dt>Published format</dt>
                  <dd>{metadata.format.toUpperCase()}</dd>
                </div>
              )}
              {metadata && (
                <>
                  <div>
                    <dt>Captured</dt>
                    <dd>
                      {metadata.capturedAt
                        ? new Date(metadata.capturedAt).toLocaleString("en", {
                            timeZone: "America/Mexico_City",
                          })
                        : "Not available"}
                    </dd>
                  </div>
                  <div>
                    <dt>Last edited</dt>
                    <dd>
                      {metadata.lastEditDate
                        ? new Date(metadata.lastEditDate).toLocaleString("en", {
                            timeZone: "America/Mexico_City",
                          })
                        : "Not available"}
                    </dd>
                  </div>
                  <div>
                    <dt>Origin</dt>
                    <dd>{metadata.origin ?? "Not available"}</dd>
                  </div>
                </>
              )}
            </dl>
          </details>
        </div>
        <div className="upload-fields">
          <label htmlFor={`title-${item.id}`}>
            Title
            <input
              id={`title-${item.id}`}
              value={item.title}
              required
              disabled={locked}
              onChange={(event) => onChange({ title: event.target.value })}
            />
          </label>
          <label htmlFor={`description-${item.id}`}>
            Description <span className="upload-muted">/ optional</span>
            <textarea
              id={`description-${item.id}`}
              rows={3}
              value={item.description}
              disabled={locked}
              placeholder="The story behind this photograph…"
              onChange={(event) =>
                onChange({ description: event.target.value })
              }
            />
          </label>
          {item.width && item.height && (
            <HighlightEditor
              src={src}
              width={item.width}
              height={item.height}
              value={item.highlights}
              disabled={locked}
              onChange={(highlights) => onChange({ highlights })}
            />
          )}
          <section className="upload-optimization">
            <h3>Optimization review</h3>
            {item.published ? (
              <OptimizationIssueList
                issues={item.published.optimizationIssues}
              />
            ) : (
              <p className="upload-muted">
                The server reviews metadata, size and color when this photo is
                published. It removes GPS and optimizes the stored image
                automatically.
              </p>
            )}
          </section>
          {item.error && (
            <p role="alert" className="upload-error">
              {item.error}
            </p>
          )}
          {item.status === "failed" && (
            <p className="upload-muted">
              Your edits are kept. Publish again to retry this photo.
            </p>
          )}
          {item.published && (
            <Link className="upload-link" href="/gallery">
              Published: {item.published.photo.getTitle()} ↗
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function Shell({
  children,
  ...rest
}: { children?: React.ReactNode } & React.HTMLAttributes<HTMLElement>) {
  return (
    <main className="upload-workspace" {...rest}>
      <div className="upload-container">
        <div className="upload-heading">
          <span className="upload-eyebrow">THE DARKROOM / PUBLISH</span>
          <h1>A place for your next photographs.</h1>
          <p>Select, refine, and give every photograph its own frame.</p>
        </div>
        {children}
      </div>
    </main>
  );
}
