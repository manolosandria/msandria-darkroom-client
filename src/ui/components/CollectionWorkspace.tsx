"use client";

import styles from "./EditorFeedback.module.css";

import { useId, useState } from "react";
import {
  Catalog,
  CatalogCollection,
  COLLECTION_TEXT_ALIGNS,
  COLLECTION_TEXT_STYLES,
  CollectionDraft,
  CollectionTextAlign,
  CollectionTextStyle,
} from "@/src/domain/entities/Catalog";
import {
  CollectionBlock,
  DEFAULT_PHOTO_SIZE,
  DEFAULT_TEXT_SIZE,
  MOBILE_MOSAIC_COLUMNS,
  MOSAIC_COLUMNS,
  MOSAIC_MAX_ROWS,
  mergeBlocks,
  mobileSpan,
  MosaicLayout,
  newTextKey,
  BlockPatch,
  PhotoBlock,
  splitBlocks,
  TextBlock,
} from "@/src/domain/collectionLayout";
import { Photo } from "@/src/domain/entities/Photo";
import { manageCatalog } from "@/src/infrastructure/catalogServices";
import { PhotoImage } from "./PhotoImage";
import { InspectorSection } from "./InspectorSection";
import { VariantThumbs } from "./VariantThumbs";
import { PhotoPicker } from "./PhotoPicker";
import { CollectionCanvas, isHiddenFromPublic } from "./CollectionCanvas";
import { useEditingWorkspace, useUnsavedEditor } from "./EditingWorkspace";
import { CatalogConflictError } from "@/src/domain/errors/CatalogConflictError";

/** The editor keeps photos and text blocks in one reading order. */
type EditorDraft = Omit<CollectionDraft, "entries" | "texts"> & {
  blocks: CollectionBlock[];
};
const empty = (): EditorDraft => ({
  title: "",
  description: "",
  coverPhotoId: null,
  showVariants: false,
  categoryIds: [],
  blocks: [],
});
const fromCollection = (collection?: CatalogCollection): EditorDraft =>
  collection
    ? {
        version: collection.version,
        title: collection.title,
        description: collection.description ?? "",
        coverPhotoId: collection.coverPhotoId ?? null,
        showVariants: collection.showVariants ?? false,
        categoryIds: collection.categories.map((category) => category.id),
        blocks: mergeBlocks(collection.entries, collection.texts),
      }
    : empty();
const toPayload = (
  { blocks, ...draft }: EditorDraft,
  excluded: string[] = [],
): CollectionDraft => ({ ...draft, ...splitBlocks(blocks, excluded) });
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
  refresh: () => Promise<unknown>;
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
                <span className="studio-collection-plus">
                  <span />
                </span>
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
  refresh: () => Promise<unknown>;
  onClose: () => void;
  onCreated: () => void;
  onDeleted: () => void;
  active: boolean;
}) {
  const [baseline, setBaseline] = useState(() => fromCollection(collection));
  const [conflict, setConflict] = useState(false);
  const [draft, setDraft] = useState(() => fromCollection(collection));
  const [excluded, setExcluded] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [layout, setLayout] = useState<MosaicLayout>("desktop");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [openSections, setOpenSections] = useState<string[]>([
    "photo",
    "details",
    "categories",
    "display",
  ]);
  const prefix = useId();
  const { confirm } = useEditingWorkspace();
  const composition = toPayload(draft, excluded);
  const included = composition.entries;
  const existingCategoryIds = (ids: string[]) =>
    ids.filter((id) =>
      catalog.categories.some((category) => category.id === id),
    );
  const payload: CollectionDraft = {
    ...composition,
    description: draft.description?.trim() ?? "",
    categoryIds: existingCategoryIds(draft.categoryIds),
    coverPhotoId: included.some((entry) => entry.photoId === draft.coverPhotoId)
      ? draft.coverPhotoId
      : null,
  };
  const saved = toPayload(baseline);
  const dirty =
    JSON.stringify(payload) !==
    JSON.stringify({
      ...saved,
      categoryIds: existingCategoryIds(saved.categoryIds),
    });
  const privatePhotos = included.flatMap((entry) => {
    const photo = findPhoto(photos, entry.photoId);
    return photo && isHiddenFromPublic(photo) ? [photo.getTitle()] : [];
  });
  function update(next: Partial<EditorDraft>) {
    setDraft((previous) => ({ ...previous, ...next }));
    setNotice("");
  }
  function updateBlock(key: string, next: BlockPatch) {
    setDraft((previous) => ({
      ...previous,
      blocks: previous.blocks.map((block) =>
        block.key === key ? ({ ...block, ...next } as CollectionBlock) : block,
      ),
    }));
    setNotice("");
  }
  // A size set in the phone layout becomes the piece's own; the wide one stays.
  function resize(key: string, columns: number, rows: number) {
    updateBlock(
      key,
      layout === "mobile"
        ? { mobileColumns: columns, mobileRows: rows }
        : { columns, rows },
    );
  }
  function move(from: number, to: number) {
    setDraft((previous) => {
      if (to < 0 || to >= previous.blocks.length) return previous;
      const blocks = [...previous.blocks];
      const [block] = blocks.splice(from, 1);
      blocks.splice(to, 0, block);
      return { ...previous, blocks };
    });
    setNotice("");
  }
  // A new text block goes right after the selected piece, or at the end.
  function addText() {
    const key = newTextKey();
    setDraft((previous) => {
      const at = previous.blocks.findIndex((block) => block.key === selected);
      const blocks = [...previous.blocks];
      blocks.splice(at < 0 ? blocks.length : at + 1, 0, {
        kind: "text",
        key,
        text: "",
        style: "BODY",
        align: "START",
        ...DEFAULT_TEXT_SIZE,
      });
      return { ...previous, blocks };
    });
    setSelected(key);
    setNotice("");
    toggleSection("photo", true);
  }
  function removeText(key: string) {
    setDraft((previous) => ({
      ...previous,
      blocks: previous.blocks.filter((block) => block.key !== key),
    }));
    setSelected(null);
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
    if (payload.texts?.some((text) => !text.text.trim())) {
      setError(
        "Write something in every text block, or remove the empty ones.",
      );
      return false;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await manageCatalog.saveCollection(
        payload,
        id || undefined,
      );
      const next = id
        ? {
            ...draft,
            ...payload,
            blocks: draft.blocks.filter(
              (block) =>
                block.kind === "text" || !excluded.includes(block.photoId),
            ),
            version: result.version,
          }
        : empty();
      setBaseline(next);
      setDraft(next);
      setExcluded([]);
      setSelected(null);
      setNotice("Saved.");
      setConflict(false);
      window.dispatchEvent(new Event("curator:catalog-changed"));
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
      setConflict(failure instanceof CatalogConflictError);
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
  const index = draft.blocks.findIndex((block) => block.key === selected);
  const block = draft.blocks[index];
  const entry = block?.kind === "photo" ? block : undefined;
  const photoCount = draft.blocks.filter(
    (item) => item.kind === "photo",
  ).length;
  const photoIndex = draft.blocks
    .slice(0, Math.max(index, 0))
    .filter((item) => item.kind === "photo").length;
  const work = entry
    ? catalog.works.find((item) =>
        item.variants.some((v) => v.photoId === entry.photoId),
      )
    : undefined;
  function chooseVariant(nextId: string) {
    if (!entry) return;
    const key = `photo:${nextId}`;
    update({
      blocks: draft.blocks.map((item) =>
        item.key === entry.key ? { ...entry, photoId: nextId, key } : item,
      ),
      coverPhotoId:
        draft.coverPhotoId === entry.photoId ? nextId : draft.coverPhotoId,
    });
    setExcluded((previous) =>
      previous.map((id) => (id === entry.photoId ? nextId : id)),
    );
    setSelected(key);
  }
  const sectionOpen = (key: string) => openSections.includes(key);
  function toggleSection(key: string, open: boolean) {
    setOpenSections((previous) =>
      open
        ? previous.includes(key)
          ? previous
          : [...previous, key]
        : previous.filter((item) => item !== key),
    );
  }
  function jump(key: string) {
    toggleSection(key, true);
    requestAnimationFrame(() =>
      document
        .getElementById(`${prefix}-${key}`)
        ?.scrollIntoView?.({ behavior: "smooth", block: "start" }),
    );
  }
  return (
    <form
      className="studio-editor collection-develop"
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
        {conflict && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (
                !(await confirm(
                  "Reload collection?",
                  "Discard this collection's edits and load the latest saved composition?",
                ))
              )
                return;
              setBusy(true);
              try {
                const latest = (await manageCatalog.load()).collections.find(
                  (item) => item.id === id,
                );
                if (!latest) throw new Error("This collection was removed.");
                const next = fromCollection(latest);
                setBaseline(next);
                setDraft(next);
                setExcluded([]);
                setConflict(false);
                setError("");
                await refresh();
              } catch {
                setError(
                  "Could not reload the collection. Your edits are kept.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Reload state
          </button>
        )}
        {notice && <p role="status">{notice}</p>}
        <PhotoPicker
          catalog={catalog}
          photos={photos.filter(
            (photo) =>
              !draft.blocks.some(
                (item) =>
                  item.kind === "photo" && item.photoId === photo.getId(),
              ),
          )}
          onPick={(photo) => {
            const key = `photo:${photo.getId()}`;
            update({
              blocks: [
                ...draft.blocks,
                {
                  kind: "photo",
                  key,
                  photoId: photo.getId(),
                  ...DEFAULT_PHOTO_SIZE,
                  showTitle: true,
                },
              ],
            });
            setSelected(key);
            toggleSection("photo", true);
          }}
        />
        <div className="collection-develop__layout">
          <section
            className="collection-develop__stage"
            aria-label="Composition"
          >
            <div className="collection-develop__bar">
              <div
                className="collection-layout-switch"
                role="group"
                aria-label="Layout"
              >
                <button
                  type="button"
                  aria-pressed={layout === "desktop"}
                  onClick={() => setLayout("desktop")}
                >
                  <LayoutIcon kind="desktop" />
                  Wide screens
                </button>
                <button
                  type="button"
                  aria-pressed={layout === "mobile"}
                  onClick={() => setLayout("mobile")}
                >
                  <LayoutIcon kind="mobile" />
                  Phones
                </button>
              </div>
              <button
                type="button"
                className="collection-add-text"
                onClick={addText}
              >
                <span aria-hidden="true">T+</span> Add text block
              </button>
            </div>
            <p className="collection-develop__hint">
              {layout === "desktop"
                ? `Drag a piece to change its place, or pull its edges or corner to resize it, on a ${MOSAIC_COLUMNS}-column grid.`
                : `Phones show ${MOBILE_MOSAIC_COLUMNS} columns in the same order. Resizing here gives a piece its own phone size; the others follow their wide size.`}
            </p>
            {privatePhotos.length > 0 && (
              <p role="alert" className={styles.warning}>
                Private or reserved photos will not appear in the public
                collection, regardless of their position:{" "}
                {privatePhotos.join(", ")}.
              </p>
            )}
            {draft.blocks.length ? (
              <div
                className={`collection-develop__device collection-develop__device--${layout}`}
              >
                <CollectionCanvas
                  blocks={draft.blocks}
                  photos={photos}
                  layout={layout}
                  selectedKey={selected}
                  coverId={payload.coverPhotoId ?? null}
                  excluded={excluded}
                  onSelect={(key) => {
                    setSelected(key);
                    toggleSection("photo", true);
                  }}
                  onMove={move}
                  onResize={(position, columns, rows) =>
                    resize(draft.blocks[position].key, columns, rows)
                  }
                />
              </div>
            ) : (
              <p className="studio-empty">
                Add photos or a text block to start the composition.
              </p>
            )}
          </section>
          <div className="photo-develop__inspector collection-develop__inspector">
            <nav
              className="photo-develop__tabs"
              aria-label="Collection sections"
            >
              {COLLECTION_SECTIONS.map((section) => (
                <button
                  type="button"
                  key={section.id}
                  onClick={() => jump(section.id)}
                >
                  {section.label}
                </button>
              ))}
            </nav>
            <InspectorSection
              id={`${prefix}-photo`}
              label={
                block?.kind === "text" ? "Selected text" : "Selected photo"
              }
              summary={
                entry
                  ? `${photoIndex + 1} of ${photoCount}`
                  : block
                    ? "Text"
                    : "None"
              }
              open={sectionOpen("photo")}
              onToggle={(open) => toggleSection("photo", open)}
            >
              <aside
                aria-label={
                  entry
                    ? "Photo details"
                    : block
                      ? "Text block details"
                      : "Collection details"
                }
              >
                {entry ? (
                  <>
                    {work && (
                      <div className="studio-fields">
                        <span className="collection-develop__label">
                          Collection variant
                        </span>
                        <VariantThumbs
                          className="collection-develop__variants"
                          label="Collection variant"
                          variants={work.variants.flatMap((v) => {
                            const variant = findPhoto(photos, v.photoId);
                            return variant &&
                              (v.photoId === entry.photoId ||
                                !draft.blocks.some(
                                  (item) =>
                                    item.kind === "photo" &&
                                    item.photoId === v.photoId,
                                ))
                              ? [variant]
                              : [];
                          })}
                          selectedId={entry.photoId}
                          onSelect={chooseVariant}
                        />
                      </div>
                    )}
                    <EntryDetails
                      entry={entry}
                      index={photoIndex}
                      count={photoCount}
                      first={index === 0}
                      last={index === draft.blocks.length - 1}
                      photo={findPhoto(photos, entry.photoId)}
                      isCover={payload.coverPhotoId === entry.photoId}
                      removed={excluded.includes(entry.photoId)}
                      onBack={() => setSelected(null)}
                      onMove={(offset) => move(index, index + offset)}
                      onChange={(next) => updateBlock(entry.key, next)}
                      onCover={(cover) =>
                        update({ coverPhotoId: cover ? entry.photoId : null })
                      }
                      onToggleRemoved={() =>
                        setExcluded(toggle(excluded, entry.photoId))
                      }
                    />
                  </>
                ) : block?.kind === "text" ? (
                  <TextDetails
                    block={block}
                    first={index === 0}
                    last={index === draft.blocks.length - 1}
                    onBack={() => setSelected(null)}
                    onMove={(offset) => move(index, index + offset)}
                    onChange={(next) => updateBlock(block.key, next)}
                    onRemove={() => removeText(block.key)}
                  />
                ) : (
                  <p className="upload-muted">
                    Select a piece in the composition to resize it, give a photo
                    its own text, hide its title or use it as the cover.
                  </p>
                )}
              </aside>
            </InspectorSection>
            <InspectorSection
              id={`${prefix}-details`}
              label="Details"
              open={sectionOpen("details")}
              onToggle={(open) => toggleSection("details", open)}
            >
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
              </div>
            </InspectorSection>
            <InspectorSection
              id={`${prefix}-categories`}
              label="Categories"
              summary={String(existingCategoryIds(draft.categoryIds).length)}
              open={sectionOpen("categories")}
              onToggle={(open) => toggleSection("categories", open)}
            >
              <fieldset className="studio-fields">
                <legend className="sr-only">Categories</legend>
                <div className="studio-checks">
                  {catalog.categories.map((category) => (
                    <label key={category.id} className="studio-check">
                      <input
                        type="checkbox"
                        checked={draft.categoryIds.includes(category.id)}
                        onChange={() =>
                          update({
                            categoryIds: toggle(draft.categoryIds, category.id),
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
            </InspectorSection>
            <InspectorSection
              id={`${prefix}-display`}
              label="Display"
              summary={draft.showVariants ? "Variants" : undefined}
              open={sectionOpen("display")}
              onToggle={(open) => toggleSection("display", open)}
            >
              <label className="studio-check">
                <input
                  type="checkbox"
                  checked={draft.showVariants === true}
                  onChange={(event) =>
                    update({ showVariants: event.target.checked })
                  }
                />
                Let visitors switch variants in this collection
              </label>
              <p className="upload-muted">
                Works with several variants show small thumbnails under their
                photo in the public mosaic.
              </p>
            </InspectorSection>
            {id && (
              <InspectorSection
                id={`${prefix}-danger`}
                label="Delete"
                open={sectionOpen("danger")}
                onToggle={(open) => toggleSection("danger", open)}
              >
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
                      setError("Could not delete or refresh this collection.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Delete collection
                </button>
              </InspectorSection>
            )}
          </div>
        </div>
      </fieldset>
    </form>
  );
}

const COLLECTION_SECTIONS = [
  { id: "photo", label: "Selection" },
  { id: "details", label: "Details" },
  { id: "categories", label: "Categories" },
  { id: "display", label: "Display" },
] as const;

function EntryDetails({
  entry,
  index,
  count,
  first,
  last,
  photo,
  isCover,
  removed,
  onBack,
  onMove,
  onChange,
  onCover,
  onToggleRemoved,
}: {
  entry: PhotoBlock;
  index: number;
  count: number;
  first: boolean;
  last: boolean;
  photo?: Photo;
  isCover: boolean;
  removed: boolean;
  onBack: () => void;
  onMove: (offset: number) => void;
  onChange: (next: Partial<PhotoBlock>) => void;
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
      <MoveButtons first={first} last={last} onMove={onMove} />
      <SizeFields size={entry} onChange={onChange} />
      <label className="studio-caption-field">
        Text with the photo
        <textarea
          maxLength={500}
          rows={3}
          value={entry.caption ?? ""}
          placeholder="A line that travels with this photo, shown under it"
          onChange={(event) => onChange({ caption: event.target.value })}
        />
        <small className="upload-muted">
          Shown under the photo, in the same piece. Leave empty for none.
        </small>
      </label>
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

function MoveButtons({
  first,
  last,
  onMove,
}: {
  first: boolean;
  last: boolean;
  onMove: (offset: number) => void;
}) {
  return (
    <div className="studio-row">
      <button type="button" disabled={first} onClick={() => onMove(-1)}>
        ← Move earlier
      </button>
      <button type="button" disabled={last} onClick={() => onMove(1)}>
        Move later →
      </button>
    </div>
  );
}

function CellSelect({
  label,
  device,
  value,
  max,
  disabled,
  onChange,
}: {
  label: string;
  device: string;
  value: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span>
        {label}
        <span className="sr-only"> on {device}</span>
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {Array.from({ length: max }, (_, cell) => (
          <option key={cell + 1}>{cell + 1}</option>
        ))}
      </select>
    </label>
  );
}

/**
 * Wide size in cells of the eight-column grid, and the phone size: derived from the
 * wide one unless the piece has its own.
 */
function SizeFields({
  size,
  onChange,
}: {
  size: PhotoBlock | TextBlock;
  onChange: (next: BlockPatch) => void;
}) {
  const phone = mobileSpan(size);
  return (
    <fieldset className="studio-size">
      <legend>Size in cells</legend>
      <div className="studio-size__row">
        <span className="studio-size__device">
          <LayoutIcon kind="desktop" /> Wide
        </span>
        <CellSelect
          label="Width"
          device="wide screens"
          value={size.columns}
          max={MOSAIC_COLUMNS}
          onChange={(columns) => onChange({ columns })}
        />
        <CellSelect
          label="Height"
          device="wide screens"
          value={size.rows}
          max={MOSAIC_MAX_ROWS}
          onChange={(rows) => onChange({ rows })}
        />
      </div>
      <div className="studio-size__row">
        <span className="studio-size__device">
          <LayoutIcon kind="mobile" /> Phone
        </span>
        <CellSelect
          label="Width"
          device="phones"
          value={phone.columns}
          max={MOBILE_MOSAIC_COLUMNS}
          disabled={!phone.custom}
          onChange={(mobileColumns) =>
            onChange({ mobileColumns, mobileRows: phone.rows })
          }
        />
        <CellSelect
          label="Height"
          device="phones"
          value={phone.rows}
          max={MOSAIC_MAX_ROWS}
          disabled={!phone.custom}
          onChange={(mobileRows) =>
            onChange({ mobileColumns: phone.columns, mobileRows })
          }
        />
      </div>
      <label className="studio-check">
        <input
          type="checkbox"
          checked={phone.custom}
          onChange={(event) =>
            onChange(
              event.target.checked
                ? { mobileColumns: phone.columns, mobileRows: phone.rows }
                : { mobileColumns: null, mobileRows: null },
            )
          }
        />
        Own size on phones
      </label>
      {!phone.custom && (
        <small className="upload-muted">
          Follows the wide size on the {MOBILE_MOSAIC_COLUMNS}-column phone
          grid.
        </small>
      )}
    </fieldset>
  );
}

const STYLE_LABELS: Record<CollectionTextStyle, string> = {
  HEADING: "Heading",
  BODY: "Paragraph",
  QUOTE: "Quote",
};
const ALIGN_LABELS: Record<CollectionTextAlign, string> = {
  START: "Left",
  CENTER: "Center",
  END: "Right",
};

function TextDetails({
  block,
  first,
  last,
  onBack,
  onMove,
  onChange,
  onRemove,
}: {
  block: TextBlock;
  first: boolean;
  last: boolean;
  onBack: () => void;
  onMove: (offset: number) => void;
  onChange: (next: Partial<TextBlock>) => void;
  onRemove: () => void;
}) {
  const style = block.style ?? "BODY";
  const align = block.align ?? "START";
  return (
    <div className="studio-fields">
      <button type="button" className="studio-back" onClick={onBack}>
        ← Collection details
      </button>
      <label>
        Text
        <textarea
          maxLength={2000}
          rows={5}
          value={block.text}
          autoFocus={!block.text}
          placeholder="A title, a note or a few lines between the photos"
          onChange={(event) => onChange({ text: event.target.value })}
        />
      </label>
      <div className="text-style-choice" role="group" aria-label="Text style">
        {COLLECTION_TEXT_STYLES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={style === value}
            data-style={value}
            onClick={() => onChange({ style: value })}
          >
            <span aria-hidden="true">{value === "QUOTE" ? "“”" : "Aa"}</span>
            {STYLE_LABELS[value]}
          </button>
        ))}
      </div>
      <div className="text-align-choice" role="group" aria-label="Alignment">
        {COLLECTION_TEXT_ALIGNS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={align === value}
            aria-label={ALIGN_LABELS[value]}
            title={ALIGN_LABELS[value]}
            onClick={() => onChange({ align: value })}
          >
            <AlignIcon align={value} />
          </button>
        ))}
      </div>
      <MoveButtons first={first} last={last} onMove={onMove} />
      <SizeFields size={block} onChange={onChange} />
      <button type="button" className="studio-danger" onClick={onRemove}>
        Remove text block
      </button>
    </div>
  );
}

function AlignIcon({ align }: { align: CollectionTextAlign }) {
  const x = (width: number) =>
    align === "START" ? 3 : align === "END" ? 21 - width : 12 - width / 2;
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      {[18, 12, 16, 10].map((width, line) => (
        <rect
          key={line}
          x={x(width)}
          y={5 + line * 4}
          width={width}
          height="2"
          rx="1"
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

function LayoutIcon({ kind }: { kind: MosaicLayout }) {
  return kind === "desktop" ? (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <rect
        x="3"
        y="4"
        width="18"
        height="12"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M9 20h6M12 16v4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <rect
        x="7"
        y="3"
        width="10"
        height="18"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M11 18h2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
