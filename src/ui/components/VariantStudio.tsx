"use client";
import "./catalogStudio.css";
import "./photoStudio.css";
import { useEffect, useId, useRef, useState } from "react";
import { Catalog, WorkDraft } from "@/src/domain/entities/Catalog";
import { Photo, PhotoVisibility } from "@/src/domain/entities/Photo";
import { useLiveSort } from "@/src/ui/hooks/useLiveSort";
import { PhotoImage } from "./PhotoImage";
import { filterPhotos, PhotoFilters, usePhotoFilter } from "./PhotoFilters";
import {
  useVariantUploads,
  VARIANT_IMAGE_TYPES,
  VariantUploadQueue,
} from "./VariantUploads";

// The type a dragged library photo carries, so files and photos never mix up.
const PHOTO_DRAG = "application/x-darkroom-photo";

type LibraryView = "grid" | "list" | "strip";
const LIBRARY_VIEWS: { value: LibraryView; label: string }[] = [
  { value: "grid", label: "Grid" },
  { value: "list", label: "List" },
  { value: "strip", label: "Filmstrip" },
];

const VISIBILITY_LABELS: Record<PhotoVisibility, string> = {
  PUBLIC: "Public",
  COLLECTIONS_ONLY: "Collections only",
  POSTS_ONLY: "Posts only",
  PRIVATE: "Private",
  SELECT: "Select",
};

/**
 * Works on the left, the open work in the middle and the photo library below. Photos
 * join the work by dragging them in, ticking them in the library, or through the plus,
 * which opens the file browser and takes dropped files: each file becomes a card with
 * its title, description, classification and highlights, and uploads from there. The
 * work's photos reorder by dragging (or arrow keys), and the first one is the main one.
 */
export function VariantStudio({
  catalog,
  photos: listed,
  busy,
  workId,
  work,
  onOpen,
  onChange,
  onSave,
  onUngroup,
}: {
  catalog: Catalog;
  photos: Photo[];
  busy: boolean;
  workId: string;
  work: WorkDraft;
  onOpen: (workId: string) => void;
  onChange: (work: WorkDraft) => void;
  onSave: () => void;
  onUngroup: () => void;
}) {
  const [filter, setFilter] = usePhotoFilter();
  const [view, setView] = useState<LibraryView>("grid");
  const viewName = useId();
  const [over, setOver] = useState(false);
  const [dropError, setDropError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  // Fresh uploads show at once, before the reloaded listing includes them.
  const [uploaded, setUploaded] = useState<Photo[]>([]);
  const photos = [
    ...listed,
    ...uploaded.filter(
      (photo) => !listed.some((item) => item.getId() === photo.getId()),
    ),
  ];
  // Uploads finish across renders; each one joins the newest draft, not a stale one.
  const latest = useRef(work);
  useEffect(() => {
    latest.current = work;
  }, [work]);
  function change(next: WorkDraft) {
    latest.current = next;
    onChange(next);
  }
  const uploads = useVariantUploads((photo) => {
    setUploaded((previous) => [...previous, photo]);
    const current = latest.current;
    if (current.photoIds.includes(photo.getId())) return;
    change({
      ...current,
      title: current.title || photo.getTitle(),
      photoIds: [...current.photoIds, photo.getId()],
    });
  });
  const groupOf = (photoId: string) =>
    catalog.works.find(
      (item) =>
        item.id !== workId &&
        item.variants.some((variant) => variant.photoId === photoId),
    );
  const photoOf = (id: string) => photos.find((photo) => photo.getId() === id);
  const members = work.photoIds
    .map(photoOf)
    .filter((photo): photo is Photo => Boolean(photo));
  const memberIds = members.map((photo) => photo.getId());
  // New files start with the visibility of the work's main photo, so a private work
  // does not gain a public file unless the curator says so.
  const workVisibility: PhotoVisibility =
    members[0]?.getClassification().visibility ?? "PUBLIC";

  function add(photoId: string) {
    const current = latest.current;
    if (current.photoIds.includes(photoId) || groupOf(photoId)) return;
    change({ ...current, photoIds: [...current.photoIds, photoId] });
  }
  function remove(photoId: string) {
    const current = latest.current;
    change({
      ...current,
      photoIds: current.photoIds.filter((id) => id !== photoId),
    });
  }
  // The order of the work's photos; ids the listing has not loaded keep their place
  // at the end.
  function reorder(ids: string[]) {
    const current = latest.current;
    change({
      ...current,
      photoIds: [
        ...ids,
        ...current.photoIds.filter((id) => !ids.includes(id)),
      ],
    });
  }
  function moveTo(from: number, to: number) {
    const ids = [...memberIds];
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    reorder(ids);
    setAnnouncement(
      `${photoOf(moved)?.getTitle() ?? "Photo"} moved to place ${to + 1} of ${ids.length}.`,
    );
  }
  function makeMain(photoId: string) {
    reorder([photoId, ...memberIds.filter((id) => id !== photoId)]);
    setAnnouncement(`${photoOf(photoId)?.getTitle() ?? "Photo"} is now the main variant.`);
  }
  function addFiles(files: File[]) {
    const { added, refused } = uploads.add(files, {
      title: latest.current.title,
      classification: {
        visibility: workVisibility,
        categoryNames: [],
        collections: [],
      },
    });
    setDropError(
      !added && refused.length
        ? "Drop JPEG, PNG or WebP images."
        : refused.length
          ? `Left out: ${refused.join(", ")}. Drop JPEG, PNG or WebP images up to 10 MB.`
          : "",
    );
  }

  const disabled = busy;
  const { order, dragging, attachList, attachItem, itemStyle, gripProps, takeDrop } =
    useLiveSort({ keys: memberIds, onMove: moveTo, disabled });
  const library = filterPhotos(photos, filter, catalog);
  const filePicker = (
    <input
      ref={picker}
      type="file"
      className="sr-only"
      multiple
      accept={VARIANT_IMAGE_TYPES.join(",")}
      disabled={disabled}
      onChange={(event) => {
        const files = [...(event.target.files ?? [])];
        event.target.value = "";
        if (files.length) addFiles(files);
      }}
    />
  );
  return (
    <div className="variant-studio">
      <aside className="variant-studio__works" aria-label="Works">
        <button
          type="button"
          className="variant-studio__work"
          aria-pressed={!workId}
          onClick={() => onOpen("")}
        >
          <span className="variant-studio__work-cover variant-card__new">＋</span>
          <span>
            <strong>New work</strong>
            <small>Bring photographs together</small>
          </span>
        </button>
        {catalog.works.map((item) => {
          const cover = photoOf(item.variants[0]?.photoId ?? "");
          return (
            <button
              type="button"
              key={item.id}
              className="variant-studio__work"
              aria-pressed={workId === item.id}
              onClick={() => onOpen(item.id)}
            >
              <span className="variant-studio__work-cover">
                {cover && (
                  <PhotoImage
                    photo={cover}
                    maxWidth={320}
                    fallbackSizes="64px"
                    className="object-cover"
                  />
                )}
              </span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.variants.length} variants</small>
              </span>
            </button>
          );
        })}
      </aside>
      <form
        className="variant-studio__editor"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <div className="variant-studio__head">
          <label className="variant-studio__title">
            Work title
            <input
              required
              maxLength={160}
              value={work.title}
              placeholder="Name the work"
              onChange={(event) => onChange({ ...work, title: event.target.value })}
            />
          </label>
          <span className="variant-studio__count" aria-live="polite">
            <strong>{work.photoIds.length}</strong> selected · two or more make
            a work
          </span>
        </div>
        <div
          className="variant-studio__drop"
          data-over={over ? "" : undefined}
          data-empty={members.length ? undefined : ""}
          aria-label="Variants of this work"
          role="group"
          onDragOver={(event) => {
            if (disabled) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            setOver(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node))
              setOver(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setOver(false);
            if (disabled) return;
            const photoId = event.dataTransfer.getData(PHOTO_DRAG);
            if (photoId) add(photoId);
            else if (event.dataTransfer.files.length)
              addFiles([...event.dataTransfer.files]);
          }}
        >
          <ol
            ref={attachList}
            className={`variant-studio__members${dragging ? " is-sorting" : ""}`}
            aria-label="Variant order"
          >
            {order.map((id, index) => {
              const photo = photoOf(id)!;
              const main = index === 0;
              return (
                <li
                  key={id}
                  ref={attachItem(id)}
                  className={`variant-studio__member${dragging === id ? " is-dragged" : ""}`}
                  style={itemStyle(id)}
                >
                  <button
                    type="button"
                    className="variant-studio__member-image"
                    aria-label={`${photo.getTitle()}, variant ${index + 1} of ${order.length}${main ? ", main" : ""}. Drag or use the arrow keys to reorder.`}
                    title="Drag or use the arrow keys to reorder"
                    disabled={disabled}
                    {...gripProps(id)}
                    onClick={() => takeDrop()}
                  >
                    <PhotoImage
                      photo={photo}
                      maxWidth={640}
                      fallbackSizes="240px"
                      className="object-contain"
                    />
                    <span className="variant-studio__order" aria-hidden="true">
                      {index + 1}
                    </span>
                    {main && (
                      <span className="variant-studio__cover-badge">★ Main</span>
                    )}
                  </button>
                  <div className="variant-studio__member-caption">
                    <span>{photo.getTitle()}</span>
                    <button
                      type="button"
                      className="variant-studio__star"
                      aria-pressed={main}
                      aria-label={
                        main
                          ? `${photo.getTitle()} is the main variant`
                          : `Make ${photo.getTitle()} the main variant`
                      }
                      title={main ? "Main variant" : "Make main"}
                      disabled={disabled || main}
                      onClick={() => makeMain(id)}
                    >
                      {main ? "★" : "☆"}
                    </button>
                    <button
                      type="button"
                      className="variant-studio__remove"
                      aria-label={`Remove ${photo.getTitle()} from this work`}
                      disabled={disabled}
                      onClick={() => remove(id)}
                    >
                      ×
                    </button>
                  </div>
                </li>
              );
            })}
            <li className="variant-studio__add-slot">
              <button
                type="button"
                className="variant-studio__add"
                disabled={disabled}
                onClick={() => picker.current?.click()}
                aria-label="Add variants: choose image files, or drop files or library photos here"
              >
                <span className="studio-collection-plus" aria-hidden="true">
                  <span />
                </span>
                <strong>{over ? "Drop to add" : "Add variants"}</strong>
                <small>
                  {members.length
                    ? "Drop files or library photos, or browse"
                    : "Drop image files or photos from the library below, or click to browse"}
                </small>
              </button>
            </li>
          </ol>
        </div>
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
        {dropError && <p role="alert">{dropError}</p>}
        <VariantUploadQueue uploads={uploads} workVisibility={workVisibility} />
        <div className="variant-studio__actions">
          <label className="variant-studio__upload">
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4M12 4v11M7 9l5-5 5 5" />
            </svg>
            <span>Upload files…</span>
            {filePicker}
          </label>
          {workId && (
            <button
              type="button"
              className="studio-danger"
              disabled={disabled}
              onClick={onUngroup}
            >
              Ungroup variants
            </button>
          )}
          <button
            className="studio-save"
            disabled={disabled || uploads.running || work.photoIds.length < 2}
          >
            Save variants
          </button>
        </div>
      </form>
      <section className="variant-studio__library" aria-label="Photo library">
        <header className="variant-studio__library-head">
          <div className="variant-studio__library-title">
            <h4>Library</h4>
            <small>
              {library.length} of {photos.length}
            </small>
          </div>
          <PhotoFilters
            label="Variant library"
            photos={photos}
            catalog={catalog}
            filter={filter}
            onChange={setFilter}
          />
          <fieldset
            className="photo-studio__views"
            role="radiogroup"
            aria-label="Library view"
          >
            {LIBRARY_VIEWS.map((option) => (
              <label key={option.value} title={option.label}>
                <input
                  type="radio"
                  name={viewName}
                  checked={view === option.value}
                  onChange={() => setView(option.value)}
                />
                <ViewIcon view={option.value} />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>
        </header>
        {library.length === 0 ? (
          <p className="variant-studio__library-empty">
            {photos.length ? "No photos match the search." : "No photos yet."}
          </p>
        ) : (
          <ul className={`variant-library variant-library--${view}`}>
            {library.map((photo) => {
              const grouped = groupOf(photo.getId());
              const chosen = work.photoIds.includes(photo.getId());
              return (
                <li
                  key={photo.getId()}
                  draggable={!grouped && !chosen && !disabled}
                  data-state={grouped ? "grouped" : chosen ? "chosen" : undefined}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(PHOTO_DRAG, photo.getId());
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                >
                  <label className="variant-studio__pick">
                    <input
                      type="checkbox"
                      disabled={Boolean(grouped) || disabled}
                      checked={chosen}
                      onChange={() =>
                        chosen ? remove(photo.getId()) : add(photo.getId())
                      }
                    />
                    <span className="variant-studio__pick-image">
                      <PhotoImage
                        photo={photo}
                        maxWidth={view === "grid" ? 320 : 160}
                        fallbackSizes={view === "grid" ? "160px" : "96px"}
                        className="object-cover"
                        crop={photo.getHighlights().square}
                      />
                      <span className="variant-studio__pick-mark" aria-hidden="true">
                        {chosen ? "✓" : grouped ? "⛓" : "+"}
                      </span>
                    </span>
                    <span className="variant-studio__pick-text">
                      <small>
                        {photo.getTitle()}
                        {grouped && view !== "list" && ` (in ${grouped.title})`}
                      </small>
                      {view === "list" && (
                        <>
                          <span className="variant-studio__pick-meta">
                            {VISIBILITY_LABELS[photo.getClassification().visibility]}
                          </span>
                          <span className="variant-studio__pick-meta">
                            {grouped
                              ? `In ${grouped.title}`
                              : chosen
                                ? "In this work"
                                : "Free"}
                          </span>
                        </>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function ViewIcon({ view }: { view: LibraryView }) {
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
      ) : view === "list" ? (
        <>
          <rect x="2.5" y="3" width="4" height="4" />
          <path d="M9 5h9" />
          <rect x="2.5" y="13" width="4" height="4" />
          <path d="M9 15h9" />
        </>
      ) : (
        <>
          <rect x="1.5" y="6" width="5" height="8" />
          <rect x="7.5" y="6" width="5" height="8" />
          <rect x="13.5" y="6" width="5" height="8" />
        </>
      )}
    </svg>
  );
}
