"use client";
import { titleFromFile, UPLOAD_IMAGE_TYPES, uploadRefusal } from "@/src/ui/uploadFiles";

import Image from "next/image";
import { ClassificationCatalogBoundary } from "./ClassificationCatalog";
import { RateLimitError } from "@/src/domain/errors/RateLimitError";
import { VariantAssignment } from "./VariantAssignment";
import { assignPhotoVariant } from "@/src/application/use-cases/AssignPhotoVariant";
import { manageCatalog } from "@/src/infrastructure/catalogServices";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMediaQuery } from "@/src/ui/hooks/useMediaQuery";
import { UploadPhoto } from "@/src/application/use-cases/UploadPhoto";
import { PhotoHighlights } from "@/src/domain/entities/PhotoHighlights";
import { PublishedPhoto } from "@/src/domain/repositories/PhotoRepository";
import { uploadPhoto as defaultUploadPhoto } from "@/src/infrastructure/photoServices";
import { apiFailureMessage } from "@/src/ui/apiFailureMessage";
import { UploadReview } from "./UploadReview";
import { framedLayout } from "@/src/ui/framedLayout";
import "./uploadPreparation.css";
import { ErrorMessage } from "./ErrorMessage";
import { HighlightEditor } from "./HighlightEditor";
import { FrameFields } from "./FrameFields";
import { BorderTrimFields } from "./BorderTrimFields";
import {
  BorderTrim,
  remapHighlights,
  trimmedSize,
} from "@/src/domain/borderTrim";
import { useTrimmedPreview } from "@/src/ui/hooks/useTrimmedPreview";
import { PhotoFrame } from "@/src/domain/entities/PhotoFrame";
import { OptimizationIssueList } from "./OptimizationIssueList";
import { useSessionValue } from "./SessionProvider";
import {
  PhotoClassification,
  PhotoClassificationFields,
  publicClassification,
} from "./PhotoClassificationFields";

export type UploadItem = {
  variantTargetId?: string;
  classification: PhotoClassification;
  id: number;
  file: File;
  preview: string;
  title: string;
  description: string;
  highlights: PhotoHighlights;
  frame: PhotoFrame | null;
  /** A border baked into the file, removed by the API. Highlights are drawn inside it. */
  trim: BorderTrim | null;
  width?: number;
  height?: number;
  status: "draft" | "queued" | "uploading" | "published" | "failed";
  error?: string;
  published?: PublishedPhoto;
};

export default function UploadPanel({
  uploadPhoto = defaultUploadPhoto,
  embedded = false,
  onPublished,
  onPendingChange,
}: {
  embedded?: boolean;
  onPublished?: (photo: PublishedPhoto) => void;
  onPendingChange?: (pending: boolean) => void;
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

  useEffect(() => {
    onPendingChange?.(running || items.some((item) => item.status !== "published"));
  }, [items, running, onPendingChange]);

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
      const refusal = uploadRefusal(file);
      if (refusal) {
        errors.push(refusal);
        return;
      }
      const preview = URL.createObjectURL(file);
      urls.current.add(preview);
      additions.push({
        classification: { ...publicClassification(), ...(embedded ? { visibility: "COLLECTIONS_ONLY" as const } : {}) },
        id: nextId.current++,
        file,
        preview,
        title: titleFromFile(file),
        description: "",
        highlights: {},
        frame: null,
        trim: null,
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
  const publish = async (onlyId?: number) => {
    if (active.current) return;
    const batch = items.filter(
      (item) =>
        (item.status === "draft" || item.status === "failed") &&
        (onlyId === undefined || item.id === onlyId),
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
          const published =
            item.published ??
            (await publisher.execute({
              file: item.file,
              title: item.title.trim(),
              description: item.description.trim() || undefined,
              highlights: item.highlights,
              frame: item.frame,
              ...(item.trim ? { trim: item.trim } : {}),
              ...item.classification,
            }));
          if (!mounted.current) break;
          // Store the successful upload before linking. A failed link retries only the link.
          patch(item.id, { published });
          if (item.variantTargetId)
            await assignPhotoVariant(
              manageCatalog,
              published.photo.getId(),
              item.variantTargetId,
              item.title,
            );
          patch(item.id, { status: "published", published });
          onPublished?.(published);
          window.dispatchEvent(new Event("curator:catalog-changed"));
        } catch (failure) {
          patch(item.id, {
            status: "failed",
            error: apiFailureMessage(failure),
          });
          if (failure instanceof RateLimitError) {
            setItems((previous) =>
              previous.map((entry) =>
                entry.status === "queued"
                  ? { ...entry, status: "draft" }
                  : entry,
              ),
            );
            setSelectionError(
              "Publishing paused. Wait before retrying; your remaining photos and edits are kept.",
            );
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
  // Offered above and below the cards, so a long batch can be sent from either end.
  const uploadAll = (modifier = "") => (
    <div className={`upload-toolbar ${modifier}`.trim()}>
      <button
        type="button"
        className="upload-primary"
        disabled={running || !pending}
        onClick={() => publish()}
      >
        {running ? "Uploading…" : `Upload All (${pending})`}
      </button>
    </div>
  );
  return (
    <Shell embedded={embedded}>
      {items.length > 0 && uploadAll()}
      {!embedded && <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Link href="/manage" className="upload-link">
          Manage published photos →
        </Link>
        <Link href="/moderate" className="upload-link">
          Review comments →
        </Link>
        <Link href="/curator" className="upload-link">
          Manage collections →
        </Link>
      </div>}
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
          type="file"
          multiple
          accept={UPLOAD_IMAGE_TYPES.join(",")}
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
          </div>
          <div className="upload-items">
            {items.map((item, index) => (
              <UploadCard
                key={item.id}
                item={item}
                index={index}
                onChange={(fields) => patch(item.id, fields)}
                onRemove={() => remove(item)}
                onUpload={() => publish(item.id)}
                running={running}
              />
            ))}
          </div>
          {uploadAll("upload-toolbar--bottom")}
        </>
      )}
      {!items.length && (
        <ol className="upload-steps" aria-label="How publishing works">
          <li aria-current="step">
            <span className="upload-steps__number">1</span>
            <strong>Select</strong>
            <small>Drop or browse your photographs.</small>
          </li>
          <li>
            <span className="upload-steps__number">2</span>
            <strong>Refine &amp; frame</strong>
            <small>Title, crops, frame and where it appears.</small>
          </li>
          <li>
            <span className="upload-steps__number">3</span>
            <strong>Publish</strong>
            <small>One at a time, with an optimization report.</small>
          </li>
        </ol>
      )}
    </Shell>
  );
}

// Wide enough for Posts' publishing column beside the story (postStudio.css).
const SIDE_PREVIEW = "(min-width: 1280px)";

export function UploadCard({
  item,
  index,
  onChange,
  onRemove,
  onUpload,
  running,
  forPost = false,
  previewSlot,
  onActivate,
}: {
  item: UploadItem;
  index: number;
  onChange: (fields: Partial<UploadItem>) => void;
  onRemove: () => void;
  onUpload: () => void;
  running: boolean;
  /** A post's photo: title, words and destination first, the rest under More options. */
  forPost?: boolean;
  /** Where the photograph shows instead, beside the card, on screens wide enough. */
  previewSlot?: HTMLElement | null;
  /** The curator is working on this card: pointing into it or focusing it. */
  onActivate?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [stageContainer, setStageContainer] = useState<HTMLDivElement | null>(null);
  const inspector = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (inspector.current) inspector.current.scrollTop = 0;
  }, [step]);
  const prefix = useId();
  // A post's photo needs its title and destination; frame, border and highlights wait
  // under More options, and there is no review: the photograph is the review.
  const [more, setMore] = useState(false);
  const steps = forPost
    ? ["Details", "Appearance", "Highlights"]
    : ["Details", "Appearance", "Highlights", "Organization", "Review"];
  const showSteps = !forPost || more;
  const sideBySide = useMediaQuery(SIDE_PREVIEW);
  const panel = (index: number) => ({
    role: "tabpanel" as const,
    id: `${prefix}-panel-${index}`,
    "aria-labelledby": `${prefix}-tab-${index}`,
    hidden: step !== index,
    className: "upload-step-panel",
  });
  const locked = !!item.published || ["queued", "uploading", "published"].includes(item.status);
  const metadata = item.published?.photo.getMetadata();
  const trimmed = useTrimmedPreview(item.preview, item.trim);
  const src = item.published?.photo.urlForWidth(640) ?? trimmed;
  // The frame and highlight editors work on what the trim keeps.
  const kept =
    item.width && item.height
      ? trimmedSize(item.trim, item.width, item.height)
      : undefined;
  const layout = framedLayout(kept ? kept.width / kept.height : 1.5, item.frame);
  // Drawing highlights wants the card's width, and an expanded photo its own row.
  const aside = Boolean(previewSlot) && sideBySide && !expanded && step !== 2;
  const destination = (
    <fieldset className="post-studio__status post-studio__destination" disabled={locked}>
      <legend>Uploaded photo goes to</legend>
      {(["POSTS_ONLY", "PUBLIC"] as const).map((visibility) => (
        <label key={visibility}>
          <input
            type="radio"
            name={`${prefix}-destination`}
            aria-label={visibility === "POSTS_ONLY" ? "Only in posts" : "To the gallery too"}
            checked={item.classification.visibility === visibility}
            onChange={() =>
              onChange({
                classification: { ...item.classification, visibility },
              })
            }
          />
          <span>
            <strong>{visibility === "POSTS_ONLY" ? "Only in posts" : "To the gallery too"}</strong>
            <small>{visibility === "POSTS_ONLY" ? "Not shown in Gallery" : "Public in Gallery as well"}</small>
          </span>
        </label>
      ))}
    </fieldset>
  );
  const visual = (
    <div className="upload-visual">
      <div className="upload-preview-toolbar">
        <span>{step === 2 ? "Draw on your photograph" : "Photo preview"}</span>
        <button type="button" className="upload-preview-expand" aria-pressed={expanded} hidden={aside} onClick={() => setExpanded(!expanded)}>
          <span aria-hidden="true">{expanded ? "↙" : "↗"}</span> {expanded ? "Compact view" : "Expand photo"}
        </button>
      </div>
      <div className="upload-photo-surface" style={{ "--preview-ratio": 1 / layout.heightPerWidth } as React.CSSProperties}>
        <div
          ref={setStageContainer}
          className="upload-shared-stage"
          hidden={step !== 2 || !kept}
          style={{ "--photo-ratio": kept ? kept.width / kept.height : 1 } as React.CSSProperties}
        />
        {/* A click on the photograph expands it, as the button does; the button stays for the keyboard. */}
        <div className="upload-preview" hidden={step === 2 && !!kept} data-zoom={aside ? undefined : expanded ? "out" : "in"} onClick={() => !aside && setExpanded(!expanded)}>
          <div
            className="upload-photo-mat"
            data-testid="upload-frame-preview"
            style={{ width: `min(100%, calc(100cqh / ${layout.heightPerWidth}))` }}
          >
            <div
              className="upload-photo-border"
              style={{ background: item.frame?.color, padding: `${layout.paddingY}% ${layout.paddingX}%` }}
            >
              <div className="upload-photo-image" style={{ aspectRatio: kept ? kept.width / kept.height : 1.5 }}>
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
            </div>
          </div>
        </div>
      </div>
      <details className="upload-metadata">
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
  );
  return (
    <article
      data-expanded={expanded || undefined}
      data-light={forPost || undefined}
      data-aside={aside || undefined}
      onPointerDown={onActivate}
      onFocus={onActivate}
      className="upload-card upload-preparation"
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
      {showSteps && <div className="upload-step-tabs" role="tablist" aria-label="Photo preparation">
        {steps.map((label, index) => (
          <button
            key={label}
            type="button"
            role="tab"
            id={`${prefix}-tab-${index}`}
            aria-controls={`${prefix}-panel-${index}`}
            aria-selected={step === index}
            tabIndex={step === index ? 0 : -1}
            onClick={() => setStep(index)}
            onKeyDown={(event) => {
              const next = event.key === "ArrowRight" ? (index + 1) % steps.length
                : event.key === "ArrowLeft" ? (index + steps.length - 1) % steps.length
                : event.key === "Home" ? 0 : event.key === "End" ? steps.length - 1 : undefined;
              if (next === undefined) return;
              event.preventDefault();
              setStep(next);
              document.getElementById(`${prefix}-tab-${next}`)?.focus();
            }}
          >
            <span>{index + 1}</span> {label}
          </button>
        ))}
      </div>}
      <div className="upload-card-body">
        {aside
          ? previewSlot &&
            createPortal(
              <div className="upload-side-preview">
                <p className="upload-side-preview__name">{item.title || item.file.name}</p>
                {visual}
              </div>,
              previewSlot,
            )
          : visual}
        <div className="upload-fields" ref={inspector}>
          <div {...panel(0)}>
            <label htmlFor={`${prefix}-title`}>
              Title
              <input
                id={`${prefix}-title`}
                value={item.title}
                required
                disabled={locked}
                onChange={(event) => onChange({ title: event.target.value })}
              />
            </label>
            <label htmlFor={`${prefix}-description`}>
              Description <span className="upload-muted">/ optional</span>
              <textarea
                id={`${prefix}-description`}
                rows={3}
                value={item.description}
                disabled={locked}
                placeholder="The story behind this photograph…"
                onChange={(event) =>
                  onChange({ description: event.target.value })
                }
              />
            </label>
            {forPost && destination}
          </div>
          <div {...panel(1)}>
            {item.width && item.height && (
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
            )}
            {kept && (
              <FrameFields
                src={src}
                width={kept.width}
                height={kept.height}
                value={item.frame}
                showPreview={false}
                disabled={locked}
                onChange={(frame) => onChange({ frame })}
              />
            )}
          </div>
          <div {...panel(2)}>
            {kept && (
              <HighlightEditor
                src={src}
                width={kept.width}
                height={kept.height}
                value={item.highlights}
                stageContainer={stageContainer}
                disabled={locked}
                onChange={(highlights) => onChange({ highlights })}
              />
            )}
          </div>
          {!forPost && (
          <div {...panel(3)}>
              <VariantAssignment
                key={item.published?.photo.getId() ?? "draft"}
                photoId={
                  item.status === "published"
                    ? item.published?.photo.getId()
                    : undefined
                }
                title={item.title}
                targetId={item.variantTargetId}
                onTargetChange={
                  item.published
                    ? undefined
                    : (variantTargetId) => onChange({ variantTargetId })
                }
                disabled={locked || !!item.published}
              />
              <PhotoClassificationFields
                value={item.classification}
                disabled={locked}
                onChange={(classification) => onChange({ classification })}
              />
          </div>
          )}
          {!forPost && (
          <div {...panel(4)}>
            <UploadReview item={item} forPost={forPost} onEdit={setStep} />
            <section className="upload-optimization">
              <h3>Optimization review</h3>
              {!item.published && (
                <p className="upload-muted">
                  The server reviews metadata, size and color when this photo is
                  published. It removes GPS and optimizes the stored image
                  automatically.
                </p>
              )}
            </section>
          </div>
          )}
          {item.published && <OptimizationIssueList issues={item.published.optimizationIssues} />}
          {item.error && (
            <p role="alert" className="upload-error">
              {item.error}
            </p>
          )}
          {item.status === "failed" && (
            <p className="upload-muted">
              {item.published
                ? "The file is uploaded. Retry to finish linking its variant; the file will not upload again."
                : "Your edits are kept. Publish again to retry this photo."}
            </p>
          )}
          {item.published && !forPost && (
            <Link className="upload-link" href="/gallery">
              Published: {item.published.photo.getTitle()} ↗
            </Link>
          )}
        </div>
      </div>
      <footer className="upload-card-actions">
        {forPost ? (
          <button
            type="button"
            className="upload-more-toggle"
            aria-expanded={more}
            onClick={() => {
              setMore(!more);
              setStep(0);
            }}
          >
            {more ? "Fewer options" : "More options"}
            <span className="upload-muted"> · border, frame, highlights</span>
          </button>
        ) : (
          <>
            <span className="upload-muted">Step {step + 1} of {steps.length} · Optional settings can be skipped</span>
            <button type="button" className="upload-secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
            {step < steps.length - 1 && (
              <button type="button" className="upload-primary" onClick={() => setStep(step + 1)}>Next</button>
            )}
          </>
        )}
        <button
          type="button"
          className={forPost || step === 4 ? "upload-primary" : "upload-secondary"}
          disabled={running || ["queued", "uploading", "published"].includes(item.status)}
          onClick={onUpload}
        >
          {item.status === "published"
            ? "Uploaded"
            : item.status === "uploading"
              ? "Uploading…"
              : "Upload"}
        </button>
      </footer>
    </article>
  );
}

function Shell({
  embedded = false,
  children,
  ...rest
}: { embedded?: boolean; children?: React.ReactNode } & React.HTMLAttributes<HTMLElement>) {
  const { user } = useSessionValue();
  const Container = embedded ? "section" : "main";
  return (
    <Container className={embedded ? "upload-embedded" : "upload-workspace"} {...rest}>
      <div className="upload-container">
        <div className="upload-heading">
          {embedded ? <h3>Upload photos</h3> : <h1>A place for your next photographs.</h1>}
          <p>Select, refine, and give every photograph its own frame.</p>
        </div>
        <ClassificationCatalogBoundary key={user?.getId() ?? "anonymous"}>{children}</ClassificationCatalogBoundary>
      </div>
    </Container>
  );
}
