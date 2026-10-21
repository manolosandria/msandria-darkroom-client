"use client";
import { useState } from "react";
import { Catalog } from "@/src/domain/entities/Catalog";
import { Photo } from "@/src/domain/entities/Photo";
import { manageCatalog } from "@/src/infrastructure/catalogServices";
import { getManagedPhotos } from "@/src/infrastructure/photoServices";
import { assignPhotoVariant } from "@/src/application/use-cases/AssignPhotoVariant";
import { PhotoImage } from "./PhotoImage";
import "./catalogStudio.css";
export function VariantAssignment({
  photoId,
  title,
  targetId = "",
  onTargetChange,
  disabled = false,
}: {
  photoId?: string;
  title: string;
  targetId?: string;
  onTargetChange?: (id: string) => void;
  disabled?: boolean;
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [selection, setSelection] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
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
  const own = catalog?.works.find((work) =>
    work.variants.some((v) => v.photoId === photoId),
  );
  const chosen = onTargetChange ? targetId : selection;
  return (
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
                  <div className="variant-card" key={v.photoId}>
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
          <label>
            Variant of
            <select
              disabled={disabled || busy || !catalog}
              value={chosen}
              onChange={(event) => {
                setNotice("");
                if (onTargetChange) onTargetChange(event.target.value);
                else setSelection(event.target.value);
              }}
            >
              <option value="">Standalone photograph</option>
              {photos
                .filter((p) => p.getId() !== photoId)
                .map((photo) => (
                  <option key={photo.getId()} value={photo.getId()}>
                    {photo.getTitle()}
                  </option>
                ))}
            </select>
          </label>
          {!photoId && (
            <p className="upload-muted">
              Choose an existing photo. Its group is extended after this file
              uploads.
            </p>
          )}
          {photoId && (
            <button
              type="button"
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
    </details>
  );
}
