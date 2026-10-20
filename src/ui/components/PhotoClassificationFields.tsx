"use client";
import { useEffect, useId, useState } from "react";
import { Catalog } from "@/src/domain/entities/Catalog";
import { PhotoClassification } from "@/src/domain/entities/Photo";
import { manageCatalog } from "@/src/infrastructure/catalogServices";

export type { PhotoClassification };

// Every photo starts public unless the curator chooses otherwise.
export const publicClassification = (): PhotoClassification => ({
  visibility: "PUBLIC",
  categoryNames: [],
  collections: [],
});

export function PhotoClassificationFields({
  value,
  onChange,
  disabled = false,
}: {
  value: PhotoClassification;
  onChange: (value: PhotoClassification) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState("");
  async function load() {
    try {
      setCatalog(await manageCatalog.load());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }
  useEffect(() => {
    queueMicrotask(() => void load());
  }, []);
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
  return (
    <fieldset className="photo-classification" disabled={disabled}>
      <label>
        Visibility
        <select
          value={value.visibility}
          onChange={(event) =>
            onChange({
              ...value,
              visibility: event.target
                .value as PhotoClassification["visibility"],
            })
          }
        >
          <option value="PUBLIC">Public</option>
          <option value="PRIVATE">Private — administrator only</option>
          <option value="SELECT">Select — reserved access</option>
          <option value="COLLECTIONS_ONLY">Collections only</option>
        </select>
      </label>
      {(value.visibility === "PRIVATE" || value.visibility === "SELECT") &&
        value.collections.length > 0 && (
          <p role="alert" className="privacy-warning">
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
      <label>
        Categories
        <input
          list={`${id}-categories`}
          value={text}
          maxLength={80}
          placeholder="Type a category, then comma"
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
      <datalist id={`${id}-categories`}>
        {catalog?.categories
          .filter((category) => !value.categoryNames.includes(category.name))
          .map((category) => (
            <option key={category.id} value={category.name} />
          ))}
      </datalist>
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
      <label>
        Add to collections
        <select
          value=""
          disabled={!catalog}
          onChange={(event) => {
            const collection = catalog?.collections.find(
              (item) => item.id === event.target.value,
            );
            if (collection)
              onChange({
                ...value,
                collections: [
                  ...value.collections,
                  {
                    id: collection.id,
                    position: collection.entries.length + 1,
                  },
                ],
              });
          }}
        >
          <option value="">Select one or more collections</option>
          {catalog?.collections
            .filter(
              (collection) =>
                !value.collections.some((entry) => entry.id === collection.id),
            )
            .map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.title}
              </option>
            ))}
        </select>
      </label>
      {value.collections.map((entry) => (
        <div key={entry.id} className="photo-collection-assignment">
          <span>
            {catalog?.collections.find((item) => item.id === entry.id)?.title ??
              "Collection"}
          </span>
          <label>
            Order
            <input
              type="number"
              min={1}
              max={10000}
              value={entry.position}
              onChange={(event) =>
                onChange({
                  ...value,
                  collections: value.collections.map((item) =>
                    item.id === entry.id
                      ? { ...item, position: Number(event.target.value) }
                      : item,
                  ),
                })
              }
            />
          </label>
          <button
            type="button"
            aria-label="Remove from collection"
            onClick={() =>
              onChange({
                ...value,
                collections: value.collections.filter(
                  (item) => item.id !== entry.id,
                ),
              })
            }
          >
            ×
          </button>
        </div>
      ))}
      {failed && (
        <p role="alert">
          Could not load category suggestions and collections.{" "}
          <button type="button" onClick={load}>
            Retry catalog
          </button>
        </p>
      )}
    </fieldset>
  );
}
