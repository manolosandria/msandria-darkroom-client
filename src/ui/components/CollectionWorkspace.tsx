"use client";

import styles from "./EditorFeedback.module.css";

import { useState } from "react";
import {
  Catalog,
  CatalogCollection,
  CollectionDraft,
  CollectionEntry,
} from "@/src/domain/entities/Catalog";
import { Photo } from "@/src/domain/entities/Photo";
import { manageCatalog } from "@/src/infrastructure/catalogServices";
import { PhotoImage } from "./PhotoImage";
import { PhotoPicker } from "./PhotoPicker";
import {
  CollectionCanvas,
  isHiddenFromPublic,
  MOSAIC_COLUMNS,
} from "./CollectionCanvas";
import { useEditingWorkspace, useUnsavedEditor } from "./EditingWorkspace";

const empty = (): CollectionDraft => ({
  title: "",
  description: "",
  coverPhotoId: null,
  categoryIds: [],
  entries: [],
});
const fromCollection = (collection?: CatalogCollection): CollectionDraft =>
  collection
    ? {
        title: collection.title,
        description: collection.description ?? "",
        coverPhotoId: collection.coverPhotoId ?? null,
        categoryIds: collection.categories.map((category) => category.id),
        entries: collection.entries.map(
          ({ photoId, columns, rows, showTitle }) => ({
            photoId,
            columns,
            rows,
            showTitle: showTitle ?? true,
          }),
        ),
      }
    : empty();
const toggle = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
const findPhoto = (photos: Photo[], id?: string | null) =>
  photos.find((photo) => photo.getId() === id);
const coverOf = (collection: CatalogCollection, photos: Photo[]) =>
  findPhoto(photos, collection.coverPhotoId ?? collection.entries[0]?.photoId);

export function CollectionWorkspace({
  catalog,
  photos,
  refresh,
}: {
  catalog: Catalog;
  photos: Photo[];
  refresh: () => Promise<void>;
}) {
  const [focused, setFocused] = useState<string | null>(null);
  // null shows the grid; "" is the new collection.
  const [editing, setEditing] = useState<string | null>(null);
  const [visited, setVisited] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  function open(id: string) {
    setEditing(id);
    setNotice("");
    setVisited((previous) =>
      previous.includes(id) ? previous : [...previous, id],
    );
  }
  return (
    <div className="studio-collections">
      {editing === null && (
        <CollectionBrowser
          catalog={catalog}
          photos={photos}
          focused={focused}
          notice={notice}
          onFocus={setFocused}
          onOpen={open}
        />
      )}
      {visited.map((id) => (
        <div key={id} hidden={editing !== id}>
          <CollectionEditor
            active={editing === id}
            id={id}
            collection={catalog.collections.find((item) => item.id === id)}
            catalog={catalog}
            photos={photos}
            refresh={refresh}
            onClose={() => setEditing(null)}
            onCreated={() => {
              setEditing(null);
              setNotice("Collection created.");
            }}
            onDeleted={() => {
              setVisited((previous) => previous.filter((key) => key !== id));
              setFocused(null);
              setEditing(null);
              setNotice("Collection deleted.");
            }}
          />
        </div>
      ))}
    </div>
  );
}

function CollectionBrowser({
  catalog,
  photos,
  focused,
  notice,
  onFocus,
  onOpen,
}: {
  catalog: Catalog;
  photos: Photo[];
  focused: string | null;
  notice: string;
  onFocus: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const collection = catalog.collections.find((item) => item.id === focused);
  return (
    <div className="studio-split">
      <div className="studio-main">
        {notice && <p role="status">{notice}</p>}
        <ul className="studio-collection-grid" aria-label="Collections">
          <li>
            <button
              type="button"
              className="studio-collection-card studio-collection-card--new"
              onClick={() => onOpen("")}
            >
              <span className="studio-collection-card__cover" aria-hidden>
                +
              </span>
              <strong>New collection</strong>
              <small>Start an empty composition</small>
            </button>
          </li>
          {catalog.collections.map((item) => {
            const cover = coverOf(item, photos);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className="studio-collection-card"
                  aria-pressed={focused === item.id}
                  onClick={() => onFocus(item.id)}
                  onDoubleClick={() => onOpen(item.id)}
                >
                  <span className="studio-collection-card__cover">
                    {cover ? (
                      <PhotoImage
                        photo={cover}
                        className="object-cover"
                        fallbackSizes="280px"
                        maxWidth={320}
                      />
                    ) : (
                      <span>No cover yet</span>
                    )}
                  </span>
                  <strong>{item.title}</strong>
                  <small>
                    {item.entries.length}{" "}
                    {item.entries.length === 1 ? "photo" : "photos"}
                  </small>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <aside className="studio-panel" aria-label="Collection details">
        {collection ? (
          <CollectionSummary
            collection={collection}
            photos={photos}
            onEdit={() => onOpen(collection.id)}
          />
        ) : (
          <p className="studio-panel__empty">
            Choose a collection to see its categories, description and photos.
          </p>
        )}
      </aside>
    </div>
  );
}

function CollectionSummary({
  collection,
  photos,
  onEdit,
}: {
  collection: CatalogCollection;
  photos: Photo[];
  onEdit: () => void;
}) {
  const cover = coverOf(collection, photos);
  const hidden = collection.entries.filter((entry) =>
    isHiddenFromPublic(findPhoto(photos, entry.photoId)),
  ).length;
  return (
    <div className="studio-summary">
      <div className="studio-summary__cover">
        {cover && (
          <PhotoImage
            photo={cover}
            className="object-cover"
            fallbackSizes="360px"
            maxWidth={640}
          />
        )}
      </div>
      <h3>{collection.title}</h3>
      {collection.categories.length > 0 ? (
        <ul className="category-chips" aria-label="Categories">
          {collection.categories.map((category) => (
            <li key={category.id} className="studio-chip">
              {category.name}
            </li>
          ))}
        </ul>
      ) : (
        <p className="upload-muted">No categories.</p>
      )}
      <p className={collection.description ? "" : "upload-muted"}>
        {collection.description || "No description yet."}
      </p>
      {hidden > 0 && (
        <p className={styles.warning}>
          {hidden} {hidden === 1 ? "photo is" : "photos are"} private or
          reserved and will not appear publicly.
        </p>
      )}
      <ul className="studio-thumbnails" aria-label="Photos in the collection">
        {collection.entries.map((entry) => {
          const photo = findPhoto(photos, entry.photoId);
          return (
            photo && (
              <li
                key={entry.photoId}
                className={
                  isHiddenFromPublic(photo) ? "studio-thumbnail--private" : ""
                }
              >
                <PhotoImage
                  photo={photo}
                  className="object-cover"
                  fallbackSizes="72px"
                  maxWidth={160}
                />
              </li>
            )
          );
        })}
      </ul>
      <button type="button" className="studio-save" onClick={onEdit}>
        Edit collection
      </button>
    </div>
  );
}

function CollectionEditor({
  id,
  collection,
  catalog,
  photos,
  refresh,
  onClose,
  onCreated,
  onDeleted,
  active,
}: {
  id: string;
  collection?: CatalogCollection;
  catalog: Catalog;
  photos: Photo[];
  refresh: () => Promise<void>;
  onClose: () => void;
  onCreated: () => void;
  onDeleted: () => void;
  active: boolean;
}) {
  const [baseline, setBaseline] = useState(() => fromCollection(collection));
  const [draft, setDraft] = useState(() => fromCollection(collection));
  const [excluded, setExcluded] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
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
    description: draft.description?.trim() ?? "",
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
    const photo = findPhoto(photos, entry.photoId);
    return photo && isHiddenFromPublic(photo) ? [photo.getTitle()] : [];
  });
  function update(next: Partial<CollectionDraft>) {
    setDraft((previous) => ({ ...previous, ...next }));
    setNotice("");
  }
  function updateEntry(photoId: string, next: Partial<CollectionEntry>) {
    setDraft((previous) => ({
      ...previous,
      entries: previous.entries.map((entry) =>
        entry.photoId === photoId ? { ...entry, ...next } : entry,
      ),
    }));
    setNotice("");
  }
  function move(from: number, to: number) {
    setDraft((previous) => {
      if (to < 0 || to >= previous.entries.length) return previous;
      const entries = [...previous.entries];
      const [entry] = entries.splice(from, 1);
      entries.splice(to, 0, entry);
      return { ...previous, entries };
    });
    setNotice("");
  }
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
      setSelected(null);
      setNotice("Saved.");
      try {
        await refresh();
      } catch {
        setError(
          "Saved, but the refreshed catalog could not be loaded. Reload the page before editing again.",
        );
      }
      if (!id) onCreated();
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
  if (!active) return null;
  const index = draft.entries.findIndex((entry) => entry.photoId === selected);
  const entry = draft.entries[index];
  return (
    <form
      className="studio-editor"
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
        <div className="studio-toolbar">
          <button
            type="button"
            className="studio-back"
            onClick={() => onClose()}
          >
            ← All collections
          </button>
          <h3>{draft.title || "New collection"}</h3>
          {dirty && <span className="studio-dirty">Unsaved changes</span>}
          <button
            type="submit"
            className="studio-save"
            data-busy={busy || undefined}
            data-dirty={dirty || undefined}
          >
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
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        <div className="studio-split">
          <div className="studio-main">
            <PhotoPicker
              catalog={catalog}
              photos={photos.filter(
                (photo) =>
                  !draft.entries.some((item) => item.photoId === photo.getId()),
              )}
              onPick={(photo) => {
                update({
                  entries: [
                    ...draft.entries,
                    {
                      photoId: photo.getId(),
                      columns: 1,
                      rows: 1,
                      showTitle: true,
                    },
                  ],
                });
                setSelected(photo.getId());
              }}
            />
            <p className="upload-muted studio-hint">
              Drag a photo to change its priority, or pull its edges or corner
              to resize it. The {MOSAIC_COLUMNS}-column canvas keeps the same
              composition on phones.
            </p>
            {privatePhotos.length > 0 && (
              <p role="alert" className={styles.warning}>
                Private or reserved photos will not appear in the public
                collection, regardless of their position:{" "}
                {privatePhotos.join(", ")}.
              </p>
            )}
            {draft.entries.length ? (
              <CollectionCanvas
                entries={draft.entries}
                photos={photos}
                selectedId={selected}
                coverId={payload.coverPhotoId ?? null}
                excluded={excluded}
                onSelect={setSelected}
                onMove={move}
                onResize={(position, columns, rows) =>
                  updateEntry(draft.entries[position].photoId, {
                    columns,
                    rows,
                  })
                }
              />
            ) : (
              <p className="studio-empty">
                Add photos to start the composition.
              </p>
            )}
          </div>
          <aside
            className="studio-panel"
            aria-label={entry ? "Photo details" : "Collection details"}
          >
            {entry ? (
              <>
                {catalog.works.find((work) =>
                  work.variants.some((v) => v.photoId === entry.photoId),
                ) && (
                  <label className="studio-fields">
                    Collection variant
                    <select
                      value={entry.photoId}
                      onChange={(event) => {
                        const nextId = event.target.value;
                        update({
                          entries: draft.entries.map((item) =>
                            item.photoId === entry.photoId
                              ? { ...item, photoId: nextId }
                              : item,
                          ),
                          coverPhotoId:
                            draft.coverPhotoId === entry.photoId
                              ? nextId
                              : draft.coverPhotoId,
                        });
                        setExcluded((previous) =>
                          previous.map((id) =>
                            id === entry.photoId ? nextId : id,
                          ),
                        );
                        setSelected(nextId);
                      }}
                    >
                      {catalog.works
                        .find((work) =>
                          work.variants.some(
                            (v) => v.photoId === entry.photoId,
                          ),
                        )!
                        .variants.map((v) => {
                          const variant = findPhoto(photos, v.photoId);
                          return (
                            variant && (
                              <option
                                key={v.photoId}
                                value={v.photoId}
                                disabled={
                                  v.photoId !== entry.photoId &&
                                  draft.entries.some(
                                    (item) => item.photoId === v.photoId,
                                  )
                                }
                              >
                                {variant.getTitle()}
                              </option>
                            )
                          );
                        })}
                    </select>
                  </label>
                )}
                <EntryDetails
                  entry={entry}
                  index={index}
                  count={draft.entries.length}
                  photo={findPhoto(photos, entry.photoId)}
                  isCover={payload.coverPhotoId === entry.photoId}
                  removed={excluded.includes(entry.photoId)}
                  onBack={() => setSelected(null)}
                  onMove={(offset) => move(index, index + offset)}
                  onChange={(next) => updateEntry(entry.photoId, next)}
                  onCover={(cover) =>
                    update({ coverPhotoId: cover ? entry.photoId : null })
                  }
                  onToggleRemoved={() =>
                    setExcluded(toggle(excluded, entry.photoId))
                  }
                />
              </>
            ) : (
              <div className="studio-fields">
                <label>
                  Collection title
                  <input
                    required
                    maxLength={160}
                    value={draft.title}
                    onChange={(event) => update({ title: event.target.value })}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    maxLength={2000}
                    rows={4}
                    value={draft.description ?? ""}
                    onChange={(event) =>
                      update({ description: event.target.value })
                    }
                  />
                </label>
                <fieldset>
                  <legend>Categories</legend>
                  <div className="studio-checks">
                    {catalog.categories.map((category) => (
                      <label key={category.id} className="studio-check">
                        <input
                          type="checkbox"
                          checked={draft.categoryIds.includes(category.id)}
                          onChange={() =>
                            update({
                              categoryIds: toggle(
                                draft.categoryIds,
                                category.id,
                              ),
                            })
                          }
                        />
                        {category.name}
                      </label>
                    ))}
                  </div>
                  {!catalog.categories.length && (
                    <p className="upload-muted">
                      Create one in the Categories tab to classify this
                      collection.
                    </p>
                  )}
                </fieldset>
                <p className="upload-muted">
                  Select a photo in the composition to resize it, hide its title
                  or use it as the cover.
                </p>
                {id && (
                  <button
                    type="button"
                    className="studio-danger"
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
                        setError(
                          "Could not delete or refresh this collection.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Delete collection
                  </button>
                )}
              </div>
            )}
          </aside>
        </div>
      </fieldset>
    </form>
  );
}

function EntryDetails({
  entry,
  index,
  count,
  photo,
  isCover,
  removed,
  onBack,
  onMove,
  onChange,
  onCover,
  onToggleRemoved,
}: {
  entry: CollectionEntry;
  index: number;
  count: number;
  photo?: Photo;
  isCover: boolean;
  removed: boolean;
  onBack: () => void;
  onMove: (offset: number) => void;
  onChange: (next: Partial<CollectionEntry>) => void;
  onCover: (cover: boolean) => void;
  onToggleRemoved: () => void;
}) {
  const hidden = isHiddenFromPublic(photo);
  return (
    <div className="studio-fields">
      <button type="button" className="studio-back" onClick={onBack}>
        ← Collection details
      </button>
      <div
        className={`studio-summary__cover studio-summary__cover--contain${hidden ? " studio-thumbnail--private" : ""}`}
      >
        {photo && (
          <PhotoImage
            photo={photo}
            className="object-contain"
            fallbackSizes="360px"
            maxWidth={640}
          />
        )}
      </div>
      <h3>{photo?.getTitle() ?? "Unavailable photo"}</h3>
      <p className="upload-muted">
        Photo {index + 1} of {count}
        {photo && ` · ${photo.getClassification().visibility.toLowerCase()}`}
      </p>
      {hidden && (
        <p className={styles.warning}>
          This photo is private or reserved: it keeps its place here but will
          not be shown in the public collection.
        </p>
      )}
      <div className="studio-row">
        <button type="button" disabled={index === 0} onClick={() => onMove(-1)}>
          ← Move earlier
        </button>
        <button
          type="button"
          disabled={index === count - 1}
          onClick={() => onMove(1)}
        >
          Move later →
        </button>
      </div>
      <div className="studio-row">
        {(["columns", "rows"] as const).map((dimension) => (
          <label key={dimension}>
            {dimension === "columns" ? "Width" : "Height"}
            <select
              value={entry[dimension]}
              onChange={(event) =>
                onChange({ [dimension]: Number(event.target.value) })
              }
            >
              {[1, 2, 3, 4].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <label className="studio-check">
        <input
          type="checkbox"
          checked={entry.showTitle !== false}
          onChange={(event) => onChange({ showTitle: event.target.checked })}
        />
        Show title in the collection
      </label>
      {isCover ? (
        <div className="studio-row">
          <span className="studio-chip">★ Collection cover</span>
          <button type="button" onClick={() => onCover(false)}>
            Use the first photo instead
          </button>
        </div>
      ) : (
        <button type="button" disabled={removed} onClick={() => onCover(true)}>
          Use as collection cover
        </button>
      )}
      <button
        type="button"
        className={removed ? "" : "studio-danger"}
        onClick={onToggleRemoved}
      >
        {removed ? "Keep in collection" : "Remove from collection"}
      </button>
      {removed && (
        <span className="upload-muted">Will be removed when you save</span>
      )}
    </div>
  );
}
