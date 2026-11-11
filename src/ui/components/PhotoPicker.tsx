"use client";
import "./catalogStudio.css";
import "./photoBrowser.css";
import { ReactNode, useId, useState } from "react";
import { Catalog } from "@/src/domain/entities/Catalog";
import { Photo } from "@/src/domain/entities/Photo";
import { PhotoImage } from "./PhotoImage";
import { filterPhotos, PhotoFilters, usePhotoFilter } from "./PhotoFilters";
import { VisibilityBadge } from "./PhotoBadges";
import { FoldablePart, readFolded, writeFolded } from "@/src/ui/photoSectionPreference";

/**
 * The library as a strip of square thumbnails to add from, drawn as the Photos tab's
 * filmstrip: the same card, filters, count, fold button and thumbnails. Thumbnails
 * load lazily as the strip scrolls and never ask for more than a 160-pixel rendition.
 * Collections, Posts and Home's slides add from it.
 */
export function PhotoPicker({
  photos,
  catalog,
  onPick,
  heading = "Add photos",
  addLabel = (photo) => `Add ${photo.getTitle()}`,
  disabled = false,
  disabledTitle,
  loading = false,
  emptyText = "Every photo is already in this collection.",
  children,
  placedIds = [],
  preferenceKey = "photoPickerFolded",
}: {
  placedIds?: string[];
  preferenceKey?: FoldablePart;
  photos: Photo[];
  catalog?: Catalog | null;
  onPick: (photo: Photo) => void;
  /** The card's title, which also names the region. */
  heading?: string;
  /** The accessible name of each thumbnail. */
  addLabel?: (photo: Photo) => string;
  /** Nothing can be added now, as when Home already has eight slides. */
  disabled?: boolean;
  /** Why, shown as the thumbnails' tooltip while disabled. */
  disabledTitle?: string;
  loading?: boolean;
  /** Said when there are no photos left to add at all. */
  emptyText?: string;
  /** A note under the strip. */
  children?: ReactNode;
}) {
  const [filter, setFilter] = usePhotoFilter();
  const [folded, setFolded] = useState(() => readFolded(preferenceKey));
  const stripId = useId();
  const shown = filterPhotos(photos, filter, catalog);
  const fold = (next: boolean) => {
    setFolded(next);
    writeFolded(preferenceKey, next);
  };
  return (
    <section
      className="studio-card photo-studio__library photo-picker"
      aria-label={heading}
      data-folded={folded ? "" : undefined}
    >
      <div className="photo-studio__toolbar">
        <h4 className="photo-picker__heading">{heading}</h4>
        <button
          type="button"
          className="photo-studio__fold"
          aria-expanded={!folded}
          aria-controls={stripId}
          title={
            folded
              ? "Show the strip of photos"
              : "Fold the strip of photos away"
          }
          onClick={() => fold(!folded)}
        >
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
            <path
              d={folded ? "M5 8l5 5 5-5" : "M5 12l5-5 5 5"}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {folded ? "Show photos" : "Hide photos"}
        </button>
        <PhotoFilters
          label="Photos to add"
          photos={photos}
          catalog={catalog}
          filter={filter}
          onChange={setFilter}
        />
        <p className="photo-library-count" aria-live="polite">
          {shown.length} of {photos.length}{" "}
          {photos.length === 1 ? "photo" : "photos"}
        </p>
      </div>
      <div id={stripId} className="photo-picker__body" hidden={folded}>
        {loading ? (
          <p className="upload-muted" role="status">
            Loading photographs…
          </p>
        ) : shown.length ? (
          <ul className="photo-browser photo-browser--strip photo-picker__strip">
            {shown.map((photo) => (
              <li key={photo.getId()}>
                <button
                  type="button"
                  className="photo-browser__item photo-picker__item"
                  aria-label={addLabel(photo)}
                  title={
                    disabled && disabledTitle ? disabledTitle : addLabel(photo)
                  }
                  disabled={disabled}
                  onClick={() => onPick(photo)}
                >
                  <span className="photo-browser__thumb">
                    <PhotoImage
                      photo={photo}
                      className="object-cover"
                      fallbackSizes="84px"
                      maxWidth={160}
                      crop={photo.getHighlights().square}
                    />
                    <span className="photo-browser__badges" aria-hidden="true">
                      <VisibilityBadge
                        visibility={photo.getClassification().visibility}
                      />
                    </span>
                    <span className="photo-picker__plus" aria-hidden="true">
                      {placedIds.includes(photo.getId()) ? "✓" : "+"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="upload-muted">
            {photos.length ? "No photos match these filters." : emptyText}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}
