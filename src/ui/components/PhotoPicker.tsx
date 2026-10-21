"use client";
import { Catalog } from "@/src/domain/entities/Catalog";
import { Photo } from "@/src/domain/entities/Photo";
import { PhotoImage } from "./PhotoImage";
import { filterPhotos, PhotoFilters, usePhotoFilter } from "./PhotoFilters";
import { isHiddenFromPublic } from "./CollectionCanvas";

/**
 * A horizontal strip of small thumbnails to add to a collection. Thumbnails load
 * lazily as the strip scrolls and never ask for more than a 160-pixel rendition.
 */
export function PhotoPicker({
  photos,
  catalog,
  onPick,
}: {
  photos: Photo[];
  catalog: Catalog;
  onPick: (photo: Photo) => void;
}) {
  const [filter, setFilter] = usePhotoFilter();
  const shown = filterPhotos(photos, filter, catalog);
  return (
    <section className="photo-picker" aria-label="Add photos">
      <div className="photo-picker__header">
        <h4>Add photos</h4>
        <PhotoFilters
          label="Photos to add"
          photos={photos}
          catalog={catalog}
          filter={filter}
          onChange={setFilter}
        />
      </div>
      {shown.length ? (
        <ul className="photo-picker__strip">
          {shown.map((photo) => (
            <li key={photo.getId()}>
              <button
                type="button"
                className="photo-picker__item"
                aria-label={`Add ${photo.getTitle()}`}
                title={`Add ${photo.getTitle()}`}
                onClick={() => onPick(photo)}
              >
                <span
                  className={`photo-picker__thumb${isHiddenFromPublic(photo) ? " studio-thumbnail--private" : ""}`}
                >
                  <PhotoImage
                    photo={photo}
                    className="object-cover"
                    fallbackSizes="96px"
                    maxWidth={160}
                  />
                  <span className="photo-picker__plus" aria-hidden>
                    +
                  </span>
                </span>
                <span className="photo-picker__title">{photo.getTitle()}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="upload-muted">
          {photos.length
            ? "No photos match these filters."
            : "Every photo is already in this collection."}
        </p>
      )}
    </section>
  );
}
