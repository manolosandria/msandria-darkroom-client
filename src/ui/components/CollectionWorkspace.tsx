"use client";

import { useState } from "react";
import {
  Catalog,
  CatalogCollection,
  CollectionDraft,
} from "@/src/domain/entities/Catalog";
import { Photo } from "@/src/domain/entities/Photo";
import { selectCatalog } from "@/src/domain/catalogSelection";
import { manageCatalog } from "@/src/infrastructure/catalogServices";
import { PhotoImage } from "./PhotoImage";
import { CollectionMosaic } from "./CollectionMosaic";
import { useEditingWorkspace, useUnsavedEditor } from "./EditingWorkspace";

const empty = (): CollectionDraft => ({
  title: "",
  coverPhotoId: null,
  categoryIds: [],
  entries: [],
});
const fromCollection = (collection?: CatalogCollection): CollectionDraft =>
  collection
    ? {
        title: collection.title,
        coverPhotoId: collection.coverPhotoId ?? null,
        categoryIds: collection.categories.map((category) => category.id),
        entries: collection.entries.map(({ photoId, columns, rows }) => ({
          photoId,
          columns,
          rows,
        })),
      }
    : empty();
const toggle = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];

export function CollectionWorkspace({
  catalog,
  photos,
  refresh,
}: {
  catalog: Catalog;
  photos: Photo[];
  refresh: () => Promise<void>;
}) {
  const [selected, setSelected] = useState("");
  const [visited, setVisited] = useState([""]);
  function choose(id: string) {
    setSelected(id);
    setVisited((previous) =>
      previous.includes(id) ? previous : [...previous, id],
    );
  }
  return (
    <section>
      <h2>Collections</h2>
      <div className="collection-cards">
        {catalog.collections.map((collection) => {
          const cover = photos.find(
            (photo) =>
              photo.getId() ===
              (collection.coverPhotoId ?? collection.entries[0]?.photoId),
          );
          return (
            <button
              type="button"
              key={collection.id}
              aria-pressed={selected === collection.id}
              onClick={() => choose(collection.id)}
            >
              <span className="collection-card-cover">
                {cover ? (
                  <PhotoImage
                    photo={cover}
                    className="object-cover"
                    fallbackSizes="280px"
                  />
                ) : (
                  <span>No cover yet</span>
                )}
              </span>
              <strong>{collection.title}</strong>
              <small>{collection.entries.length} photos</small>
            </button>
          );
        })}
      </div>
      <label>
        Edit collection
        <select
          value={selected}
          onChange={(event) => choose(event.target.value)}
        >
          <option value="">New collection</option>
          {catalog.collections.map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.title}
            </option>
          ))}
        </select>
      </label>
      {visited.map((id) => (
        <div key={id} hidden={selected !== id}>
          <CollectionEditor
            active={selected === id}
            id={id}
            collection={catalog.collections.find((item) => item.id === id)}
            catalog={catalog}
            photos={photos}
            refresh={refresh}
            onDeleted={() => {
              setVisited((previous) => previous.filter((key) => key !== id));
              choose("");
            }}
          />
        </div>
      ))}
    </section>
  );
}

function CollectionEditor({
  id,
  collection,
  catalog,
  photos,
  refresh,
  onDeleted,
  active,
}: {
  id: string;
  collection?: CatalogCollection;
  catalog: Catalog;
  photos: Photo[];
  refresh: () => Promise<void>;
  onDeleted: () => void;
  active: boolean;
}) {
  const [baseline, setBaseline] = useState(() => fromCollection(collection));
  const [draft, setDraft] = useState(() => fromCollection(collection));
  const [excluded, setExcluded] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { confirm } = useEditingWorkspace();
  const included = draft.entries.filter(
    (entry) => !excluded.includes(entry.photoId),
  );
  const existingCategoryIds = (ids: string[]) =>
    ids.filter((id) =>
      catalog.categories.some((category) => category.id === id),
    );
  const payload: CollectionDraft = {
    ...draft,
    categoryIds: existingCategoryIds(draft.categoryIds),
    entries: included,
    coverPhotoId: included.some((entry) => entry.photoId === draft.coverPhotoId)
      ? draft.coverPhotoId
      : null,
  };
  const dirty =
    JSON.stringify(payload) !==
    JSON.stringify({
      ...baseline,
      categoryIds: existingCategoryIds(baseline.categoryIds),
    });
  const privatePhotos = included.flatMap((entry) => {
    const photo = photos.find(
      (candidate) => candidate.getId() === entry.photoId,
    );
    return photo &&
      ["PRIVATE", "SELECT"].includes(photo.getClassification().visibility)
      ? [photo.getTitle()]
      : [];
  });
  function discard() {
    setDraft(baseline);
    setExcluded([]);
    setError("");
    setNotice("");
  }
  async function persist(): Promise<boolean> {
    if (busy) return false;
    if (!draft.title.trim()) {
      setError("Give this collection a title before saving.");
      return false;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await manageCatalog.saveCollection(payload, id || undefined);
      const next = id ? payload : empty();
      setBaseline(next);
      setDraft(next);
      setExcluded([]);
      setNotice("Saved.");
      try {
        await refresh();
      } catch {
        setError(
          "Saved, but the refreshed catalog could not be loaded. Reload the page before editing again.",
        );
      }
      return true;
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save. Your edits are still here.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  useUnsavedEditor(dirty, {
    label: draft.title || "New collection",
    save: persist,
    discard,
  });
  function move(index: number, offset: number) {
    const entries = [...draft.entries];
    [entries[index], entries[index + offset]] = [
      entries[index + offset],
      entries[index],
    ];
    setDraft({ ...draft, entries });
    setNotice("");
  }
  const preview: Catalog = {
    ...catalog,
    collections: [
      { id: "preview", title: draft.title, categories: [], entries: included },
    ],
  };
  if (!active) return null;
  return (
    <>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (
            !busy &&
            (await confirm(
              "Save collection?",
              'Save changes to "' +
                draft.title +
                '"? Other collections will not be saved.',
            ))
          )
            await persist();
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Collection title
            <input
              required
              maxLength={160}
              value={draft.title}
              onChange={(event) => {
                setDraft({ ...draft, title: event.target.value });
                setNotice("");
              }}
            />
          </label>
          <fieldset>
            <legend>Categories</legend>
            {catalog.categories.map((category) => (
              <label key={category.id}>
                <input
                  type="checkbox"
                  checked={draft.categoryIds.includes(category.id)}
                  onChange={() =>
                    setDraft({
                      ...draft,
                      categoryIds: toggle(draft.categoryIds, category.id),
                    })
                  }
                />
                {category.name}
              </label>
            ))}
            {!catalog.categories.length && (
              <p>Create a category below to classify your photos.</p>
            )}
          </fieldset>
          <label>
            Cover photo
            <select
              value={draft.coverPhotoId ?? ""}
              onChange={(event) =>
                setDraft({ ...draft, coverPhotoId: event.target.value || null })
              }
            >
              <option value="">First included photo</option>
              {included.map((entry) => (
                <option key={entry.photoId} value={entry.photoId}>
                  {photos
                    .find((photo) => photo.getId() === entry.photoId)
                    ?.getTitle() ?? "Photo"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Add photo
            <select
              value=""
              onChange={(event) => {
                if (event.target.value)
                  setDraft({
                    ...draft,
                    entries: [
                      ...draft.entries,
                      { photoId: event.target.value, columns: 1, rows: 1 },
                    ],
                  });
              }}
            >
              <option value="">Choose a photo</option>
              {photos
                .filter(
                  (photo) =>
                    !draft.entries.some(
                      (entry) => entry.photoId === photo.getId(),
                    ),
                )
                .map((photo) => (
                  <option key={photo.getId()} value={photo.getId()}>
                    {photo.getTitle()}
                  </option>
                ))}
            </select>
          </label>
          {privatePhotos.length > 0 && (
            <p role="alert" className="privacy-warning">
              Private or reserved photos will not appear in the public
              collection, regardless of their position:{" "}
              {privatePhotos.join(", ")}.
            </p>
          )}
          <p>
            Move photos to set their priority. Width and height use a
            four-column canvas that keeps the same composition on phones.
          </p>
          <ol className="catalog-editor__entries">
            {draft.entries.map((entry, index) => (
              <li key={entry.photoId}>
                <div className="catalog-editor__row">
                  <span>
                    {index + 1}.{" "}
                    {photos
                      .find((photo) => photo.getId() === entry.photoId)
                      ?.getTitle() ?? "Unavailable photo"}
                  </span>
                  <button
                    type="button"
                    aria-label={`Move photo ${index + 1} up`}
                    disabled={!index}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move photo ${index + 1} down`}
                    disabled={index === draft.entries.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </button>
                  {(["columns", "rows"] as const).map((dimension) => (
                    <label key={dimension}>
                      {dimension === "columns" ? "Width" : "Height"}
                      <select
                        value={entry[dimension]}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            entries: draft.entries.map((item, position) =>
                              position === index
                                ? {
                                    ...item,
                                    [dimension]: Number(event.target.value),
                                  }
                                : item,
                            ),
                          })
                        }
                      >
                        {[1, 2, 3, 4].map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                  <label>
                    <input
                      type="checkbox"
                      checked={!excluded.includes(entry.photoId)}
                      onChange={() =>
                        setExcluded(toggle(excluded, entry.photoId))
                      }
                    />
                    Include photo {index + 1}
                  </label>
                  {excluded.includes(entry.photoId) && (
                    <span className="upload-muted">
                      Will be removed when you save
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <div className="editor-actions">
            <button type="submit" className="upload-primary">
              {busy ? "Saving…" : "Save collection"}
            </button>
            <button
              type="button"
              className="upload-secondary"
              disabled={!dirty}
              onClick={async () => {
                if (
                  await confirm(
                    "Cancel collection changes?",
                    'Discard unsaved changes to "' +
                      (draft.title || "New collection") +
                      '"?',
                  )
                )
                  discard();
              }}
            >
              Cancel changes
            </button>
          </div>
        </fieldset>
      </form>
      {id && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (
              !(await confirm(
                "Delete collection?",
                "Remove this collection? Photo files and comments will remain.",
              ))
            )
              return;
            setBusy(true);
            setError("");
            try {
              await manageCatalog.remove("collections", id);
              onDeleted();
              await refresh();
            } catch {
              setError("Could not delete or refresh this collection.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Delete collection
        </button>
      )}
      {included.length > 0 && (
        <div>
          <h3>Composition preview</h3>
          <CollectionMosaic
            tiles={selectCatalog(photos, preview, "", "preview")}
            mosaic
          />
        </div>
      )}
    </>
  );
}
