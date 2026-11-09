"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Catalog } from "@/src/domain/entities/Catalog";
import { Photo } from "@/src/domain/entities/Photo";
import { manageCatalog } from "@/src/infrastructure/catalogServices";
import { getManagedPhotos } from "@/src/infrastructure/photoServices";
import { assignPhotoVariant } from "@/src/application/use-cases/AssignPhotoVariant";
import { PhotoImage } from "./PhotoImage";
import { VisibilityBadge } from "./PhotoBadges";
import { filterPhotos, PhotoFilters, usePhotoFilter } from "./PhotoFilters";
import "./catalogStudio.css";
import "./photoBrowser.css";
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
  const [filter, setFilter] = usePhotoFilter();
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
  const others = photos.filter((p) => p.getId() !== photoId);
  const candidates = filterPhotos(others, filter, catalog);
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
          <ul className="photo-browser photo-browser--strip">
            {own.variants.map((v) => {
              const photo = photos.find((p) => p.getId() === v.photoId);
              return (
                photo && (
                  <li
                    key={v.photoId}
                    className="photo-browser__item"
                    title={photo.getTitle()}
                    aria-current={v.photoId === photoId ? "true" : undefined}
                  >
                    <span className="photo-browser__thumb">
                      <PhotoImage
                        photo={photo}
                        maxWidth={160}
                        fallbackSizes="84px"
                        className="object-cover"
                        crop={photo.getHighlights().square}
                      />
                    </span>
                    <span className="sr-only">{photo.getTitle()}</span>
                  </li>
                )
              );
            })}
          </ul>
          <p className="upload-muted">
            Manage the whole group in Curator → Variants.
          </p>
        </>
      ) : (
        <>
          <div className="variant-picker__header">
            <span>Variant of</span>
            <PhotoFilters
              label="Photos to group with"
              photos={others}
              catalog={catalog}
              filter={filter}
              onChange={setFilter}
            />
          </div>
          <div
            className="photo-browser photo-browser--strip variant-picker"
            role="radiogroup"
            aria-label="Variant of"
          >
            <label
              className="photo-browser__item"
              title="Standalone photograph"
            >
              <input
                type="radio"
                className="sr-only"
                name={name}
                disabled={disabled || busy || !catalog}
                checked={!chosen}
                onChange={() => choose("")}
              />
              <span
                className="photo-browser__thumb variant-picker__none"
                aria-hidden="true"
              >
                ⊘
              </span>
              <span className="sr-only">Standalone photograph</span>
            </label>
            {candidates.map((photo) => (
              <label
                className="photo-browser__item"
                key={photo.getId()}
                title={photo.getTitle()}
              >
                <input
                  type="radio"
                  className="sr-only"
                  name={name}
                  disabled={disabled || busy || !catalog}
                  aria-label={photo.getTitle()}
                  checked={chosen === photo.getId()}
                  onChange={() => choose(photo.getId())}
                />
                <span className="photo-browser__thumb">
                  <PhotoImage
                    photo={photo}
                    maxWidth={160}
                    fallbackSizes="84px"
                    className="object-cover"
                    crop={photo.getHighlights().square}
                  />
                  <span className="photo-browser__badges" aria-hidden="true">
                    <VisibilityBadge
                      visibility={photo.getClassification().visibility}
                    />
                  </span>
                </span>
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
    <div className="variant-assignment variant-assignment--inline">
      {content}
    </div>
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
