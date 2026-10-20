"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Catalog, WorkDraft } from "@/src/domain/entities/Catalog";
import { Photo } from "@/src/domain/entities/Photo";
import { manageCatalog as editCatalog } from "@/src/infrastructure/catalogServices";
import { getManagedPhotos as getAllPhotos } from "@/src/infrastructure/photoServices";
import { CollectionWorkspace } from "./CollectionWorkspace";
import { EditingBoundary } from "./EditingWorkspace";
import { useSessionValue } from "./SessionProvider";
import { ErrorMessage } from "./ErrorMessage";

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
  return (
    <EditingBoundary>
      <CatalogEditorContent />
    </EditingBoundary>
  );
}

function CatalogEditorContent() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
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
    const refresh = () => {
      void load().catch(() => setError("The catalog could not be loaded."));
    };
    refresh();
    window.addEventListener("curator:catalog-changed", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("curator:catalog-changed", refresh);
      window.removeEventListener("focus", refresh);
    };
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
          <CollectionWorkspace
            catalog={catalog}
            photos={photos}
            refresh={load}
          />
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
