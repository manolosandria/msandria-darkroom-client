"use client";
import "./photoStudio.css";

import styles from "./EditorFeedback.module.css";
import { useId, useState } from "react";
import { Photo, PhotoClassification } from "@/src/domain/entities/Photo";
import { CatalogCollection } from "@/src/domain/entities/Catalog";
import { ClassificationCatalogBoundary, useClassificationCatalog } from "./ClassificationCatalog";
import { PhotoImage } from "./PhotoImage";

export type { PhotoClassification };

// Every photo starts public unless the curator chooses otherwise.
export const publicClassification = (): PhotoClassification => ({
  visibility: "PUBLIC",
  categoryNames: [],
  collections: [],
});

type Props = {
  value: PhotoClassification;
  onChange: (value: PhotoClassification) => void;
  disabled?: boolean;
  /** Photos to draw collection covers from; without them a cover shows the initial. */
  photos?: Photo[];
};

/** Visibility, categories and collections together, as each upload card shows them. */
export function PhotoClassificationFields(props: Props) {
  return (
    <ClassificationCatalogBoundary>
      <fieldset className="photo-classification" disabled={props.disabled}>
        <VisibilityChoice {...props} />
        <CategoryChips {...props} />
        <CollectionChoice {...props} />
        <CatalogRetry />
      </fieldset>
    </ClassificationCatalogBoundary>
  );
}

export function PhotoVisibilityField(props: Props) {
  return (
    <fieldset className="photo-classification" disabled={props.disabled}>
      <VisibilityChoice {...props} />
    </fieldset>
  );
}

export function PhotoCategoryField(props: Props) {
  return (
    <ClassificationCatalogBoundary>
      <fieldset className="photo-classification" disabled={props.disabled}>
        <CategoryChips {...props} />
        <CatalogRetry />
      </fieldset>
    </ClassificationCatalogBoundary>
  );
}

export function PhotoCollectionField(props: Props) {
  return (
    <ClassificationCatalogBoundary>
      <fieldset className="photo-classification" disabled={props.disabled}>
        <CollectionChoice {...props} />
        <CatalogRetry />
      </fieldset>
    </ClassificationCatalogBoundary>
  );
}

const VISIBILITY: {
  value: PhotoClassification["visibility"];
  label: string;
  hint: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "PUBLIC",
    label: "Public",
    hint: "Gallery, Home and collections",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" />
      </>
    ),
  },
  {
    value: "COLLECTIONS_ONLY",
    label: "Collections only",
    hint: "Inside its collections",
    icon: (
      <>
        <rect x="3" y="6" width="14" height="14" rx="1.5" />
        <path d="M7 3h13a1 1 0 0 1 1 1v13" />
      </>
    ),
  },
  {
    value: "PRIVATE",
    label: "Private",
    hint: "Administrator only",
    icon: (
      <>
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
  },
  {
    value: "SELECT",
    label: "Select",
    hint: "Reserved access",
    icon: <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1L3.2 9.4l6.1-.8z" />,
  },
];

function VisibilityChoice({ value, onChange }: Props) {
  const id = useId();
  return (
    <>
      <fieldset className="visibility-choice" role="radiogroup" aria-label="Visibility">
        <legend>Visibility</legend>
        {VISIBILITY.map((option) => (
          <label key={option.value} data-visibility={option.value}>
            <input
              type="radio"
              name={`${id}-visibility`}
              value={option.value}
              checked={value.visibility === option.value}
              onChange={() => onChange({ ...value, visibility: option.value })}
            />
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              {option.icon}
            </svg>
            <strong>{option.label}</strong>
            <small>{option.hint}</small>
          </label>
        ))}
      </fieldset>
      {(value.visibility === "PRIVATE" || value.visibility === "SELECT") &&
        value.collections.length > 0 && (
          <p role="alert" className={styles.warning}>
            This photo is{" "}
            {value.visibility === "PRIVATE" ? "private" : "reserved"}. It will
            not appear in the public collection, regardless of its position.
          </p>
        )}
      {value.visibility === "SELECT" && (
        <p className="upload-muted">
          Only the administrator can view this until special accounts are
          available.
        </p>
      )}
      {value.visibility === "COLLECTIONS_ONLY" && (
        <p className="upload-muted">
          Public inside a collection; hidden from the general gallery. Choose at
          least one collection to make it visible.
        </p>
      )}
    </>
  );
}

// Typing narrows the existing categories shown as buttons; a new name can be created
// from the same field. No dropdown: everything chosen or offered stays in view.
function CategoryChips({ value, onChange }: Props) {
  const { catalog } = useClassificationCatalog();
  const [text, setText] = useState("");
  function add(raw: string) {
    const names = [...value.categoryNames];
    for (const part of raw.split(",")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const name =
        catalog?.categories.find(
          (category) => category.name.toLowerCase() === trimmed.toLowerCase(),
        )?.name ?? trimmed;
      if (
        !names.some((existing) => existing.toLowerCase() === name.toLowerCase())
      )
        names.push(name);
    }
    onChange({ ...value, categoryNames: names });
    setText("");
  }
  const typed = foldName(text.trim());
  const suggestions =
    catalog?.categories.filter(
      (category) =>
        !value.categoryNames.some(
          (name) => name.toLowerCase() === category.name.toLowerCase(),
        ) && foldName(category.name).includes(typed),
    ) ?? [];
  const exists =
    !typed ||
    value.categoryNames.some((name) => foldName(name) === typed) ||
    catalog?.categories.some((category) => foldName(category.name) === typed);
  return (
    <div className="category-field">
      <label>
        Categories
        <input
          value={text}
          maxLength={80}
          placeholder="Filter or create a category"
          onChange={(event) => {
            const next = event.target.value;
            if (next.includes(",")) add(next);
            else setText(next);
          }}
          onBlur={() => {
            if (text.trim()) add(text);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add(text);
            }
          }}
        />
      </label>
      <div className="category-chips">
        {value.categoryNames.map((name) => (
          <button
            type="button"
            key={name}
            aria-label={`Remove category ${name}`}
            onClick={() =>
              onChange({
                ...value,
                categoryNames: value.categoryNames.filter(
                  (item) => item !== name,
                ),
              })
            }
          >
            {name} ×
          </button>
        ))}
      </div>
      {(suggestions.length > 0 || !exists) && (
        <div className="category-suggestions" aria-label="Existing categories">
          {!exists && (
            <button
              type="button"
              className="category-suggestions__create"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => add(text)}
            >
              + Create “{text.trim()}”
            </button>
          )}
          {suggestions.map((category) => (
            <button
              type="button"
              key={category.id}
              aria-label={`Add category ${category.name}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => add(category.name)}
            >
              + {category.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const foldName = (name: string) =>
  name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function collectionCover(collection: CatalogCollection, photos?: Photo[]) {
  const id = collection.coverPhotoId ?? collection.entries[0]?.photoId;
  return photos?.find((photo) => photo.getId() === id);
}

// A disclosure of the gallery's collections as cards: the photo is in the marked ones.
function CollectionChoice({ value, onChange, photos }: Props) {
  const { catalog } = useClassificationCatalog();
  const collections = catalog?.collections ?? [];
  const active = collections.filter((collection) =>
    value.collections.some((entry) => entry.id === collection.id),
  );
  function toggle(collection: CatalogCollection) {
    const inside = value.collections.some((entry) => entry.id === collection.id);
    onChange({
      ...value,
      collections: inside
        ? value.collections.filter((entry) => entry.id !== collection.id)
        : [
            ...value.collections,
            { id: collection.id, position: collection.entries.length + 1 },
          ],
    });
  }
  return (
    <details className="collection-choice">
      <summary>
        <span className="collection-choice__title">Collections</span>
        <span className="collection-choice__count">
          {catalog
            ? `In ${value.collections.length} of ${collections.length}`
            : "Loading…"}
        </span>
        <span className="collection-choice__stack" aria-hidden="true">
          {active.slice(0, 4).map((collection) => {
            const cover = collectionCover(collection, photos);
            return (
              <span key={collection.id}>
                {cover ? (
                  <PhotoImage photo={cover} maxWidth={160} fallbackSizes="32px" className="object-cover" />
                ) : (
                  collection.title.slice(0, 1)
                )}
              </span>
            );
          })}
        </span>
      </summary>
      {catalog && collections.length === 0 && (
        <p className="upload-muted">No collections yet. Create one in Collections.</p>
      )}
      <ul className="collection-choice__grid">
        {collections.map((collection) => {
          const entry = value.collections.find((item) => item.id === collection.id);
          const cover = collectionCover(collection, photos);
          return (
            <li key={collection.id} data-active={entry ? "" : undefined}>
              <button
                type="button"
                aria-pressed={Boolean(entry)}
                aria-label={
                  entry
                    ? `Remove from collection ${collection.title}`
                    : `Add to collection ${collection.title}`
                }
                onClick={() => toggle(collection)}
              >
                <span className="collection-choice__cover">
                  {cover ? (
                    <PhotoImage photo={cover} maxWidth={320} fallbackSizes="160px" className="object-cover" />
                  ) : (
                    <span className="collection-choice__initial">
                      {collection.title.slice(0, 1)}
                    </span>
                  )}
                  <span className="collection-choice__check" aria-hidden="true">
                    {entry ? "✓" : "+"}
                  </span>
                </span>
                <strong>{collection.title}</strong>
                <small>
                  {collection.entries.length}{" "}
                  {collection.entries.length === 1 ? "photo" : "photos"}
                </small>
              </button>
              {entry && (
                <label className="collection-choice__order">
                  Order
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    aria-label={`Order in ${collection.title}`}
                    value={entry.position}
                    onChange={(event) =>
                      onChange({
                        ...value,
                        collections: value.collections.map((item) =>
                          item.id === collection.id
                            ? { ...item, position: Number(event.target.value) }
                            : item,
                        ),
                      })
                    }
                  />
                </label>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function CatalogRetry() {
  const { failed, reload } = useClassificationCatalog();
  return failed ? (
    <p role="alert">
      Could not load category suggestions and collections.{" "}
      <button type="button" onClick={reload}>
        Retry catalog
      </button>
    </p>
  ) : null;
}
