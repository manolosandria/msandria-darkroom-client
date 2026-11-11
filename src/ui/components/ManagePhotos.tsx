"use client";
import {
  PhotoTonalityField,
  TonalityBackfill,
} from "./PhotoTonalityControls";
import { UPLOAD_IMAGE_TYPES } from "@/src/ui/uploadFiles";
import "./catalogStudio.css";
import { AdminOnly } from "./AdminOnly";
import "./photoBrowser.css";
import "./photoStudio.css";

import styles from "./EditorFeedback.module.css";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  PublishedPhoto,
  PhotoUploadError,
} from "@/src/domain/repositories/PhotoRepository";
import {
  PhotoOptimizationIssue,
  PhotoOptimizationIssueKind,
} from "@/src/domain/entities/PhotoOptimizationIssue";
import {
  OptimizationIssueList,
  optimizationIssueLabel,
} from "./OptimizationIssueList";
import { Photo, PhotoVisibility } from "@/src/domain/entities/Photo";
import {
  Highlight,
  PhotoHighlights,
} from "@/src/domain/entities/PhotoHighlights";
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
import {
  cameraName,
  filterPhotos,
  PhotoFilters,
  usePhotoFilter,
} from "./PhotoFilters";
import { apiFailureMessage } from "@/src/ui/apiFailureMessage";
import { ErrorMessage } from "./ErrorMessage";
import { HighlightEditor } from "./HighlightEditor";
import { FrameFields } from "./FrameFields";
import { PhotoImage } from "./PhotoImage";
import {
  automaticVariantCorner,
  PHOTO_TITLE_POSITIONS,
  PhotoTitlePosition,
  PhotoVariantPosition,
} from "@/src/domain/entities/PhotoTitlePosition";
import { VariantAssignment } from "./VariantAssignment";
import { InspectorSection } from "./InspectorSection";
import { PhotoSectionBar } from "./PhotoSectionBar";
import {
  InspectorView,
  readHiddenSections,
  readFolded,
  readInspectorView,
  writeHiddenSections,
  writeFolded,
  writeInspectorView,
} from "@/src/ui/photoSectionPreference";
import {
  PhotoCategoryField,
  PhotoCollectionField,
  PhotoVisibilityField,
} from "./PhotoClassificationFields";
import { EmptyState } from "./EmptyState";
import { EditorActions } from "./EditorActions";
import { VISIBILITY_LABELS, VisibilityBadge } from "./PhotoBadges";
import { FileBorderTrim } from "./BorderTrimFields";
import { BorderTrim } from "@/src/domain/borderTrim";
import { highlightViews, missingHighlights } from "@/src/ui/highlightViews";
import {
  EditingBoundary,
  useEditingWorkspace,
  useUnsavedEditor,
  type SaveOutcome,
} from "./EditingWorkspace";

const TITLE_POSITION_LABELS: Record<PhotoTitlePosition, string> = {
  BOTTOM_LEFT: "Bottom left",
  BOTTOM_RIGHT: "Bottom right",
  TOP_LEFT: "Top left",
  TOP_RIGHT: "Top right",
};

export default function ManagePhotos() {
  return (
    <main className="upload-workspace">
      <div className="upload-container photo-studio-container">
        <div className="upload-heading">
          <h1>Refine your photographs.</h1>
          <p>Edit titles, stories, and the details that fill each thumbnail.</p>
        </div>
        <Link href="/upload" className="upload-link">
          ← Upload photos
        </Link>
        <AdminOnly to="manage photos">
          <EditingBoundary>
            <PhotoManager />
          </EditingBoundary>
        </AdminOnly>
      </div>
    </main>
  );
}

function PhotoManager() {
  const [pendingOnly, setPendingOnly] = useState(false);
  return (
    <PhotoLibrary pendingOnly={pendingOnly} onPendingOnly={setPendingOnly} />
  );
}

type LibraryView = "grid" | "list";

function PhotoLibrary({
  pendingOnly,
  onPendingOnly,
}: {
  pendingOnly: boolean;
  onPendingOnly: (value: boolean) => void;
}) {
  // Every photo, with the file issues of those that have any: what needs attention is
  // counted whether or not the list is narrowed to it.
  const loadPhotos = useCallback(async () => {
    // The issues only add warnings: without them the library still opens.
    const [photos, unoptimized] = await Promise.all([
      getManagedPhotos.execute(),
      Promise.resolve()
        .then(() => getUnoptimizedPhotos.execute())
        .then((entries) => entries ?? [])
        .catch(() => [] as PublishedPhoto[]),
    ]);
    const issues = new Map(
      unoptimized.map((entry) => [
        entry.photo.getId(),
        entry.optimizationIssues,
      ]),
    );
    return {
      entries: (photos ?? []).map((photo) => ({
        photo,
        optimizationIssues: issues.get(photo.getId()) ?? [],
      })),
    };
  }, []);
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
  const [view, setView] = useState<LibraryView>("grid");
  const [size, setSize] = useState(200);
  const viewName = useId();
  useEffect(() => {
    // Categories only narrow the list; without them the other filters still work.
    manageCatalog.load().then(setCatalog, () => setCatalog(null));
  }, []);
  // Alert kinds left out of the list; none, so every alert shows at first.
  const [hiddenAlerts, setHiddenAlerts] = useState<string[]>([]);
  const all = (data?.entries ?? []).map(
    (entry) => revisions[entry.photo.getId()] ?? entry,
  );
  const needing = all.filter((entry) => attentionOf(entry).length > 0);
  const alertCounts = new Map<string, number>();
  for (const entry of needing)
    for (const kind of attentionOf(entry))
      alertCounts.set(kind, (alertCounts.get(kind) ?? 0) + 1);
  const listed = pendingOnly
    ? needing.filter((entry) =>
        attentionOf(entry).some((kind) => !hiddenAlerts.includes(kind)),
      )
    : all;
  const shown = new Set(
    filterPhotos(
      listed.map((entry) => entry.photo),
      filter,
      catalog,
    ),
  );
  const entries = listed.filter((entry) => shown.has(entry.photo));
  const photos = all.map((entry) => entry.photo);
  function open(entry: PublishedPhoto) {
    const { photo, optimizationIssues } = entry;
    setSelected(photo);
    setVisited((previous) => ({
      ...previous,
      [photo.getId()]: previous[photo.getId()] ?? {
        photo,
        optimizationIssues,
      },
    }));
  }
  // A link from the viewer names the photo to open (`?photo=<id>`): it opens once the
  // library has loaded, and the address forgets it so a reload starts at the library.
  const asked = useRef<string | null>(null);
  useEffect(() => {
    try {
      asked.current = new URLSearchParams(window.location.search).get("photo");
    } catch {
      asked.current = null;
    }
  }, []);
  useEffect(() => {
    const id = asked.current;
    if (!id || !data) return;
    asked.current = null;
    const entry = all.find((item) => item.photo.getId() === id);
    if (entry) queueMicrotask(() => open(entry));
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("photo");
      window.history.replaceState(window.history.state, "", url);
    } catch {
      /* The address keeps the id; nothing else depends on it. */
    }
    // Only when the library arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  // While a photo is open, its strip of neighbours can fold away to give the stage room.
  const [stripFolded, setStripFolded] = useState(() =>
    readFolded("photoStripFolded"),
  );
  const foldStrip = (next: boolean) => {
    setStripFolded(next);
    writeFolded("photoStripFolded", next);
  };
  const folded = Boolean(selected) && stripFolded;
  const mode = selected ? "strip" : view;
  const stripId = useId();
  return (
    <div className={`photo-studio ${selected ? "photo-studio--editing" : ""}`}>
      <div
        className="studio-card photo-studio__library"
        data-folded={folded ? "" : undefined}
      >
        <div className="photo-studio__toolbar">
          {selected && (
            <button
              type="button"
              className="photo-studio__back"
              onClick={() => setSelected(null)}
            >
              <LibraryIcon view="grid" /> Library
            </button>
          )}
          {selected && (
            <button
              type="button"
              className="photo-studio__fold"
              aria-expanded={!stripFolded}
              aria-controls={stripId}
              title={
                stripFolded
                  ? "Show the strip of photos"
                  : "Fold the strip of photos away"
              }
              onClick={() => foldStrip(!stripFolded)}
            >
              <svg
                viewBox="0 0 20 20"
                width="16"
                height="16"
                aria-hidden="true"
              >
                <path
                  d={stripFolded ? "M5 8l5 5 5-5" : "M5 12l5-5 5 5"}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {stripFolded ? "Show photos" : "Hide photos"}
            </button>
          )}
          <PhotoFilters
            label="Published photos"
            photos={photos}
            catalog={catalog}
            filter={filter}
            onChange={setFilter}
            withCamera
          />
          <label
            className="photo-studio__pending"
            data-alert={needing.length ? "" : undefined}
          >
            <input
              type="checkbox"
              aria-label="Only photos needing optimization"
              checked={pendingOnly}
              onChange={(event) => onPendingOnly(event.target.checked)}
            />
            <span aria-hidden="true">⚠</span> Needs optimization
            {needing.length > 0 && (
              <span
                className="photo-studio__pending-count"
                title={`${needing.length} ${needing.length === 1 ? "photo needs" : "photos need"} attention`}
              >
                {needing.length}
              </span>
            )}
          </label>
          {!selected && (
            <>
              <fieldset
                className="photo-studio__views"
                role="radiogroup"
                aria-label="Library view"
              >
                {(["grid", "list"] as const).map((option) => (
                  <label
                    key={option}
                    title={option === "grid" ? "Grid" : "List"}
                  >
                    <input
                      type="radio"
                      name={viewName}
                      checked={view === option}
                      onChange={() => setView(option)}
                    />
                    <LibraryIcon view={option} />
                    <span>{option === "grid" ? "Grid" : "List"}</span>
                  </label>
                ))}
              </fieldset>
              {view === "grid" && (
                <label className="photo-studio__size">
                  <span className="sr-only">Thumbnail size</span>
                  <svg
                    viewBox="0 0 20 20"
                    width="14"
                    height="14"
                    aria-hidden="true"
                  >
                    <rect
                      x="5"
                      y="5"
                      width="10"
                      height="10"
                      fill="currentColor"
                    />
                  </svg>
                  <input
                    type="range"
                    min={130}
                    max={340}
                    step={10}
                    value={size}
                    onChange={(event) => setSize(Number(event.target.value))}
                  />
                  <svg
                    viewBox="0 0 20 20"
                    width="20"
                    height="20"
                    aria-hidden="true"
                  >
                    <rect
                      x="2"
                      y="2"
                      width="16"
                      height="16"
                      fill="currentColor"
                    />
                  </svg>
                </label>
              )}
            </>
          )}
          <p className="photo-library-count" aria-live="polite">
            {entries.length} of {listed.length}{" "}
            {listed.length === 1 ? "photo" : "photos"}
          </p>
        </div>
        {!selected && !pendingOnly && (
          <TonalityBackfill
            pending={
              all.filter((entry) => entry.photo.getTonality() === null).length
            }
            onDone={retry}
          />
        )}
        {needing.length > 0 && !pendingOnly && !selected && (
          <p className="photo-studio__alert" role="status">
            <span aria-hidden="true">⚠</span>
            <span>
              <strong>
                {needing.length}{" "}
                {needing.length === 1 ? "photo needs" : "photos need"} attention
              </strong>{" "}
              — {describeAlerts(alertCounts)}.
            </span>
            <button type="button" onClick={() => onPendingOnly(true)}>
              Review them
            </button>
          </p>
        )}
        {pendingOnly && alertCounts.size > 0 && (
          <fieldset className="photo-studio__alerts">
            <legend>Show alerts for</legend>
            {[...alertCounts].map(([kind, count]) => (
              <label key={kind}>
                <input
                  type="checkbox"
                  checked={!hiddenAlerts.includes(kind)}
                  onChange={(event) =>
                    setHiddenAlerts((previous) =>
                      event.target.checked
                        ? previous.filter((item) => item !== kind)
                        : [...previous, kind],
                    )
                  }
                />
                {alertLabel(kind)} <small>{count}</small>
              </label>
            ))}
            {hiddenAlerts.length > 0 && (
              <button type="button" onClick={() => setHiddenAlerts([])}>
                Show all
              </button>
            )}
          </fieldset>
        )}
        <nav
          id={stripId}
          hidden={folded}
          className={`photo-browser photo-browser--${mode}`}
          aria-label="Published photos"
          style={{ "--photo-browser-size": `${size}px` } as React.CSSProperties}
        >
          {loading && <p role="status">Loading photographs…</p>}
          {error && <ErrorMessage message={error} onRetry={retry} />}
          {!loading && entries.length === 0 && (
            <div className="photo-browser__empty">
              {listed.length ? (
                <EmptyState
                  picture="search"
                  title="No photos match these filters."
                  quiet
                />
              ) : pendingOnly && needing.length ? (
                <EmptyState
                  picture="search"
                  title="No photos have the alerts chosen."
                  quiet
                />
              ) : pendingOnly ? (
                <EmptyState
                  picture="done"
                  title="No photos need optimization."
                  quiet
                />
              ) : (
                <EmptyState
                  picture="photos"
                  title="No photos published yet."
                  quiet
                >
                  Upload brings your first photographs here.
                </EmptyState>
              )}
            </div>
          )}
          {mode === "list" && entries.length > 0 && (
            <div className="photo-browser__head" aria-hidden="true">
              <span />
              <span>Title</span>
              <span>Visibility</span>
              <span>Size</span>
              <span>Camera</span>
              <span>Published</span>
            </div>
          )}
          {entries.map((entry) => (
            <LibraryItem
              key={entry.photo.getId()}
              entry={entry}
              mode={mode}
              selected={selected?.getId() === entry.photo.getId()}
              onOpen={() => open(entry)}
            />
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
              photos={photos}
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
    </div>
  );
}

function LibraryIcon({ view }: { view: LibraryView }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      {view === "grid" ? (
        <>
          <rect x="2.5" y="2.5" width="6" height="6" />
          <rect x="11.5" y="2.5" width="6" height="6" />
          <rect x="2.5" y="11.5" width="6" height="6" />
          <rect x="11.5" y="11.5" width="6" height="6" />
        </>
      ) : (
        <>
          <rect x="2.5" y="3" width="4" height="4" />
          <path d="M9 5h9" />
          <rect x="2.5" y="13" width="4" height="4" />
          <path d="M9 15h9" />
        </>
      )}
    </svg>
  );
}

// What a photo still asks of the curator: its file's pending issues by kind, and
// HIGHLIGHTS while any of the three main crops is missing.
const HIGHLIGHTS_ALERT = "HIGHLIGHTS";
function attentionOf({ photo, optimizationIssues }: PublishedPhoto): string[] {
  const kinds = optimizationIssues
    .filter((issue) => issue.isPending())
    .map((issue) => issue.getKind() as string);
  if (missingHighlights(photo.getHighlights()).length)
    kinds.push(HIGHLIGHTS_ALERT);
  return [...new Set(kinds)];
}
const alertLabel = (kind: string) =>
  kind === HIGHLIGHTS_ALERT
    ? "Missing highlights"
    : optimizationIssueLabel(kind as PhotoOptimizationIssueKind);
const describeAlerts = (counts: Map<string, number>) =>
  [...counts]
    .map(([kind, count]) => `${alertLabel(kind).toLowerCase()} (${count})`)
    .join(", ");

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function LibraryItem({
  entry: { photo, optimizationIssues },
  mode,
  selected,
  onOpen,
}: {
  entry: PublishedPhoto;
  mode: LibraryView | "strip";
  selected: boolean;
  onOpen: () => void;
}) {
  const visibility = photo.getClassification().visibility;
  const alerts = attentionOf({ photo, optimizationIssues });
  const pending = alerts.length;
  const badges = (
    <span className="photo-browser__badges" aria-hidden="true">
      <VisibilityBadge visibility={visibility} />
      {pending > 0 && (
        <span data-warning title={alerts.map(alertLabel).join(", ")}>
          ⚠
        </span>
      )}
    </span>
  );
  return (
    <button
      type="button"
      className="photo-browser__item"
      aria-pressed={selected}
      aria-label={photo.getTitle()}
      title={photo.getTitle()}
      onClick={onOpen}
    >
      <span className="photo-browser__thumb">
        {mode === "grid" ? (
          <PhotoImage
            photo={photo}
            maxWidth={640}
            fallbackSizes="240px"
            className="object-contain"
          />
        ) : (
          <PhotoImage
            photo={photo}
            maxWidth={160}
            fallbackSizes="80px"
            className="object-cover"
            crop={photo.getHighlights().square}
          />
        )}
        {mode !== "list" && badges}
      </span>
      {mode === "grid" && (
        <span className="photo-browser__caption">
          <strong>{photo.getTitle()}</strong>
          <small>
            {photo.getWidth()} × {photo.getHeight()}
          </small>
        </span>
      )}
      {mode === "list" && (
        <>
          <strong>{photo.getTitle()}</strong>
          <span>
            <span
              className="photo-browser__visibility"
              data-visibility={visibility}
            >
              {VISIBILITY_LABELS[visibility]}
            </span>
            {pending > 0 && (
              <span className="photo-browser__warning"> ⚠ {pending}</span>
            )}
          </span>
          <span>
            {photo.getWidth()} × {photo.getHeight()}
          </span>
          <span>{cameraName(photo) || "—"}</span>
          <span>{formatDate(photo.getCreatedAt())}</span>
        </>
      )}
    </button>
  );
}

// A listing item is never used to initialize an editor: it has no description.
function PhotoDetailEditor({
  photo,
  photos,
  onSaved,
  issues,
  revised,
  active,
}: {
  photo: Photo;
  photos: Photo[];
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
      photos={photos}
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

const SECTIONS = [
  { id: "details", label: "Details" },
  { id: "visibility", label: "Visibility" },
  { id: "categories", label: "Categories" },
  { id: "collections", label: "Collections" },
  { id: "variants", label: "Variants" },
  { id: "frame", label: "Frame" },
  { id: "highlights", label: "Highlights" },
  { id: "file", label: "File" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];
const SECTION_IDS = SECTIONS.map((item) => item.id);
// Details holds the required title, so it can never be hidden away from validation.
const LOCKED: SectionId[] = ["details"];
const DEFAULT_OPEN: SectionId[] = [
  "details",
  "visibility",
  "categories",
  "collections",
  "highlights",
];

function PhotoEditor({
  photo,
  photos,
  onSaved,
  issues,
  onReload,
  initialSaved,
  active,
}: {
  photo: Photo;
  photos: Photo[];
  issues: PhotoOptimizationIssue[];
  onSaved: (photo: Photo, issues?: PhotoOptimizationIssue[]) => void;
  onReload: () => void;
  initialSaved: boolean;
  active: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  // A border baked into the replacement file, cut away by the API.
  const [fileTrim, setFileTrim] = useState<BorderTrim | null>(null);
  const [report, setReport] = useState(issues);
  const [title, setTitle] = useState(photo.getTitle());
  const [description, setDescription] = useState(photo.getDescription() ?? "");
  const [highlights, setHighlights] = useState(photo.getHighlights());
  const [titlePosition, setTitlePosition] = useState(photo.getTitlePosition());
  const [tonality, setTonality] = useState(photo.getTonality());
  const [variantPosition, setVariantPosition] = useState(
    photo.getVariantPosition(),
  );
  const [frame, setFrame] = useState(photo.getFrame());
  const [classification, setClassification] = useState(
    photo.getClassification(),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [saved, setSaved] = useState(initialSaved);
  const [openSections, setOpenSections] = useState<SectionId[]>(DEFAULT_OPEN);
  const [current, setCurrent] = useState<SectionId>("details");
  const [view, setView] = useState<InspectorView>(readInspectorView);
  const tabs = view === "tabs";
  const [hiddenSections, setHiddenSections] = useState<SectionId[]>(
    () =>
      readHiddenSections(SECTION_IDS).filter(
        (id) => !LOCKED.includes(id as SectionId),
      ) as SectionId[],
  );
  const sectionsRef = useRef<HTMLFieldSetElement>(null);
  const [stageView, setStageView] = useState("original");
  const { confirm } = useEditingWorkspace();
  const form = useRef<HTMLFormElement>(null);
  const [resetKey, setResetKey] = useState(0);
  const prefix = useId();
  const formId = `${prefix}-form`;
  const dirty =
    Boolean(file) ||
    title !== photo.getTitle() ||
    description !== (photo.getDescription() ?? "") ||
    titlePosition !== photo.getTitlePosition() ||
    tonality !== photo.getTonality() ||
    variantPosition !== photo.getVariantPosition() ||
    JSON.stringify(frame) !== JSON.stringify(photo.getFrame()) ||
    JSON.stringify(highlights) !== JSON.stringify(photo.getHighlights()) ||
    JSON.stringify(classification) !==
      JSON.stringify(photo.getClassification());
  function discard() {
    setTitle(photo.getTitle());
    setDescription(photo.getDescription() ?? "");
    setHighlights(photo.getHighlights());
    setTitlePosition(photo.getTitlePosition());
    setTonality(photo.getTonality());
    setVariantPosition(photo.getVariantPosition());
    setFrame(photo.getFrame());
    setClassification(photo.getClassification());
    setFile(null);
    setFileTrim(null);
    setResetKey((value) => value + 1);
    setError("");
    setConflict(false);
    setSaved(false);
  }
  // Says why when it fails, so the save bar and the leaving dialog can tell the curator.
  async function persist(): Promise<SaveOutcome> {
    if (saving) return { error: "it is still being saved" };
    if (!title.trim()) {
      const missing = "Give the photograph a title before saving.";
      setError(missing);
      return { error: missing };
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
        variantPosition,
        tonality,
        frame,
        width: photo.getWidth(),
        height: photo.getHeight(),
        renditions: photo.getRenditions(),
        metadata: photo.getMetadata(),
        createdAt: photo.getCreatedAt(),
      });
      if (file) {
        const result = fileTrim
          ? await replacePhoto.execute(updated, file, photo, fileTrim)
          : await replacePhoto.execute(updated, file, photo);
        setFile(null);
        setFileTrim(null);
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
      const message = apiFailureMessage(failure);
      setError(message);
      return { error: message };
    } finally {
      setSaving(false);
    }
  }
  // Everything the form edits but the replacement file, as one document for Undo and
  // for the review before saving.
  const edits = {
    title,
    description,
    titlePosition,
    tonality,
    variantPosition,
    frame,
    highlights,
    classification,
  };
  const { review } = useUnsavedEditor(dirty, {
    label: photo.getTitle(),
    save: persist,
    discard,
    document: {
      original: {
        title: photo.getTitle(),
        description: photo.getDescription() ?? "",
        titlePosition: photo.getTitlePosition(),
        tonality: photo.getTonality(),
        variantPosition: photo.getVariantPosition(),
        frame: photo.getFrame(),
        highlights: photo.getHighlights(),
        classification: photo.getClassification(),
      },
      draft: edits,
      restore: (value) => {
        const next = value as typeof edits;
        setTitle(next.title);
        setDescription(next.description);
        setTitlePosition(next.titlePosition);
        setTonality(next.tonality);
        setVariantPosition(next.variantPosition);
        setFrame(next.frame);
        setHighlights(next.highlights);
        setClassification(next.classification);
        setSaved(false);
      },
    },
  });
  const changed = () => setSaved(false);
  function toggleSection(id: SectionId, open: boolean) {
    setOpenSections((previous) =>
      open
        ? previous.includes(id)
          ? previous
          : [...previous, id]
        : previous.filter((item) => item !== id),
    );
  }
  // Until this time, a jump's own smooth scroll is not taken for the reader's.
  const jumpingUntil = useRef(0);
  function jump(id: SectionId) {
    toggleSection(id, true);
    setCurrent(id);
    // As tabs, the chosen section replaces the others: nothing to scroll to.
    if (tabs) return;
    jumpingUntil.current = Date.now() + 1200;
    requestAnimationFrame(() =>
      document
        .getElementById(`${prefix}-${id}`)
        ?.scrollIntoView?.({ behavior: "smooth", block: "start" }),
    );
  }
  // Follows the reader: the section crossing the upper third of the window is current.
  useEffect(() => {
    const root = sectionsRef.current;
    if (!active || !root || typeof IntersectionObserver === "undefined") return;
    const inBand = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.section ?? "";
          if (entry.isIntersecting) inBand.add(id);
          else inBand.delete(id);
        }
        if (Date.now() < jumpingUntil.current) return;
        const top = SECTION_IDS.find((id) => inBand.has(id));
        if (top) setCurrent(top);
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    root
      .querySelectorAll<HTMLElement>(".photo-develop__slot:not([hidden])")
      .forEach((slot) => observer.observe(slot));
    return () => observer.disconnect();
  }, [active, hiddenSections]);
  const actions = () => (
    <div className={styles.actions}>
      <EditorActions
        form={formId}
        busy={saving}
        dirty={dirty}
        canSave
        saveLabel="Save changes"
        onCancel={async () => {
          if (
            await confirm(
              "Cancel changes?",
              'Discard unsaved changes to "' + photo.getTitle() + '"?',
            )
          )
            discard();
        }}
      />
    </div>
  );
  const section = (
    id: SectionId,
    children: React.ReactNode,
    options: { lazy?: boolean; summary?: React.ReactNode } = {},
  ) => (
    // Always wrapped, so hiding a section keeps its state instead of remounting it.
    <div
      className="photo-develop__slot"
      data-section={id}
      hidden={hiddenSections.includes(id) || (tabs && current !== id)}
    >
      <InspectorSection
        id={`${prefix}-${id}`}
        label={SECTIONS.find((item) => item.id === id)!.label}
        summary={options.summary}
        open={tabs || openSections.includes(id)}
        lazy={options.lazy}
        onToggle={(open) => toggleSection(id, open)}
      >
        {children}
      </InspectorSection>
    </div>
  );
  if (!active) return null;
  const pending = report.filter((issue) => issue.isPending()).length;
  return (
    <form
      id={formId}
      className="photo-develop"
      ref={form}
      onSubmit={async (event) => {
        event.preventDefault();
        if (saving) return;
        if (!form.current?.checkValidity()) {
          // The required title lives in Details, which a tab may be hiding.
          if (tabs) {
            setCurrent("details");
            requestAnimationFrame(() => form.current?.reportValidity());
          }
          return;
        }
        // A new file is confirmed apart, since the current one cannot come back; then
        // the changes are reviewed one by one.
        if (
          file &&
          !(await confirm(
            "Replace the file and save?",
            `The current file of "${title}" will be replaced by ${file.name}. The previous file cannot be recovered.`,
          ))
        )
          return;
        await review();
      }}
    >
      <PhotoStage
        chosen={stageView}
        onChoose={setStageView}
        photo={photo}
        title={title}
        highlights={highlights}
        titlePosition={titlePosition}
        variantPosition={variantPosition}
        visibility={classification.visibility}
      />
      <div className="photo-develop__inspector">
        <div className="photo-develop__header">
          <div className="photo-develop__titlebar">
            <div className="photo-develop__heading">
              <h2>{title || photo.getTitle()}</h2>
              {dirty && <span className="studio-dirty">Unsaved</span>}
            </div>
          </div>
          <PhotoSectionBar
            sections={SECTIONS.map((item) => ({
              ...item,
              badge: item.id === "file" ? pending : undefined,
              locked: LOCKED.includes(item.id),
            }))}
            current={current}
            open={openSections}
            hidden={hiddenSections}
            onJump={(id) => jump(id as SectionId)}
            onExpandAll={() => setOpenSections([...SECTION_IDS])}
            onCollapseAll={() => setOpenSections([])}
            view={view}
            onViewChange={(next) => {
              setView(next);
              writeInspectorView(next);
            }}
            onHiddenChange={(next) => {
              const hidden = next.filter(
                (id) => !LOCKED.includes(id as SectionId),
              ) as SectionId[];
              setHiddenSections(hidden);
              writeHiddenSections(hidden);
              if (hidden.includes(current)) setCurrent("details");
            }}
          />
        </div>
        <fieldset
          ref={sectionsRef}
          className="photo-develop__sections"
          disabled={saving}
        >
          {section(
            "details",
            <div className="photo-develop__fields">
              <label>
                Title
                <input
                  required
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    changed();
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
                    changed();
                  }}
                />
              </label>
              <PhotoTonalityField
                value={tonality}
                disabled={saving}
                onChange={(next) => {
                  setTonality(next);
                  changed();
                }}
              />
              <div className="corner-pickers">
                <TitleCorner
                  photo={photo}
                  value={titlePosition}
                  onChange={(next) => {
                    setTitlePosition(next);
                    // The variants never share the title's corner: they step aside.
                    if (next === variantPosition) setVariantPosition(null);
                    changed();
                  }}
                />
                <VariantCorner
                  photo={photo}
                  title={titlePosition}
                  value={variantPosition}
                  onChange={(next) => {
                    setVariantPosition(next);
                    changed();
                  }}
                />
              </div>
            </div>,
          )}
          {section(
            "visibility",
            <PhotoVisibilityField
              value={classification}
              onChange={(next) => {
                setClassification(next);
                changed();
              }}
              disabled={saving}
            />,
            { summary: VISIBILITY_LABELS[classification.visibility] },
          )}
          {section(
            "categories",
            <PhotoCategoryField
              value={classification}
              onChange={(next) => {
                setClassification(next);
                changed();
              }}
              disabled={saving}
            />,
            { summary: String(classification.categoryNames.length) },
          )}
          {section(
            "collections",
            <PhotoCollectionField
              value={classification}
              photos={photos}
              onChange={(next) => {
                setClassification(next);
                changed();
              }}
              disabled={saving}
            />,
            { summary: String(classification.collections.length) },
          )}
          {section(
            "variants",
            <VariantAssignment
              inline
              photoId={photo.getId()}
              title={photo.getTitle()}
              disabled={saving}
            />,
            { lazy: true },
          )}
          {section(
            "frame",
            <FrameFields
              src={photo.urlForWidth(640)}
              width={photo.getWidth()}
              height={photo.getHeight()}
              value={frame}
              onChange={(next) => {
                setFrame(next);
                changed();
              }}
              disabled={saving}
            />,
            { summary: frame ? "On" : "Off" },
          )}
          {section(
            "highlights",
            <HighlightEditor
              src={photo.urlForWidth(960)}
              width={photo.getWidth()}
              height={photo.getHeight()}
              value={highlights}
              onChange={(next) => {
                setHighlights(next);
                changed();
              }}
              onActiveChange={(key) => setStageView(key ?? "original")}
              activeKey={stageView}
              disabled={saving}
            />,
            { summary: String(highlightViews(highlights).length) },
          )}
          {section(
            "file",
            <div className="replace-file">
              {report.length > 0 ? (
                <OptimizationIssueList issues={report} />
              ) : (
                <p className="upload-muted">
                  No optimization notes for this file.
                </p>
              )}
              <p className="upload-muted">
                {photo.getWidth()} × {photo.getHeight()} px stored. A new export
                keeps the record, publication date, relations, frame and
                highlights; review the crops if the proportions change.
              </p>
              <label className="replace-file__button">
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  aria-hidden="true"
                >
                  <path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4M12 4v11M7 9l5-5 5 5" />
                </svg>
                {file ? "Choose another file…" : "Replace file…"}
                <input
                  key={`${photo.urlForWidth(320)}:${resetKey}`}
                  className="sr-only"
                  type="file"
                  aria-label="Replacement file"
                  accept={UPLOAD_IMAGE_TYPES.join(",")}
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setFileTrim(null);
                    changed();
                  }}
                />
              </label>
              {file && (
                <div className="replace-file__warning">
                  <strong>⚠ The current file will be lost.</strong>
                  <p>
                    Saving replaces it with <em>{file.name}</em>, and the
                    previous file cannot be recovered. Title, classification,
                    frame and highlights are kept.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setFileTrim(null);
                      setResetKey((value) => value + 1);
                    }}
                  >
                    Keep the current file
                  </button>
                </div>
              )}
              {file && (
                <FileBorderTrim
                  key={`${file.name}:${file.size}:${file.lastModified}:${resetKey}`}
                  file={file}
                  value={fileTrim}
                  disabled={saving}
                  onChange={(trim) => {
                    setFileTrim(trim);
                    changed();
                  }}
                />
              )}
            </div>,
            { summary: pending ? `⚠ ${pending}` : undefined },
          )}
        </fieldset>
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
      </div>
    </form>
  );
}

type StageView = { key: string; label: string; crop?: Highlight };

function stageViews(highlights: PhotoHighlights): StageView[] {
  return [
    { key: "original", label: "Original" },
    ...highlightViews(highlights),
  ];
}

// The large preview: the whole photo, or any of its highlights shown big.
function PhotoStage({
  chosen,
  onChoose,
  photo,
  title,
  highlights,
  titlePosition,
  variantPosition,
  visibility,
}: {
  chosen: string;
  onChoose: (key: string) => void;
  photo: Photo;
  title: string;
  highlights: PhotoHighlights;
  titlePosition: PhotoTitlePosition;
  variantPosition: PhotoVariantPosition;
  visibility: PhotoVisibility;
}) {
  const views = stageViews(highlights);
  const view = views.find((item) => item.key === chosen) ?? views[0];
  const ratio = view.crop
    ? (photo.getAspectRatio() * view.crop.width) / view.crop.height
    : photo.getAspectRatio();
  const camera = cameraName(photo);
  return (
    <section className="photo-stage" aria-label="Photo preview">
      <div
        className="photo-stage__views"
        role="radiogroup"
        aria-label="Preview view"
      >
        {views.map((item) => (
          <button
            type="button"
            role="radio"
            key={item.key}
            aria-checked={item.key === view.key}
            onClick={() => onChoose(item.key)}
          >
            {item.crop && (
              <span
                className="photo-stage__shape"
                style={{
                  aspectRatio: `${(photo.getAspectRatio() * item.crop.width) / item.crop.height}`,
                }}
                aria-hidden="true"
              />
            )}
            {item.label}
          </button>
        ))}
      </div>
      <div className="photo-stage__canvas">
        <div
          className="photo-stage__image"
          style={{
            aspectRatio: `${ratio}`,
            width: `min(100%, calc(var(--stage-height) * ${ratio}))`,
          }}
        >
          <PhotoImage
            photo={photo}
            maxWidth={1920}
            fallbackSizes="60vw"
            className="object-cover"
            crop={view.crop}
          />
          {!view.crop && (
            <span
              className={`photo-stage__title photo-stage__title--${titlePosition.toLowerCase().replace("_", "-")}`}
            >
              {title}
            </span>
          )}
          {!view.crop && (
            <span
              className="photo-stage__variants"
              data-corner={cornerName(
                variantPosition ?? automaticVariantCorner(titlePosition),
              )}
              title="Variant thumbnails in the viewer"
              aria-hidden="true"
            >
              <i />
              <i />
              <i />
            </span>
          )}
        </div>
      </div>
      <dl className="photo-stage__meta">
        <div>
          <dt>Size</dt>
          <dd>
            {photo.getWidth()} × {photo.getHeight()}
          </dd>
        </div>
        <div>
          <dt>Visibility</dt>
          <dd>{VISIBILITY_LABELS[visibility]}</dd>
        </div>
        {camera && (
          <div>
            <dt>Camera</dt>
            <dd>{camera}</dd>
          </div>
        )}
        <div>
          <dt>Published</dt>
          <dd>{formatDate(photo.getCreatedAt())}</dd>
        </div>
        <Link href={`/photo/${photo.getId()}`} target="_blank">
          Open in viewer ↗
        </Link>
      </dl>
    </section>
  );
}

// Four corners of a small copy of the photo: the title sits in the chosen one.
function TitleCorner({
  photo,
  value,
  onChange,
}: {
  photo: Photo;
  value: PhotoTitlePosition;
  onChange: (value: PhotoTitlePosition) => void;
}) {
  const name = useId();
  return (
    <fieldset
      className="title-corner"
      role="radiogroup"
      aria-label="Title corner in the viewer"
    >
      <legend>Title corner in the viewer</legend>
      <div
        className="title-corner__photo"
        style={{ aspectRatio: `${photo.getAspectRatio()}` }}
      >
        <PhotoImage
          photo={photo}
          maxWidth={320}
          fallbackSizes="180px"
          className="object-cover"
        />
        {PHOTO_TITLE_POSITIONS.map((position) => (
          <label
            key={position}
            className={`title-corner__spot title-corner__spot--${position.toLowerCase().replace("_", "-")}`}
            title={TITLE_POSITION_LABELS[position]}
          >
            <input
              type="radio"
              name={name}
              value={position}
              aria-label={TITLE_POSITION_LABELS[position]}
              checked={value === position}
              onChange={() => onChange(position)}
            />
            <span aria-hidden="true">Aa</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// The corner's name in class and data attributes: "bottom-left".
const cornerName = (position: PhotoTitlePosition) =>
  position.toLowerCase().replace("_", "-");

// Where the viewer shows the variant thumbnails: any corner but the title's, or
// Automatic, the other end of the title's edge.
function VariantCorner({
  photo,
  title,
  value,
  onChange,
}: {
  photo: Photo;
  title: PhotoTitlePosition;
  value: PhotoVariantPosition;
  onChange: (value: PhotoVariantPosition) => void;
}) {
  const name = useId();
  const automatic = automaticVariantCorner(title);
  return (
    <fieldset
      className="title-corner"
      role="radiogroup"
      aria-label="Variant thumbnails in the viewer"
    >
      <legend>Variant thumbnails in the viewer</legend>
      <div
        className="title-corner__photo"
        style={{ aspectRatio: `${photo.getAspectRatio()}` }}
      >
        <PhotoImage
          photo={photo}
          maxWidth={320}
          fallbackSizes="180px"
          className="object-cover"
        />
        {PHOTO_TITLE_POSITIONS.map((position) => {
          const taken = position === title;
          const label = TITLE_POSITION_LABELS[position];
          return (
            <label
              key={position}
              className={`title-corner__spot title-corner__spot--variants title-corner__spot--${cornerName(position)}`}
              data-taken={taken ? "" : undefined}
              data-automatic={!value && position === automatic ? "" : undefined}
              title={taken ? `${label}: the title is here` : label}
            >
              <input
                type="radio"
                name={name}
                value={position}
                aria-label={taken ? `${label} (taken by the title)` : label}
                checked={value === position}
                disabled={taken}
                onChange={() => onChange(position)}
              />
              <span aria-hidden="true">{taken ? "Aa" : "▪▪▪"}</span>
            </label>
          );
        })}
      </div>
      <label className="title-corner__automatic">
        <input
          type="radio"
          name={name}
          value=""
          checked={value === null}
          onChange={() => onChange(null)}
        />
        Automatic
        <small>
          {TITLE_POSITION_LABELS[automatic].toLowerCase()}, across from the
          title
        </small>
      </label>
    </fieldset>
  );
}
