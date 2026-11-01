"use client";
import { useId, useState } from "react";
import { Catalog } from "@/src/domain/entities/Catalog";
import { Photo } from "@/src/domain/entities/Photo";
import { ChoiceMenu } from "./ChoiceMenu";

export type PhotoFilter = { query: string; categoryId: string; camera: string };

const EMPTY: PhotoFilter = { query: "", categoryId: "", camera: "" };

// Case and accents are ignored, so "cafe" finds "Café".
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function cameraName(photo: Photo) {
  const camera = photo.getMetadata().camera;
  if (!camera?.model) return camera?.make ?? "";
  // Many models already start with the brand ("Canon EOS R6"); do not repeat it.
  return camera.make && !fold(camera.model).startsWith(fold(camera.make))
    ? `${camera.make} ${camera.model}`
    : camera.model;
}

export function filterPhotos(
  photos: Photo[],
  filter: PhotoFilter,
  catalog?: Catalog | null,
) {
  const words = fold(filter.query).split(/\s+/).filter(Boolean);
  const inCategory = new Set(
    catalog?.photos
      .filter((photo) =>
        photo.categories.some((category) => category.id === filter.categoryId),
      )
      .map((photo) => photo.id),
  );
  return photos.filter((photo) => {
    const title = fold(photo.getTitle());
    return (
      words.every((word) => title.includes(word)) &&
      (!filter.categoryId || inCategory.has(photo.getId())) &&
      (!filter.camera || cameraName(photo) === filter.camera)
    );
  });
}

export function usePhotoFilter() {
  return useState<PhotoFilter>(EMPTY);
}

/** Text search plus category and, where photos carry it, camera filters. */
export function PhotoFilters({
  photos,
  catalog,
  filter,
  onChange,
  withCamera = false,
  label,
}: {
  photos: Photo[];
  catalog?: Catalog | null;
  filter: PhotoFilter;
  onChange: (filter: PhotoFilter) => void;
  withCamera?: boolean;
  label: string;
}) {
  const id = useId();
  const cameras = [...new Set(photos.map(cameraName).filter(Boolean))].sort();
  const active = filter.query || filter.categoryId || filter.camera;
  return (
    <div className="photo-filters" role="search" aria-label={label}>
      <label className="photo-filters__search">
        <span className="sr-only">Search {label.toLowerCase()}</span>
        <input
          type="search"
          id={`${id}-query`}
          placeholder="Search by title…"
          value={filter.query}
          onChange={(event) =>
            onChange({ ...filter, query: event.target.value })
          }
        />
      </label>
      <ChoiceMenu
        ariaLabel="Category"
        className="photo-filters__menu"
        value={filter.categoryId}
        onChange={(categoryId) => onChange({ ...filter, categoryId })}
        options={[
          { value: "", label: "All categories", icon: filterIcons.category },
          ...(catalog?.categories ?? []).map((category) => ({
            value: category.id,
            label: category.name,
          })),
        ]}
      />
      {withCamera && (
        <ChoiceMenu
          ariaLabel="Camera"
          className="photo-filters__menu"
          value={filter.camera}
          onChange={(camera) => onChange({ ...filter, camera })}
          options={[
            { value: "", label: "All cameras", icon: filterIcons.camera },
            ...cameras.map((camera) => ({ value: camera, label: camera })),
          ]}
        />
      )}
      {active && (
        <button
          type="button"
          className="photo-filters__clear"
          onClick={() => onChange(EMPTY)}
        >
          Clear
        </button>
      )}
    </div>
  );
}

const filterIcons = {
  category: (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    >
      <path d="M3 10V3h7l7 7-7 7zM7 7h.01" />
    </svg>
  ),
  camera: (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    >
      <path d="M3 7h3l1.5-2h5L14 7h3v9H3z" />
      <circle cx="10" cy="11.5" r="2.8" />
    </svg>
  ),
};
