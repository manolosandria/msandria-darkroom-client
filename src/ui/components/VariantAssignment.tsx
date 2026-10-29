"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Catalog } from "@/src/domain/entities/Catalog";
import { Photo } from "@/src/domain/entities/Photo";
import { manageCatalog } from "@/src/infrastructure/catalogServices";
import { getManagedPhotos } from "@/src/infrastructure/photoServices";
import { assignPhotoVariant } from "@/src/application/use-cases/AssignPhotoVariant";
import { PhotoImage } from "./PhotoImage";
import { filterPhotos } from "./PhotoFilters";
import "./catalogStudio.css";
export function VariantAssignment({
  photoId,
  title,
  targetId = "",
  onTargetChange,
  disabled = false,
  inline = false,
}: {
  photoId?: string;
  title: string;
  targetId?: string;
  onTargetChange?: (id: string) => void;
  disabled?: boolean;
  /** Shown open inside another disclosure, loading as soon as it mounts. */
  inline?: boolean;
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [selection, setSelection] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const name = useId();
  const requested = useRef(false);
  async function load() {
    requested.current = true;
    setBusy(true);
    setError("");
    try {
      const [next, list] = await Promise.all([
        manageCatalog.load(),
        getManagedPhotos.execute(),
      ]);
      setCatalog(next);
      setPhotos(list ?? []);
    } catch {
      setError("Could not load variants. Try again.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (inline && !requested.current) void load();
  }, [inline]);
  const own = catalog?.works.find((work) =>
    work.variants.some((v) => v.photoId === photoId),
  );
  const chosen = onTargetChange ? targetId : selection;
  const choose = (id: string) => {
    setNotice("");
    if (onTargetChange) onTargetChange(id);
    else setSelection(id);
  };
  const candidates = filterPhotos(
    photos.filter((p) => p.getId() !== photoId),
    { query, categoryId: "", camera: "" },
  );
  const content = (
    <>
      {busy && <p role="status">Loading…</p>}
      {error && (
        <p role="alert">
          {error}{" "}
          <button type="button" onClick={load}>
            Retry variants
          </button>
        </p>
      )}
      {own ? (
        <>
          <strong>{own.title}</strong>
          <div className="variant-library">
            {own.variants.map((v) => {
              const photo = photos.find((p) => p.getId() === v.photoId);
              return (
                photo && (
                  <div
                    className="variant-card"
                    key={v.photoId}
                    data-current={v.photoId === photoId ? "" : undefined}
                  >
                    <span className="variant-card__image">
                      <PhotoImage
                        photo={photo}
                        maxWidth={160}
                        fallbackSizes="140px"
                        className="object-cover"
                      />
                    </span>
                    <small>{photo.getTitle()}</small>
                  </div>
                )
              );
            })}
          </div>
          <p className="upload-muted">
            Manage the whole group in Curator → Variants.
          </p>
        </>
      ) : (
        <>
          <div className="variant-picker__header">
            <span>Variant of</span>
            <input
              type="search"
              aria-label="Search photos to group with"
              placeholder="Search by title…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div
            className="variant-picker"
            role="radiogroup"
            aria-label="Variant of"
          >
            <label className="variant-picker__item">
              <input
                type="radio"
                name={name}
                disabled={disabled || busy || !catalog}
                checked={!chosen}
                onChange={() => choose("")}
              />
              <span className="variant-picker__thumb variant-picker__none" aria-hidden="true">
                ⊘
              </span>
              <small>Standalone photograph</small>
            </label>
            {candidates.map((photo) => (
              <label className="variant-picker__item" key={photo.getId()}>
                <input
                  type="radio"
                  name={name}
                  disabled={disabled || busy || !catalog}
                  aria-label={photo.getTitle()}
                  checked={chosen === photo.getId()}
                  onChange={() => choose(photo.getId())}
                />
                <span className="variant-picker__thumb">
                  <PhotoImage
                    photo={photo}
                    maxWidth={160}
                    fallbackSizes="96px"
                    className="object-cover"
                    crop={photo.getHighlights().square}
                  />
                </span>
                <small>{photo.getTitle()}</small>
              </label>
            ))}
          </div>
          {!photoId && (
            <p className="upload-muted">
              Choose an existing photo. Its group is extended after this file
              uploads.
            </p>
          )}
          {photoId && (
            <button
              type="button"
              className="variant-picker__save"
              disabled={disabled || busy || !chosen}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await assignPhotoVariant(
                    manageCatalog,
                    photoId,
                    chosen,
                    title,
                  );
                  setSelection("");
                  setNotice("Variants saved.");
                  window.dispatchEvent(new Event("curator:catalog-changed"));
                  await load();
                } catch (failure) {
                  setError(
                    failure instanceof Error
                      ? failure.message
                      : "Could not save variants.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save variant assignment
            </button>
          )}
        </>
      )}
      {notice && <p role="status">{notice}</p>}
    </>
  );
  return inline ? (
    <div className="variant-assignment variant-assignment--inline">{content}</div>
  ) : (
    <details
      className="variant-assignment"
      onToggle={(event) => {
        if (event.currentTarget.open && !catalog && !busy) void load();
      }}
    >
      <summary>
        Variants{" "}
        {targetId ? "· assigned on upload" : "· group another interpretation"}
      </summary>
      {content}
    </details>
  );
}
