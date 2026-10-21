"use client";
import "./catalogStudio.css";

import styles from "./EditorFeedback.module.css";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  PublishedPhoto,
  PhotoUploadError,
} from "@/src/domain/repositories/PhotoRepository";
import { PhotoOptimizationIssue } from "@/src/domain/entities/PhotoOptimizationIssue";
import { OptimizationIssueList } from "./OptimizationIssueList";
import { Photo } from "@/src/domain/entities/Photo";
import {
  getManagedPhotos,
  getPhotoById,
  savePhoto,
  getUnoptimizedPhotos,
  replacePhoto,
} from "@/src/infrastructure/photoServices";
import { manageCatalog } from "@/src/infrastructure/catalogServices";
import { Catalog } from "@/src/domain/entities/Catalog";
import { usePhotoFetch } from "@/src/ui/hooks/usePhotoFetch";
import { filterPhotos, PhotoFilters, usePhotoFilter } from "./PhotoFilters";
import { apiFailureMessage } from "@/src/ui/apiFailureMessage";
import { ErrorMessage } from "./ErrorMessage";
import { HighlightEditor } from "./HighlightEditor";
import { FrameFields } from "./FrameFields";
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
import { VariantAssignment } from "./VariantAssignment";
import { PhotoClassificationFields } from "./PhotoClassificationFields";
import {
  EditingBoundary,
  useEditingWorkspace,
  useUnsavedEditor,
} from "./EditingWorkspace";

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
          <EditingBoundary>
            <PhotoManager />
          </EditingBoundary>
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
      <PhotoLibrary pendingOnly={pendingOnly} />
    </>
  );
}

function PhotoLibrary({ pendingOnly }: { pendingOnly: boolean }) {
  const loadPhotos = useCallback(
    async () => ({
      entries: pendingOnly
        ? await getUnoptimizedPhotos.execute()
        : ((await getManagedPhotos.execute()) ?? []).map((photo) => ({
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
  const [visited, setVisited] = useState<Record<string, PublishedPhoto>>({});
  const [filter, setFilter] = usePhotoFilter();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  useEffect(() => {
    // Categories only narrow the list; without them the other filters still work.
    manageCatalog.load().then(setCatalog, () => setCatalog(null));
  }, []);
  const listed = (data?.entries ?? [])
    .map((entry) => revisions[entry.photo.getId()] ?? entry)
    .filter(
      (entry) =>
        !pendingOnly ||
        entry.optimizationIssues.some((issue) => issue.isPending()),
    );
  const shown = new Set(
    filterPhotos(
      listed.map((entry) => entry.photo),
      filter,
      catalog,
    ),
  );
  const entries = listed.filter((entry) => shown.has(entry.photo));
  return (
    <div className="manage-layout">
      <div className="studio-card photo-library-card">
        <PhotoFilters
          label="Published photos"
          photos={listed.map((entry) => entry.photo)}
          catalog={catalog}
          filter={filter}
          onChange={setFilter}
          withCamera
        />
        <p className="photo-library-count" aria-live="polite">
          {entries.length} of {listed.length}{" "}
          {listed.length === 1 ? "photo" : "photos"}
        </p>
        <nav className="manage-library" aria-label="Published photos">
          {loading && <p role="status">Loading photographs…</p>}
          {error && <ErrorMessage message={error} onRetry={retry} />}
          {entries.length === 0 && (
            <p>
              {listed.length
                ? "No photos match these filters."
                : pendingOnly
                  ? "No photos need optimization."
                  : "No photos published yet."}
            </p>
          )}
          {entries.map(({ photo, optimizationIssues }) => (
            <button
              type="button"
              key={photo.getId()}
              aria-pressed={selected?.getId() === photo.getId()}
              onClick={() => {
                setSelected(photo);
                setVisited((previous) => ({
                  ...previous,
                  [photo.getId()]: previous[photo.getId()] ?? {
                    photo,
                    optimizationIssues,
                  },
                }));
              }}
            >
              <span className="manage-thumbnail">
                <Image
                  src={photo.urlForWidth(160)}
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
      </div>
      {Object.values(visited).map((entry) => {
        const id = entry.photo.getId();
        const current = revisions[id] ?? entry;
        return (
          <div key={id} hidden={selected?.getId() !== id}>
            <PhotoDetailEditor
              active={selected?.getId() === id}
              photo={current.photo}
              revised={Boolean(revisions[id])}
              issues={current.optimizationIssues}
              onSaved={(updated, optimizationIssues) => {
                setSelected((previous) =>
                  previous?.getId() === id ? updated : previous,
                );
                setRevisions((previous) => ({
                  ...previous,
                  [id]: {
                    photo: updated,
                    optimizationIssues:
                      optimizationIssues ?? current.optimizationIssues,
                  },
                }));
              }}
            />
          </div>
        );
      })}
      {!selected && (
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
  active,
}: {
  photo: Photo;
  revised: boolean;
  active: boolean;
  issues: PhotoOptimizationIssue[];
  onSaved: (photo: Photo, issues?: PhotoOptimizationIssue[]) => void;
}) {
  const id = photo.getId();
  const [freshDetail, setFreshDetail] = useState(false);
  const loadDetail = useCallback(() => getPhotoById.execute(id), [id]);
  const { data, loading, error, retry } = usePhotoFetch(
    loadDetail,
    "Photo not found.",
  );
  if (loading) return <p role="status">Loading photograph…</p>;
  if (error) return <ErrorMessage message={error} onRetry={retry} />;
  return data ? (
    <PhotoEditor
      active={active}
      key={`${(revised && !freshDetail ? photo : data).getId()}:${(revised && !freshDetail ? photo : data).getVersion()}`}
      photo={revised && !freshDetail ? photo : data}
      initialSaved={revised && !freshDetail}
      issues={issues}
      onSaved={(updated, nextIssues) => {
        setFreshDetail(false);
        onSaved(updated, nextIssues);
      }}
      onReload={() => {
        setFreshDetail(true);
        retry();
      }}
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
  onReload,
  initialSaved,
  active,
}: {
  photo: Photo;
  issues: PhotoOptimizationIssue[];
  onSaved: (photo: Photo, issues?: PhotoOptimizationIssue[]) => void;
  onReload: () => void;
  initialSaved: boolean;
  active: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState(issues);
  const [title, setTitle] = useState(photo.getTitle());
  const [description, setDescription] = useState(photo.getDescription() ?? "");
  const [highlights, setHighlights] = useState(photo.getHighlights());
  const [titlePosition, setTitlePosition] = useState(photo.getTitlePosition());
  const [frame, setFrame] = useState(photo.getFrame());
  const [classification, setClassification] = useState(
    photo.getClassification(),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [saved, setSaved] = useState(initialSaved);
  const { confirm } = useEditingWorkspace();
  const form = useRef<HTMLFormElement>(null);
  const [resetKey, setResetKey] = useState(0);
  const dirty =
    Boolean(file) ||
    title !== photo.getTitle() ||
    description !== (photo.getDescription() ?? "") ||
    titlePosition !== photo.getTitlePosition() ||
    JSON.stringify(frame) !== JSON.stringify(photo.getFrame()) ||
    JSON.stringify(highlights) !== JSON.stringify(photo.getHighlights()) ||
    JSON.stringify(classification) !==
      JSON.stringify(photo.getClassification());
  function discard() {
    setTitle(photo.getTitle());
    setDescription(photo.getDescription() ?? "");
    setHighlights(photo.getHighlights());
    setTitlePosition(photo.getTitlePosition());
    setFrame(photo.getFrame());
    setClassification(photo.getClassification());
    setFile(null);
    setResetKey((value) => value + 1);
    setError("");
    setConflict(false);
    setSaved(false);
  }
  async function persist(): Promise<boolean> {
    if (saving) return false;
    if (!title.trim()) {
      setError("Give the photograph a title before saving.");
      return false;
    }
    setSaving(true);
    setError("");
    setConflict(false);
    setSaved(false);
    try {
      const updated = new Photo({
        ...classification,
        id: photo.getId(),
        version: photo.getVersion(),
        title,
        description,
        highlights,
        titlePosition,
        frame,
        width: photo.getWidth(),
        height: photo.getHeight(),
        renditions: photo.getRenditions(),
        metadata: photo.getMetadata(),
        createdAt: photo.getCreatedAt(),
      });
      if (file) {
        const result = await replacePhoto.execute(updated, file, photo);
        setFile(null);
        setReport(result.optimizationIssues);
        onSaved(result.photo, result.optimizationIssues);
      } else {
        await savePhoto.execute(updated, photo);
        onSaved((await getPhotoById.execute(updated.getId())) ?? updated);
      }
      setSaved(true);
      window.dispatchEvent(new Event("curator:catalog-changed"));
      return true;
    } catch (failure) {
      setConflict(
        failure instanceof PhotoUploadError && failure.failure === "conflict",
      );
      setError(apiFailureMessage(failure));
      return false;
    } finally {
      setSaving(false);
    }
  }
  useUnsavedEditor(dirty, { label: photo.getTitle(), save: persist, discard });
  const actions = () => (
    <div className={styles.actions}>
      <button type="submit" className="upload-primary" disabled={saving}>
        {saving ? "Saving…" : "Save changes"}
      </button>
      <button
        type="button"
        className="upload-secondary"
        disabled={saving || !dirty}
        onClick={async () => {
          if (
            await confirm(
              "Cancel changes?",
              'Discard unsaved changes to "' + photo.getTitle() + '"?',
            )
          )
            discard();
        }}
      >
        Cancel changes
      </button>
    </div>
  );
  if (!active) return null;
  return (
    <form
      className="upload-card manage-editor"
      ref={form}
      onSubmit={async (event) => {
        event.preventDefault();
        if (saving || !form.current?.checkValidity()) return;
        if (
          await confirm(
            "Save photo changes?",
            'Save changes to "' + title + '"?',
          )
        )
          await persist();
      }}
    >
      <fieldset className="upload-fields" disabled={saving}>
        {actions()}
        <VariantAssignment
          photoId={photo.getId()}
          title={photo.getTitle()}
          disabled={saving}
        />
        <PhotoClassificationFields
          value={classification}
          onChange={(next) => {
            setClassification(next);
            setSaved(false);
          }}
          disabled={saving}
        />
        {report.length > 0 && <OptimizationIssueList issues={report} />}
        <label>
          Replacement file
          <input
            key={`${photo.urlForWidth(320)}:${resetKey}`}
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
            highlights are preserved. Review crops and frame after replacing.
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
        <FrameFields
          src={photo.urlForWidth(640)}
          width={photo.getWidth()}
          height={photo.getHeight()}
          value={frame}
          onChange={(next) => {
            setFrame(next);
            setSaved(false);
          }}
          disabled={saving}
        />
        <HighlightEditor
          src={photo.urlForWidth(960)}
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
        {conflict && (
          <button type="button" className="upload-secondary" onClick={onReload}>
            Reload state
          </button>
        )}
        {actions()}
      </fieldset>
    </form>
  );
}
