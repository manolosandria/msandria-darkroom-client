"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";
import { PublishedPhoto } from "@/src/domain/repositories/PhotoRepository";
import { PhotoOptimizationIssue } from "@/src/domain/entities/PhotoOptimizationIssue";
import { OptimizationIssueList } from "./OptimizationIssueList";
import { Photo } from "@/src/domain/entities/Photo";
import {
  getAllPhotos,
  getPhotoById,
  savePhoto,
  getUnoptimizedPhotos,
  replacePhoto,
} from "@/src/infrastructure/photoServices";
import { usePhotoFetch } from "@/src/ui/hooks/usePhotoFetch";
import { apiFailureMessage } from "@/src/ui/apiFailureMessage";
import { ErrorMessage } from "./ErrorMessage";
import { HighlightEditor } from "./HighlightEditor";
import {
  PHOTO_TITLE_POSITIONS,
  PhotoTitlePosition,
} from "@/src/domain/entities/PhotoTitlePosition";

const TITLE_POSITION_LABELS: Record<PhotoTitlePosition, string> = {
  BOTTOM_LEFT: "Bottom left",
  BOTTOM_RIGHT: "Bottom right",
  TOP_LEFT: "Top left",
  TOP_RIGHT: "Top right",
};
import { useSessionValue } from "./SessionProvider";

export default function ManagePhotos() {
  const session = useSessionValue();
  return (
    <main className="upload-workspace">
      <div className="upload-container">
        <div className="upload-heading">
          <span className="upload-eyebrow">THE DARKROOM / MANAGE</span>
          <h1>Refine your photographs.</h1>
          <p>Edit titles, stories, and the details that fill each thumbnail.</p>
        </div>
        <Link href="/upload" className="upload-link">
          ← Upload photos
        </Link>
        {session.loading ? (
          <p role="status">Loading session…</p>
        ) : session.error ? (
          <ErrorMessage message={session.error} onRetry={session.reload} />
        ) : session.user?.isAdmin() ? (
          <PhotoManager />
        ) : (
          <p>Sign in as the gallery&apos;s administrator to manage photos.</p>
        )}
      </div>
    </main>
  );
}

function PhotoManager() {
  const [pendingOnly, setPendingOnly] = useState(false);
  return (
    <>
      <label className="block my-4">
        <input
          type="checkbox"
          checked={pendingOnly}
          onChange={(event) => setPendingOnly(event.target.checked)}
        />{" "}
        Only photos needing optimization
      </label>
      <PhotoLibrary key={String(pendingOnly)} pendingOnly={pendingOnly} />
    </>
  );
}

function PhotoLibrary({ pendingOnly }: { pendingOnly: boolean }) {
  const loadPhotos = useCallback(
    async () => ({
      entries: pendingOnly
        ? await getUnoptimizedPhotos.execute()
        : ((await getAllPhotos.execute()) ?? []).map((photo) => ({
            photo,
            optimizationIssues: [],
          })),
    }),
    [pendingOnly],
  );
  const { data, loading, error, retry } = usePhotoFetch(
    loadPhotos,
    "No photos published yet.",
  );
  const [selected, setSelected] = useState<Photo | null>(null);
  const [revisions, setRevisions] = useState<Record<string, PublishedPhoto>>(
    {},
  );
  if (loading) return <p role="status">Loading photographs…</p>;
  if (error) return <ErrorMessage message={error} onRetry={retry} />;
  const entries = (data?.entries ?? [])
    .map((entry) => revisions[entry.photo.getId()] ?? entry)
    .filter(
      (entry) =>
        !pendingOnly ||
        entry.optimizationIssues.some((issue) => issue.isPending()),
    );
  const issues = selected
    ? ((
        revisions[selected.getId()] ??
        data?.entries.find((entry) => entry.photo.getId() === selected.getId())
      )?.optimizationIssues ?? [])
    : [];
  return (
    <div className="manage-layout">
      <nav className="manage-library" aria-label="Published photos">
        {entries.length === 0 && (
          <p>
            {pendingOnly
              ? "No photos need optimization."
              : "No photos published yet."}
          </p>
        )}
        {entries.map(({ photo }) => (
          <button
            type="button"
            key={photo.getId()}
            aria-pressed={selected?.getId() === photo.getId()}
            onClick={() => setSelected(photo)}
          >
            <span className="manage-thumbnail">
              <Image
                src={photo.urlForWidth(320)}
                alt=""
                width={photo.getWidth()}
                height={photo.getHeight()}
                unoptimized
                sizes="64px"
                style={thumbnailStyle(photo)}
              />
            </span>
            <span>{photo.getTitle()}</span>
          </button>
        ))}
      </nav>
      {selected ? (
        <PhotoDetailEditor
          key={selected.getId()}
          photo={selected}
          revised={Boolean(revisions[selected.getId()])}
          issues={issues}
          onSaved={(updated, optimizationIssues) => {
            setSelected(updated);
            setRevisions((previous) => ({
              ...previous,
              [updated.getId()]: {
                photo: updated,
                optimizationIssues: optimizationIssues ?? issues,
              },
            }));
          }}
        />
      ) : (
        <p className="upload-muted">
          Select a photograph to edit its details and highlights.
        </p>
      )}
    </div>
  );
}

// A listing item is never used to initialize an editor: it has no description.
function PhotoDetailEditor({
  photo,
  onSaved,
  issues,
  revised,
}: {
  photo: Photo;
  revised: boolean;
  issues: PhotoOptimizationIssue[];
  onSaved: (photo: Photo, issues?: PhotoOptimizationIssue[]) => void;
}) {
  const id = photo.getId();
  const loadDetail = useCallback(() => getPhotoById.execute(id), [id]);
  const { data, loading, error, retry } = usePhotoFetch(
    loadDetail,
    "Photo not found.",
  );
  if (loading) return <p role="status">Loading photograph…</p>;
  if (error) return <ErrorMessage message={error} onRetry={retry} />;
  return data ? (
    <PhotoEditor
      photo={revised ? photo : data}
      issues={issues}
      onSaved={onSaved}
    />
  ) : null;
}

function thumbnailStyle(photo: Photo): React.CSSProperties {
  const crop = photo.getHighlights().square;
  if (!crop)
    return {
      position: "absolute",
      width: "100%",
      height: "100%",
      objectFit: "cover",
    };
  return {
    position: "absolute",
    maxWidth: "none",
    width: `${100 / crop.width}%`,
    height: `${100 / crop.height}%`,
    left: `${(-crop.x / crop.width) * 100}%`,
    top: `${(-crop.y / crop.height) * 100}%`,
    right: "auto",
    bottom: "auto",
  };
}

function PhotoEditor({
  photo,
  onSaved,
  issues,
}: {
  photo: Photo;
  issues: PhotoOptimizationIssue[];
  onSaved: (photo: Photo, issues?: PhotoOptimizationIssue[]) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState(issues);
  const [title, setTitle] = useState(photo.getTitle());
  const [description, setDescription] = useState(photo.getDescription() ?? "");
  const [highlights, setHighlights] = useState(photo.getHighlights());
  const [titlePosition, setTitlePosition] = useState(photo.getTitlePosition());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="upload-card manage-editor"
      onSubmit={async (event) => {
        event.preventDefault();
        if (saving) return;
        if (!title.trim()) {
          setError("Give the photograph a title before saving.");
          return;
        }
        setSaving(true);
        setError("");
        setSaved(false);
        try {
          const updated = new Photo({
            id: photo.getId(),
            title,
            description,
            highlights,
            titlePosition,
            frame: photo.getFrame(),
            width: photo.getWidth(),
            height: photo.getHeight(),
            renditions: photo.getRenditions(),
            metadata: photo.getMetadata(),
            createdAt: photo.getCreatedAt(),
          });
          if (file) {
            const result = await replacePhoto.execute(updated, file);
            setFile(null);
            setReport(result.optimizationIssues);
            onSaved(result.photo, result.optimizationIssues);
          } else {
            await savePhoto.execute(updated);
            onSaved(updated);
          }
          setSaved(true);
        } catch (failure) {
          setError(apiFailureMessage(failure));
        } finally {
          setSaving(false);
        }
      }}
    >
      <fieldset className="upload-fields" disabled={saving}>
        {report.length > 0 && <OptimizationIssueList issues={report} />}
        <label>
          Replacement file
          <input
            key={photo.urlForWidth(320)}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setSaved(false);
            }}
          />
        </label>
        {file && (
          <p>
            Replace with {file.name}. The record, publication date, frame and
            highlights are preserved. Review crops after replacing.
          </p>
        )}
        <label>
          Title
          <input
            required
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setSaved(false);
            }}
          />
        </label>
        <label>
          Description
          <textarea
            rows={3}
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              setSaved(false);
            }}
          />
        </label>
        <label>
          Title corner in the viewer
          <select
            value={titlePosition}
            onChange={(event) => {
              setTitlePosition(event.target.value as PhotoTitlePosition);
              setSaved(false);
            }}
          >
            {PHOTO_TITLE_POSITIONS.map((position) => (
              <option key={position} value={position}>
                {TITLE_POSITION_LABELS[position]}
              </option>
            ))}
          </select>
        </label>
        <HighlightEditor
          src={photo.urlForWidth(1280)}
          width={photo.getWidth()}
          height={photo.getHeight()}
          value={highlights}
          onChange={(next) => {
            setHighlights(next);
            setSaved(false);
          }}
          disabled={saving}
        />
        {error && (
          <p role="alert" className="upload-error">
            {error}
          </p>
        )}
        {saved && <p role="status">Changes saved.</p>}
        <button type="submit" className="upload-primary">
          {saving ? "Saving…" : "Save changes"}
        </button>
      </fieldset>
    </form>
  );
}
