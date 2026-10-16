"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Catalog,
  CollectionDraft,
  WorkDraft,
} from "@/src/domain/entities/Catalog";
import { Photo } from "@/src/domain/entities/Photo";
import { selectCatalog } from "@/src/domain/catalogSelection";
import { editCatalog } from "@/src/infrastructure/catalogServices";
import { getAllPhotos } from "@/src/infrastructure/photoServices";
import { useSessionValue } from "./SessionProvider";
import { ErrorMessage } from "./ErrorMessage";
import { CollectionMosaic } from "./CollectionMosaic";

const emptyCollection = (): CollectionDraft => ({
  title: "",
  categoryIds: [],
  entries: [],
});
const toggle = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];

export default function ManageCollections() {
  const session = useSessionValue();
  return (
    <main className="upload-workspace">
      <div className="upload-container">
        <div className="upload-heading">
          <span className="upload-eyebrow">THE DARKROOM / COLLECTIONS</span>
          <h1>Arrange your stories.</h1>
          <p>
            Group photographs, choose their rhythm and bring variants together.
          </p>
        </div>
        <Link href="/upload" className="upload-link">
          ← Upload photos
        </Link>
        {session.loading ? (
          <p role="status">Loading session…</p>
        ) : session.error ? (
          <ErrorMessage message={session.error} onRetry={session.reload} />
        ) : session.user?.isAdmin() ? (
          <CatalogEditor />
        ) : (
          <p>
            Sign in as the gallery&apos;s administrator to edit collections.
          </p>
        )}
      </div>
    </main>
  );
}

export function CatalogEditor() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [collectionId, setCollectionId] = useState("");
  const [draft, setDraft] = useState<CollectionDraft>(emptyCollection);
  const [categoryId, setCategoryId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [photoId, setPhotoId] = useState("");
  const [photoCategories, setPhotoCategories] = useState<string[]>([]);
  const [workId, setWorkId] = useState("");
  const [work, setWork] = useState<WorkDraft>({ title: "", photoIds: [] });
  const load = useCallback(async () => {
    const [nextCatalog, nextPhotos] = await Promise.all([
      editCatalog.load(),
      getAllPhotos.execute(),
    ]);
    setCatalog(nextCatalog);
    setPhotos(nextPhotos ?? []);
  }, []);
  useEffect(() => {
    void load().catch(() => setError("The catalog could not be loaded."));
  }, [load]);
  async function save(action: () => Promise<void>, reset?: () => void) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      reset?.();
      setNotice("Saved.");
      try {
        await load();
      } catch {
        setError(
          "Saved, but the refreshed catalog could not be loaded. Reload before editing again.",
        );
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save. Your edits are still here.",
      );
    } finally {
      setBusy(false);
    }
  }
  function remove(
    kind: "collections" | "categories" | "works",
    id: string,
    reset: () => void,
  ) {
    if (
      window.confirm(
        "Remove this grouping? The photo files and comments will remain.",
      )
    )
      void save(() => editCatalog.remove(kind, id), reset);
  }
  function categories(selected: string[], update: (ids: string[]) => void) {
    return (
      <fieldset>
        <legend>Categories</legend>
        {catalog?.categories.map((category) => (
          <label key={category.id}>
            <input
              type="checkbox"
              checked={selected.includes(category.id)}
              onChange={() => update(toggle(selected, category.id))}
            />
            {category.name}
          </label>
        ))}
        {!catalog?.categories.length && (
          <p>Create a category below to classify your photos.</p>
        )}
      </fieldset>
    );
  }
  function move(index: number, offset: number) {
    const entries = [...draft.entries];
    [entries[index], entries[index + offset]] = [
      entries[index + offset],
      entries[index],
    ];
    setDraft({ ...draft, entries });
  }
  const preview = catalog
    ? {
        ...catalog,
        collections: [
          {
            id: "preview",
            title: draft.title,
            categories: [],
            entries: draft.entries,
          },
        ],
      }
    : null;
  return (
    <div className="catalog-editor">
      {error && (
        <p role="alert">
          {error}{" "}
          <button disabled={busy} onClick={() => void save(load)}>
            Reload catalog
          </button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!catalog ? (
        <p>Loading catalog…</p>
      ) : (
        <fieldset disabled={busy}>
          <section>
            <h2>Collections</h2>
            <label>
              Edit collection
              <select
                value={collectionId}
                onChange={(event) => {
                  const id = event.target.value;
                  setCollectionId(id);
                  const selected = catalog.collections.find(
                    (item) => item.id === id,
                  );
                  setDraft(
                    selected
                      ? {
                          title: selected.title,
                          categoryIds: selected.categories.map(
                            (category) => category.id,
                          ),
                          entries: selected.entries.map(
                            ({ photoId, columns, rows }) => ({
                              photoId,
                              columns,
                              rows,
                            }),
                          ),
                        }
                      : emptyCollection(),
                  );
                }}
              >
                <option value="">New collection</option>
                {catalog.collections.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void save(
                  () =>
                    editCatalog.saveCollection(
                      draft,
                      collectionId || undefined,
                    ),
                  () => {
                    setCollectionId("");
                    setDraft(emptyCollection());
                  },
                );
              }}
            >
              <fieldset>
                <label>
                  Collection title
                  <input
                    required
                    maxLength={160}
                    value={draft.title}
                    onChange={(event) =>
                      setDraft({ ...draft, title: event.target.value })
                    }
                  />
                </label>
                {categories(draft.categoryIds, (categoryIds) =>
                  setDraft({ ...draft, categoryIds }),
                )}
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
                            {
                              photoId: event.target.value,
                              columns: 1,
                              rows: 1,
                            },
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
                <p>
                  Move photos to set their priority. Width and height use a
                  four-column canvas that keeps the same composition on phones.
                  When variants share a work, its first entry sets the displayed
                  variant and size.
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
                                  entries: draft.entries.map(
                                    (item, position) =>
                                      position === index
                                        ? {
                                            ...item,
                                            [dimension]: Number(
                                              event.target.value,
                                            ),
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
                        <button
                          type="button"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              entries: draft.entries.filter(
                                (item) => item.photoId !== entry.photoId,
                              ),
                            })
                          }
                        >
                          Remove photo
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
                <button type="submit">Save collection</button>
              </fieldset>
            </form>
            {collectionId && (
              <button
                onClick={() =>
                  remove("collections", collectionId, () => {
                    setCollectionId("");
                    setDraft(emptyCollection());
                  })
                }
              >
                Delete collection
              </button>
            )}
            {preview && draft.entries.length > 0 && (
              <div>
                <h3>Composition preview</h3>
                <CollectionMosaic
                  tiles={selectCatalog(photos, preview, "", "preview")}
                  mosaic
                />
              </div>
            )}
          </section>
          <section>
            <h2>Categories</h2>
            <label>
              Edit category
              <select
                value={categoryId}
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  setCategoryName(
                    catalog.categories.find(
                      (item) => item.id === event.target.value,
                    )?.name ?? "",
                  );
                }}
              >
                <option value="">New category</option>
                {catalog.categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void save(
                  () =>
                    editCatalog.saveCategory(
                      categoryName,
                      categoryId || undefined,
                    ),
                  () => {
                    setCategoryId("");
                    setCategoryName("");
                  },
                );
              }}
            >
              <fieldset>
                <label>
                  Category name
                  <input
                    required
                    maxLength={80}
                    value={categoryName}
                    onChange={(event) => setCategoryName(event.target.value)}
                  />
                </label>
                <button>Save category</button>
              </fieldset>
            </form>
            {categoryId && (
              <button
                onClick={() =>
                  remove("categories", categoryId, () => {
                    setCategoryId("");
                    setCategoryName("");
                    setDraft({
                      ...draft,
                      categoryIds: draft.categoryIds.filter(
                        (id) => id !== categoryId,
                      ),
                    });
                    setPhotoCategories(
                      photoCategories.filter((id) => id !== categoryId),
                    );
                  })
                }
              >
                Delete category
              </button>
            )}
          </section>
          <section>
            <h2>Photo categories</h2>
            <label>
              Photo
              <select
                value={photoId}
                onChange={(event) => {
                  setPhotoId(event.target.value);
                  setPhotoCategories(
                    catalog.photos
                      .find((photo) => photo.id === event.target.value)
                      ?.categories.map((category) => category.id) ?? [],
                  );
                }}
              >
                <option value="">Choose a photo</option>
                {photos.map((photo) => (
                  <option key={photo.getId()} value={photo.getId()}>
                    {photo.getTitle()}
                  </option>
                ))}
              </select>
            </label>
            {photoId && (
              <>
                {categories(photoCategories, setPhotoCategories)}
                <button
                  onClick={() =>
                    void save(() =>
                      editCatalog.setPhotoCategories(photoId, photoCategories),
                    )
                  }
                >
                  Save photo categories
                </button>
              </>
            )}
          </section>
          <section>
            <h2>Photo variants</h2>
            <p>
              Group two or more files as one work. The gallery shows one tile
              with a variant selector. Each file keeps its comments and its own
              viewer URL.
            </p>
            <label>
              Edit work
              <select
                value={workId}
                onChange={(event) => {
                  setWorkId(event.target.value);
                  const item = catalog.works.find(
                    (item) => item.id === event.target.value,
                  );
                  setWork(
                    item
                      ? {
                          title: item.title,
                          photoIds: item.variants.map(
                            (variant) => variant.photoId,
                          ),
                        }
                      : { title: "", photoIds: [] },
                  );
                }}
              >
                <option value="">New work</option>
                {catalog.works.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void save(
                  () => editCatalog.saveWork(work, workId || undefined),
                  () => {
                    setWorkId("");
                    setWork({ title: "", photoIds: [] });
                  },
                );
              }}
            >
              <fieldset>
                <label>
                  Work title
                  <input
                    required
                    maxLength={160}
                    value={work.title}
                    onChange={(event) =>
                      setWork({ ...work, title: event.target.value })
                    }
                  />
                </label>
                {photos.map((photo) => {
                  const assigned = catalog.works.some(
                    (item) =>
                      item.id !== workId &&
                      item.variants.some(
                        (variant) => variant.photoId === photo.getId(),
                      ),
                  );
                  return (
                    <label key={photo.getId()}>
                      <input
                        type="checkbox"
                        disabled={assigned}
                        checked={work.photoIds.includes(photo.getId())}
                        onChange={() =>
                          setWork({
                            ...work,
                            photoIds: toggle(work.photoIds, photo.getId()),
                          })
                        }
                      />
                      {photo.getTitle()}
                      {assigned && " (already grouped)"}
                    </label>
                  );
                })}
                <button disabled={work.photoIds.length < 2}>
                  Save variants
                </button>
              </fieldset>
            </form>
            {workId && (
              <button
                onClick={() =>
                  remove("works", workId, () => {
                    setWorkId("");
                    setWork({ title: "", photoIds: [] });
                  })
                }
              >
                Ungroup variants
              </button>
            )}
          </section>
        </fieldset>
      )}
    </div>
  );
}
