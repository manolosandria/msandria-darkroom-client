"use client";
import "./catalogStudio.css";
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
import { VariantStudio } from "./VariantStudio";
import { ChoiceMenu } from "./ChoiceMenu";

const TABS = ["Collections", "Categories"] as const;
type Tab = (typeof TABS)[number] | "Variants";

const toggle = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];

export default function ManageCollections({
  variants = false,
  only,
}: {
  variants?: boolean;
  /** Shows one part of the catalog without its own tabs, as Curator's menu does. */
  only?: "Collections" | "Categories";
}) {
  const session = useSessionValue();
  return (
    <main className="upload-workspace">
      <div className="upload-container">
        <div className="upload-heading">
          <span className="upload-eyebrow">
            THE DARKROOM /{" "}
            {variants ? "VARIANTS" : (only ?? "Collections").toUpperCase()}
          </span>
          <h1>
            {variants
              ? "One moment. Many expressions."
              : "Arrange your stories."}
          </h1>
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
          <CatalogEditor variants={variants} only={only} />
        ) : (
          <p>
            Sign in as the gallery&apos;s administrator to edit collections.
          </p>
        )}
      </div>
    </main>
  );
}

export function CatalogEditor({
  variants = false,
  only,
}: {
  variants?: boolean;
  only?: (typeof TABS)[number];
}) {
  return (
    <EditingBoundary>
      <CatalogEditorContent variants={variants} only={only} />
    </EditingBoundary>
  );
}

function CatalogEditorContent({
  variants,
  only,
}: {
  variants: boolean;
  only?: (typeof TABS)[number];
}) {
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
  const [chosen, setTab] = useState<Tab>(variants ? "Variants" : "Collections");
  const tab = only ?? chosen;
  const load = useCallback(async () => {
    const [nextCatalog, nextPhotos] = await Promise.all([
      editCatalog.load(),
      getAllPhotos.execute(),
    ]);
    setCatalog(nextCatalog);
    setPhotos(nextPhotos ?? []);
    return nextCatalog;
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
  async function save(action: () => Promise<unknown>, reset?: () => void) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      reset?.();
      window.dispatchEvent(new Event("curator:catalog-changed"));
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
          <p>Create a category above to classify your photos.</p>
        )}
      </fieldset>
    );
  }
  return (
    <div className="catalog-editor">
      {error && (
        <p role="alert">
          {error}{" "}
          <button
            disabled={busy}
            onClick={async () => {
              if (
                workId &&
                !window.confirm(
                  "Discard the current variant edits and reload the saved catalog?",
                )
              )
                return;
              setBusy(true);
              try {
                const latest = await load();
                const current = latest.works.find((item) => item.id === workId);
                setWork(
                  current
                    ? {
                        version: current.version,
                        title: current.title,
                        photoIds: current.variants.map(
                          (variant) => variant.photoId,
                        ),
                      }
                    : { title: "", photoIds: [] },
                );
                if (!current) setWorkId("");
                setError("");
                setNotice("Catalog reloaded.");
              } catch {
                setError("Could not reload the catalog. Your edits are kept.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Reload catalog
          </button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!catalog ? (
        <p>Loading catalog…</p>
      ) : (
        <>
          {!variants && !only && (
            <div role="tablist" aria-label="Catalog" className="studio-tabs">
              {TABS.map((name) => (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  id={`studio-tab-${name}`}
                  aria-controls={`studio-panel-${name}`}
                  aria-selected={tab === name}
                  onClick={() => setTab(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
          {/* Collections stays mounted so its drafts survive a visit to another tab. */}
          <section
            role="tabpanel"
            id="studio-panel-Collections"
            aria-labelledby="studio-tab-Collections"
            className="studio-card studio-card--collections"
            hidden={tab !== "Collections"}
          >
            <CollectionWorkspace
              catalog={catalog}
              photos={photos}
              refresh={load}
            />
          </section>
          {tab === "Categories" && (
            <fieldset
              disabled={busy}
              role="tabpanel"
              id="studio-panel-Categories"
              aria-labelledby="studio-tab-Categories"
              className="studio-card studio-card--categories"
            >
              <section
                className="category-studio__library"
                aria-label="Category library"
              >
                <header className="category-studio__head">
                  <h2>Categories</h2>
                  <p className="upload-muted">
                    Small labels. New ways to discover your photographs.
                  </p>
                </header>
                <div className="category-browser">
                  <button
                    type="button"
                    className="category-browser__new"
                    aria-pressed={!categoryId}
                    onClick={() => {
                      setCategoryId("");
                      setCategoryName("");
                    }}
                  >
                    <span className="category-browser__plus" aria-hidden="true">
                      ＋
                    </span>
                    New category
                  </button>
                  {catalog.categories.map((item) => {
                    const members = catalog.photos.filter((photo) =>
                      photo.categories.some(
                        (category) => category.id === item.id,
                      ),
                    );
                    return (
                      <button
                        type="button"
                        key={item.id}
                        aria-pressed={categoryId === item.id}
                        onClick={() => {
                          setCategoryId(item.id);
                          setCategoryName(item.name);
                        }}
                      >
                        <span
                          className="category-browser__peek"
                          aria-hidden="true"
                        >
                          {members.slice(0, 3).map((member) => {
                            const photo = photos.find(
                              (candidate) => candidate.getId() === member.id,
                            );
                            return photo ? (
                              <PhotoThumb key={member.id} photo={photo} />
                            ) : null;
                          })}
                        </span>
                        <strong>{item.name}</strong>
                        <small>
                          {members.length}{" "}
                          {members.length === 1 ? "photo" : "photos"}
                        </small>
                      </button>
                    );
                  })}
                </div>
              </section>
              <aside className="category-studio__side">
                <section className="category-studio__editor">
                  <h3>
                    {categoryId
                      ? `Edit ${catalog.categories.find((item) => item.id === categoryId)?.name ?? "category"}`
                      : "New category"}
                  </h3>
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
                    <label>
                      Category name
                      <input
                        required
                        maxLength={80}
                        value={categoryName}
                        placeholder="Street, Night, Portraits…"
                        onChange={(event) =>
                          setCategoryName(event.target.value)
                        }
                      />
                    </label>
                    <div className="category-studio__actions">
                      <button className="studio-save">Save category</button>
                      {categoryId && (
                        <button
                          type="button"
                          className="category-studio__delete"
                          onClick={() =>
                            remove("categories", categoryId, () => {
                              setCategoryId("");
                              setCategoryName("");
                              setPhotoCategories(
                                photoCategories.filter(
                                  (id) => id !== categoryId,
                                ),
                              );
                            })
                          }
                        >
                          Delete category
                        </button>
                      )}
                    </div>
                  </form>
                </section>
                <section className="category-studio__classify">
                  <h3>Photo categories</h3>
                  <p className="upload-muted">
                    Choose a photograph, then switch its categories on or off.
                  </p>
                  <label>
                    Photo
                    <ChoiceMenu
                      value={photoId}
                      placeholder="Choose a photo"
                      onChange={(id) => {
                        setPhotoId(id);
                        setPhotoCategories(
                          catalog.photos
                            .find((photo) => photo.id === id)
                            ?.categories.map((category) => category.id) ?? [],
                        );
                      }}
                      options={photos.map((photo) => ({
                        value: photo.getId(),
                        label: photo.getTitle(),
                        icon: <PhotoThumb photo={photo} />,
                      }))}
                    />
                  </label>
                  {photoId && (
                    <>
                      {categories(photoCategories, setPhotoCategories)}
                      <button
                        className="studio-save"
                        onClick={() =>
                          void save(() =>
                            editCatalog.setPhotoCategories(
                              photoId,
                              photoCategories,
                              photos
                                .find((photo) => photo.getId() === photoId)
                                ?.getVersion(),
                            ),
                          )
                        }
                      >
                        Save photo categories
                      </button>
                    </>
                  )}
                </section>
              </aside>
            </fieldset>
          )}
          {tab === "Variants" && (
            <fieldset
              disabled={busy}
              role="tabpanel"
              id="studio-panel-Variants"
              aria-label="Photo variants"
              className="studio-card studio-card--variants"
            >
              <section>
                <h2>Photo variants</h2>
                <p>
                  Group two or more files as one work. The gallery shows one
                  tile with a variant selector. Each file keeps its comments and
                  its own viewer URL.
                </p>
                <VariantStudio
                  catalog={catalog}
                  photos={photos}
                  busy={busy}
                  workId={workId}
                  work={work}
                  onOpen={(id) => {
                    const item = catalog.works.find((item) => item.id === id);
                    setWorkId(item ? id : "");
                    setWork(
                      item
                        ? {
                            title: item.title,
                            version: item.version,
                            photoIds: item.variants.map((v) => v.photoId),
                          }
                        : { title: "", photoIds: [] },
                    );
                  }}
                  onChange={setWork}
                  onSave={() =>
                    void save(
                      () => editCatalog.saveWork(work, workId || undefined),
                      () => {
                        setWorkId("");
                        setWork({ title: "", photoIds: [] });
                      },
                    )
                  }
                  onUngroup={() =>
                    remove("works", workId, () => {
                      setWorkId("");
                      setWork({ title: "", photoIds: [] });
                    })
                  }
                />
              </section>
            </fieldset>
          )}
        </>
      )}
    </div>
  );
}

// The smallest rendition of a photo, as the drawing of its menu option.
function PhotoThumb({ photo }: { photo: Photo }) {
  const [smallest] = [...photo.getRenditions()].sort(
    (a, b) => a.width - b.width,
  );
  return smallest ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="choice-menu__thumb"
      src={smallest.url}
      alt=""
      loading="lazy"
    />
  ) : null;
}
