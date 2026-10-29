"use client";
import "./catalogStudio.css";
import "./photoStudio.css";
import { useEffect, useRef, useState } from "react";
import { Catalog, WorkDraft } from "@/src/domain/entities/Catalog";
import { Photo } from "@/src/domain/entities/Photo";
import { uploadPhoto } from "@/src/infrastructure/photoServices";
import { apiFailureMessage } from "@/src/ui/apiFailureMessage";
import { PhotoImage } from "./PhotoImage";
import { filterPhotos, PhotoFilters, usePhotoFilter } from "./PhotoFilters";

// The type a dragged library photo carries, so files and photos never mix up.
const PHOTO_DRAG = "application/x-darkroom-photo";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const fileTitle = (file: File) =>
  file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Variant";

/**
 * Works on the left, the open work as a large drop zone in the middle and the photo
 * library below: drag a photo in, click its plus, or drop image files to upload them.
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
  const [over, setOver] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadNotice, setUploadNotice] = useState("");
  // Fresh uploads show at once, before the reloaded listing includes them.
  const [uploaded, setUploaded] = useState<Photo[]>([]);
  const photos = [
    ...listed,
    ...uploaded.filter(
      (photo) => !listed.some((item) => item.getId() === photo.getId()),
    ),
  ];
  // Uploads run across renders; each one appends to the newest draft, not a stale one.
  const latest = useRef(work);
  useEffect(() => {
    latest.current = work;
  }, [work]);
  function change(next: WorkDraft) {
    latest.current = next;
    onChange(next);
  }
  const groupOf = (photoId: string) =>
    catalog.works.find(
      (item) =>
        item.id !== workId &&
        item.variants.some((variant) => variant.photoId === photoId),
    );
  const members = work.photoIds
    .map((id) => photos.find((photo) => photo.getId() === id))
    .filter((photo): photo is Photo => Boolean(photo));
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
  // New files share the work's visibility so a private work never gains a public file.
  async function upload(files: File[]) {
    const images = files.filter((file) => IMAGE_TYPES.includes(file.type));
    if (!images.length) {
      setUploadError("Drop JPEG, PNG or WebP images.");
      return;
    }
    const visibility =
      members[0]?.getClassification().visibility ?? "PUBLIC";
    setUploadError("");
    setUploadNotice("");
    let done = 0;
    for (const file of images) {
      setUploading(file.name);
      try {
        const published = await uploadPhoto.execute({
          file,
          title: latest.current.title.trim() || fileTitle(file),
          visibility,
          categoryNames: [],
          collections: [],
        });
        setUploaded((previous) => [...previous, published.photo]);
        const current = latest.current;
        change({
          ...current,
          title: current.title || published.photo.getTitle(),
          photoIds: [...current.photoIds, published.photo.getId()],
        });
        done++;
        window.dispatchEvent(new Event("curator:catalog-changed"));
      } catch (failure) {
        setUploadError(`${file.name}: ${apiFailureMessage(failure)}`);
        break;
      }
    }
    setUploading(null);
    if (done)
      setUploadNotice(
        `${done} ${done === 1 ? "file uploaded" : "files uploaded"}. Save variants to group ${done === 1 ? "it" : "them"}.`,
      );
  }
  const library = filterPhotos(photos, filter, catalog);
  const disabled = busy || Boolean(uploading);
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
          const cover = photos.find(
            (photo) => photo.getId() === item.variants[0]?.photoId,
          );
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
        <div
          className="variant-studio__drop"
          data-over={over ? "" : undefined}
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
              void upload([...event.dataTransfer.files]);
          }}
        >
          {members.length === 0 && (
            <p className="variant-studio__hint">
              Drag photos here from the library below, or drop image files to
              upload them as new variants.
            </p>
          )}
          {members.map((photo, index) => (
            <figure key={photo.getId()} className="variant-studio__member">
              <span className="variant-studio__member-image">
                <PhotoImage
                  photo={photo}
                  maxWidth={640}
                  fallbackSizes="240px"
                  className="object-contain"
                />
                {index === 0 && (
                  <span className="variant-studio__cover-badge">Cover</span>
                )}
              </span>
              <figcaption>
                <span>{photo.getTitle()}</span>
                <button
                  type="button"
                  aria-label={`Remove ${photo.getTitle()} from this work`}
                  onClick={() => remove(photo.getId())}
                >
                  ×
                </button>
              </figcaption>
            </figure>
          ))}
          {uploading && (
            <p role="status" className="variant-studio__uploading">
              Uploading {uploading}…
            </p>
          )}
        </div>
        {uploadError && <p role="alert">{uploadError}</p>}
        {uploadNotice && <p role="status">{uploadNotice}</p>}
        <div className="variant-studio__actions">
          <label className="variant-studio__upload">
            Upload files…
            <input
              type="file"
              className="sr-only"
              multiple
              accept={IMAGE_TYPES.join(",")}
              disabled={disabled}
              onChange={(event) => {
                const files = [...(event.target.files ?? [])];
                event.target.value = "";
                if (files.length) void upload(files);
              }}
            />
          </label>
          <span className="variant-studio__count">
            {work.photoIds.length} selected · two or more make a work
          </span>
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
            disabled={disabled || work.photoIds.length < 2}
          >
            Save variants
          </button>
        </div>
      </form>
      <section className="variant-studio__library" aria-label="Photo library">
        <div className="photo-picker__header">
          <h4>Library</h4>
          <PhotoFilters
            label="Variant library"
            photos={photos}
            catalog={catalog}
            filter={filter}
            onChange={setFilter}
          />
        </div>
        <ul className="variant-studio__strip">
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
                      maxWidth={160}
                      fallbackSizes="96px"
                      className="object-cover"
                      crop={photo.getHighlights().square}
                    />
                    <span className="variant-studio__pick-mark" aria-hidden="true">
                      {chosen ? "✓" : grouped ? "⛓" : "+"}
                    </span>
                  </span>
                  <small>
                    {photo.getTitle()}
                    {grouped && ` (in ${grouped.title})`}
                  </small>
                </label>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
