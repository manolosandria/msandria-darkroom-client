"use client";

import styles from "./EditorFeedback.module.css";
import "./photoStudio.css";

import { ReactNode, useId, useState } from "react";
import {
  Catalog,
  CatalogCollection,
  COLLECTION_TEXT_ALIGNS,
  CollectionDraft,
  CollectionTextAlign,
} from "@/src/domain/entities/Catalog";
import {
  arrangePieces,
  CollectionBlock,
  DEFAULT_PHOTO_SIZE,
  DEFAULT_TEXT_SIZE,
  flowPieces,
  MOBILE_MOSAIC_COLUMNS,
  MOSAIC_COLUMNS,
  MOSAIC_MAX_ROWS,
  mergeBlocks,
  mobileSpan,
  MosaicCell,
  MosaicLayout,
  newTextKey,
  BlockPatch,
  PhotoBlock,
  placePieces,
  splitBlocks,
  spanIn,
  TextBlock,
} from "@/src/domain/collectionLayout";
import { Photo } from "@/src/domain/entities/Photo";
import { manageCatalog } from "@/src/infrastructure/catalogServices";
import { PhotoImage } from "./PhotoImage";
import { PropertyTabs, propertyPanel } from "./PropertyTabs";
import { EditorActions } from "./EditorActions";
import { TEXT_STYLE_LABELS, TextStyleChoice } from "./TextStyleChoice";
import { DeviceFrame, DeviceSwitch } from "./DeviceSwitch";
import { VISIBILITY_LABELS } from "./PhotoBadges";
import { VariantThumbs } from "./VariantThumbs";
import { PhotoPicker } from "./PhotoPicker";
import { CollectionCanvas, isHiddenFromPublic } from "./CollectionCanvas";
import { useEditingWorkspace, useUnsavedEditor } from "./EditingWorkspace";
import { CatalogConflictError } from "@/src/domain/errors/CatalogConflictError";
import UploadPanel from "./UploadPanel";
import { EmptyState } from "./EmptyState";

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
// The chosen cover, else the first of its photos that is at hand.
const coverOf = (collection: CatalogCollection, photos: Photo[]) =>
  findPhoto(photos, collection.coverPhotoId) ??
  collection.entries
    .map((entry) => findPhoto(photos, entry.photoId))
    .find(Boolean);

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
          <EmptyState picture="collections" title="Choose a collection" quiet>
            Its categories, description and photos show here. A double click
            opens it in the editor.
          </EmptyState>
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

// The inspector's tabs, as Home and Gallery show theirs.
const COLLECTION_TABS = ["Piece", "Details", "Categories", "Display"] as const;
type CollectionTab = (typeof COLLECTION_TABS)[number];

function CollectionEditor({
  id,
  collection,
  catalog,
  photos: libraryPhotos,
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
  const [uploadedPhotos, setUploadedPhotos] = useState<Photo[]>([]);
  const [pendingUploads, setPendingUploads] = useState(false);
  const [showUploads, setShowUploads] = useState(false);
  const [uploadsOpened, setUploadsOpened] = useState(false);
  const photos = [
    ...libraryPhotos,
    ...uploadedPhotos.filter(
      (photo) => !libraryPhotos.some((item) => item.getId() === photo.getId()),
    ),
  ];
  const [baseline, setBaseline] = useState(() => fromCollection(collection));
  const [conflict, setConflict] = useState(false);
  const [draft, setDraft] = useState(() => fromCollection(collection));
  const [excluded, setExcluded] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [layout, setLayout] = useState<MosaicLayout>("desktop");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<CollectionTab>("Details");
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
  // A piece moved on the wide grid keeps its cell; the ones it lands on step down.
  function place(key: string, cell: MosaicCell) {
    setDraft((previous) => ({
      ...previous,
      blocks: arrangePieces(previous.blocks, key, cell),
    }));
    setNotice("");
  }
  // A wide resize pushes down what it now covers; a phone size is the piece's own.
  function resizeWide(key: string, columns: number, rows: number) {
    setDraft((previous) => ({
      ...previous,
      blocks: arrangePieces(
        previous.blocks.map((block) =>
          block.key === key ? { ...block, columns, rows } : block,
        ),
        key,
      ),
    }));
    setNotice("");
  }
  function resize(key: string, columns: number, rows: number) {
    if (layout === "mobile")
      updateBlock(key, { mobileColumns: columns, mobileRows: rows });
    else resizeWide(key, columns, rows);
  }
  function select(key: string | null) {
    setSelected(key);
    if (key) setTab("Piece");
  }
  // Leaving a piece returns to the collection's own details.
  function deselect() {
    setSelected(null);
    setTab("Details");
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
    select(key);
    setNotice("");
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
    setUploadsOpened(false);
    setShowUploads(false);
    setPendingUploads(false);
    setDraft(baseline);
    setExcluded([]);
    setError("");
    setNotice("");
  }
  async function persist(): Promise<boolean> {
    if (pendingUploads) {
      setError(
        "Upload or remove the prepared photos before saving the collection.",
      );
      return false;
    }
    if (busy) return false;
    if (!draft.title.trim()) {
      setError("Give this collection a title before saving.");
      setTab("Details");
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
  const { review } = useUnsavedEditor(dirty || pendingUploads, {
    label: draft.title || "New collection",
    save: persist,
    discard,
    document: {
      original: baseline,
      draft,
      restore: (value) => setDraft(value as typeof draft),
    },
  });

  const index = draft.blocks.findIndex((block) => block.key === selected);
  const block = draft.blocks[index];
  const cell = block ? placePieces(draft.blocks)[index] : undefined;
  const entry = block?.kind === "photo" ? block : undefined;
  const photoCount = draft.blocks.filter(
    (item) => item.kind === "photo",
  ).length;
  const photoIndex = draft.blocks
    .slice(0, Math.max(index, 0))
    .filter((item) => item.kind === "photo").length;
  const pinned = draft.blocks.some((item) => item.row);
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
  const canvasNode = (
    <CollectionCanvas
      blocks={draft.blocks}
      photos={photos}
      layout={layout}
      selectedKey={selected}
      coverId={payload.coverPhotoId ?? null}
      excluded={excluded}
      onSelect={select}
      onPlace={place}
      onResize={resize}
    />
  );
  const layoutFields = block && cell && (
    <PieceLayoutFields
      size={block}
      cell={cell}
      onWide={(columns, rows) => resizeWide(block.key, columns, rows)}
      onPlace={(next) => place(block.key, next)}
      onPhone={(next) => updateBlock(block.key, next)}
    />
  );
  return (
    <form
      id={`${prefix}-form`}
      hidden={!active}
      className="studio-editor collection-develop"
      onSubmit={async (event) => {
        event.preventDefault();
        // The review lists this collection's changes alone; others stay as drafts.
        if (!busy) await review();
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
          <EditorActions
            form={`${prefix}-form`}
            busy={busy}
            dirty={dirty}
            canSave
            saveLabel="Save collection"
            onCancel={async () => {
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
          />
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
            select(key);
          }}
        />
        <div className="collection-upload">
          <button
            type="button"
            className="upload-secondary"
            aria-expanded={showUploads}
            onClick={() => {
              setUploadsOpened(true);
              setShowUploads(!showUploads);
            }}
          >
            Upload new photos…
          </button>
          <div hidden={!showUploads}>
            <p>
              Uploaded photos are stored immediately. Save collection to keep
              them in this composition.
            </p>
            {uploadsOpened && (
              <UploadPanel
                embedded
                onPendingChange={setPendingUploads}
                onPublished={({ photo }) => {
                  setUploadedPhotos((previous) => [...previous, photo]);
                  const key = `photo:${photo.getId()}`;
                  setDraft((previous) => ({
                    ...previous,
                    blocks: [
                      ...previous.blocks,
                      {
                        kind: "photo",
                        key,
                        photoId: photo.getId(),
                        ...DEFAULT_PHOTO_SIZE,
                        showTitle: true,
                      },
                    ],
                  }));
                  setSelected(key);
                }}
              />
            )}
          </div>
        </div>
        <div className="collection-develop__layout">
          <section
            className="collection-develop__stage"
            aria-label="Composition"
          >
            <div className="collection-develop__bar">
              <DeviceSwitch
                label="Layout"
                tone="dark"
                value={layout}
                onChange={setLayout}
              />
              <div className="collection-develop__tools">
                {pinned && layout === "desktop" && (
                  <button
                    type="button"
                    className="collection-add-text"
                    title="Let every piece follow the one before, without empty cells"
                    onClick={() => update({ blocks: flowPieces(draft.blocks) })}
                  >
                    <GapIcon /> Close gaps
                  </button>
                )}
                <button
                  type="button"
                  className="collection-add-text"
                  onClick={addText}
                >
                  <span aria-hidden="true">T+</span> Add text block
                </button>
              </div>
            </div>
            <p className="collection-develop__hint">
              {layout === "desktop"
                ? `Drag a piece to any cell of the ${MOSAIC_COLUMNS}-column grid, under another or with empty cells around it; the pieces in its way step down. Pull its edges or corner to resize it, or use the arrow keys on a selected piece.`
                : `Phones show ${MOBILE_MOSAIC_COLUMNS} columns, reading the wide layout from top to bottom. Resizing here gives a piece its own phone size; the others follow their wide size.`}
            </p>
            {privatePhotos.length > 0 && (
              <p role="alert" className={styles.warning}>
                Private or reserved photos will not appear in the public
                collection, regardless of their position:{" "}
                {privatePhotos.join(", ")}.
              </p>
            )}
            {draft.blocks.length ? (
              layout === "mobile" ? (
                <DeviceFrame
                  device="mobile"
                  className="collection-develop__phone"
                >
                  {canvasNode}
                </DeviceFrame>
              ) : (
                canvasNode
              )
            ) : (
              <p className="studio-empty">
                Add photos or a text block to start the composition.
              </p>
            )}
          </section>
          <div className="collection-develop__inspector">
            <PropertyTabs
              label="Collection properties"
              idPrefix={prefix}
              tabs={COLLECTION_TABS}
              value={tab}
              onChange={setTab}
            />
            <div
              className="collection-panel"
              {...propertyPanel(prefix, "Piece", tab)}
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
                  <EntryDetails
                    entry={entry}
                    index={photoIndex}
                    count={photoCount}
                    photo={findPhoto(photos, entry.photoId)}
                    isCover={payload.coverPhotoId === entry.photoId}
                    removed={excluded.includes(entry.photoId)}
                    layoutFields={layoutFields}
                    variants={
                      work && (
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
                      )
                    }
                    onBack={deselect}
                    onChange={(next) => updateBlock(entry.key, next)}
                    onCover={(cover) =>
                      update({ coverPhotoId: cover ? entry.photoId : null })
                    }
                    onToggleRemoved={() =>
                      setExcluded(toggle(excluded, entry.photoId))
                    }
                  />
                ) : block?.kind === "text" ? (
                  <TextDetails
                    block={block}
                    layoutFields={layoutFields}
                    onBack={deselect}
                    onChange={(next) => updateBlock(block.key, next)}
                    onRemove={() => removeText(block.key)}
                  />
                ) : (
                  <EmptyState
                    picture="collections"
                    title="No piece selected"
                    quiet
                  >
                    Choose a photo or a text block in the composition to place
                    it, resize it, give it its own text or make it the cover.
                  </EmptyState>
                )}
              </aside>
            </div>
            <div
              className="collection-panel"
              {...propertyPanel(prefix, "Details", tab)}
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
              {id && (
                <div className="collection-panel__danger">
                  <p className="upload-muted">
                    Deleting the collection keeps its photos and their comments.
                  </p>
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
                </div>
              )}
            </div>
            <fieldset
              className="collection-panel"
              {...propertyPanel(prefix, "Categories", tab)}
            >
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
                  Create one in the Categories tab to classify this collection.
                </p>
              )}
            </fieldset>
            <div
              className="collection-panel"
              {...propertyPanel(prefix, "Display", tab)}
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
            </div>
          </div>
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
  layoutFields,
  variants,
  onBack,
  onChange,
  onCover,
  onToggleRemoved,
}: {
  entry: PhotoBlock;
  index: number;
  count: number;
  photo?: Photo;
  isCover: boolean;
  removed: boolean;
  layoutFields: ReactNode;
  variants: ReactNode;
  onBack: () => void;
  onChange: (next: Partial<PhotoBlock>) => void;
  onCover: (cover: boolean) => void;
  onToggleRemoved: () => void;
}) {
  const hidden = isHiddenFromPublic(photo);
  return (
    <div className="studio-fields">
      <div className="piece-heading">
        <div
          className={`piece-heading__thumb${hidden ? " studio-thumbnail--private" : ""}`}
        >
          {photo && (
            <PhotoImage
              photo={photo}
              className="object-cover"
              fallbackSizes="96px"
              maxWidth={160}
              crop={photo.getHighlights().square}
            />
          )}
        </div>
        <div>
          <h3>{photo?.getTitle() ?? "Unavailable photo"}</h3>
          <p className="upload-muted">
            Photo {index + 1} of {count}
            {photo &&
              ` · ${VISIBILITY_LABELS[photo.getClassification().visibility]}`}
          </p>
        </div>
        <button
          type="button"
          className="piece-heading__close"
          aria-label="Back to the collection"
          title="Deselect"
          onClick={onBack}
        >
          ×
        </button>
      </div>
      {hidden && (
        <p className={styles.warning}>
          This photo is private or reserved: it keeps its place here but will
          not be shown in the public collection.
        </p>
      )}
      {variants && (
        <div className="piece-group">
          <span className="piece-group__title">Variant shown</span>
          {variants}
        </div>
      )}
      {layoutFields}
      <div className="piece-group">
        <label className="studio-caption-field">
          <span className="piece-group__title">Text with the photo</span>
          <textarea
            maxLength={500}
            rows={3}
            value={entry.caption ?? ""}
            placeholder="A line that travels with this photo, shown under it"
            onChange={(event) => onChange({ caption: event.target.value })}
          />
        </label>
        <label className="studio-check">
          <input
            type="checkbox"
            checked={entry.showTitle !== false}
            onChange={(event) => onChange({ showTitle: event.target.checked })}
          />
          Show title in the collection
        </label>
      </div>
      <div className="piece-actions">
        {isCover ? (
          <button
            type="button"
            className="piece-actions__cover"
            aria-pressed="true"
            onClick={() => onCover(false)}
          >
            <span aria-hidden="true">★</span> Collection cover
          </button>
        ) : (
          <button
            type="button"
            className="piece-actions__cover"
            aria-pressed="false"
            disabled={removed}
            onClick={() => onCover(true)}
          >
            <span aria-hidden="true">☆</span> Use as collection cover
          </button>
        )}
        <button
          type="button"
          className={removed ? "" : "studio-danger"}
          onClick={onToggleRemoved}
        >
          {removed ? "Keep in collection" : "Remove from collection"}
        </button>
      </div>
      {removed && (
        <span className="upload-muted">Will be removed when you save</span>
      )}
    </div>
  );
}

/**
 * A size in cells, changed one cell at a time: − and + around the number, which
 * says how many of the most it may take.
 */
function CellStepper({
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
  const name = label.toLowerCase();
  return (
    <div
      className="cell-stepper"
      role="group"
      aria-label={`${label} on ${device}`}
      data-disabled={disabled || undefined}
    >
      <span className="cell-stepper__label">{label}</span>
      <button
        type="button"
        aria-label={`Less ${name}`}
        disabled={disabled || value <= 1}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <output aria-label={`${label} in cells`}>{value}</output>
      <button
        type="button"
        aria-label={`More ${name}`}
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}

/** A small drawing of the grid with the piece's cells lit. */
function Footprint({
  columns,
  width,
  height,
  start = 1,
}: {
  columns: number;
  width: number;
  height: number;
  start?: number;
}) {
  return (
    <span
      className="cell-footprint"
      aria-hidden="true"
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {Array.from({ length: columns * height }, (_, cell) => {
        const column = (cell % columns) + 1;
        return (
          <span
            key={cell}
            data-on={(column >= start && column < start + width) || undefined}
          />
        );
      })}
    </span>
  );
}

const MOVES: { label: string; arrow: string; step: MosaicCell }[] = [
  { label: "Move up", arrow: "↑", step: { row: -1, column: 0 } },
  { label: "Move left", arrow: "←", step: { row: 0, column: -1 } },
  { label: "Move right", arrow: "→", step: { row: 0, column: 1 } },
  { label: "Move down", arrow: "↓", step: { row: 1, column: 0 } },
];

/**
 * Where a piece sits and how large it is: its wide size and cell, moved one cell at
 * a time, and its phone size, its own or derived from the wide one.
 */
function PieceLayoutFields({
  size,
  cell,
  onWide,
  onPlace,
  onPhone,
}: {
  size: PhotoBlock | TextBlock;
  cell: MosaicCell;
  onWide: (columns: number, rows: number) => void;
  onPlace: (cell: MosaicCell) => void;
  onPhone: (next: BlockPatch) => void;
}) {
  const wide = spanIn(size, "desktop");
  const phone = mobileSpan(size);
  return (
    <div className="piece-layout">
      <div
        className="piece-layout__card"
        role="group"
        aria-label="On wide screens"
      >
        <header>
          <LayoutIcon kind="desktop" />
          <strong>Wide screens</strong>
          <small>
            {wide.columns} × {wide.rows} cells
          </small>
        </header>
        <Footprint
          columns={MOSAIC_COLUMNS}
          width={wide.columns}
          height={wide.rows}
          start={cell.column}
        />
        <div className="piece-layout__steppers">
          <CellStepper
            label="Width"
            device="wide screens"
            value={wide.columns}
            max={MOSAIC_COLUMNS}
            onChange={(columns) => onWide(columns, wide.rows)}
          />
          <CellStepper
            label="Height"
            device="wide screens"
            value={wide.rows}
            max={MOSAIC_MAX_ROWS}
            onChange={(rows) => onWide(wide.columns, rows)}
          />
        </div>
        <div className="piece-layout__place">
          <div
            className="piece-pad"
            role="group"
            aria-label="Place on wide screens"
          >
            {MOVES.map(({ label, arrow, step }) => {
              const next = {
                row: cell.row + step.row,
                column: cell.column + step.column,
              };
              const blocked =
                next.row < 1 ||
                next.column < 1 ||
                next.column + wide.columns - 1 > MOSAIC_COLUMNS;
              return (
                <button
                  key={label}
                  type="button"
                  aria-label={label}
                  title={label}
                  data-step={label.split(" ")[1]}
                  disabled={blocked}
                  onClick={() => onPlace(next)}
                >
                  {arrow}
                </button>
              );
            })}
          </div>
          <p className="piece-layout__cell">
            <span>Row</span> <b>{cell.row}</b>
            <span>Column</span> <b>{cell.column}</b>
          </p>
        </div>
      </div>
      <div className="piece-layout__card" role="group" aria-label="On phones">
        <header>
          <LayoutIcon kind="mobile" />
          <strong>Phones</strong>
          <small>
            {phone.columns} × {phone.rows} cells
          </small>
        </header>
        <label className="studio-check">
          <input
            type="checkbox"
            checked={phone.custom}
            onChange={(event) =>
              onPhone(
                event.target.checked
                  ? { mobileColumns: phone.columns, mobileRows: phone.rows }
                  : { mobileColumns: null, mobileRows: null },
              )
            }
          />
          Own size on phones
        </label>
        {phone.custom ? (
          <div className="piece-layout__steppers">
            <Footprint
              columns={MOBILE_MOSAIC_COLUMNS}
              width={phone.columns}
              height={phone.rows}
            />
            <CellStepper
              label="Width"
              device="phones"
              value={phone.columns}
              max={MOBILE_MOSAIC_COLUMNS}
              onChange={(mobileColumns) =>
                onPhone({ mobileColumns, mobileRows: phone.rows })
              }
            />
            <CellStepper
              label="Height"
              device="phones"
              value={phone.rows}
              max={MOSAIC_MAX_ROWS}
              onChange={(mobileRows) =>
                onPhone({ mobileColumns: phone.columns, mobileRows })
              }
            />
          </div>
        ) : (
          <small className="upload-muted">
            Follows the wide size on the {MOBILE_MOSAIC_COLUMNS}-column phone
            grid.
          </small>
        )}
      </div>
    </div>
  );
}

const ALIGN_LABELS: Record<CollectionTextAlign, string> = {
  START: "Left",
  CENTER: "Center",
  END: "Right",
};

function TextDetails({
  block,
  layoutFields,
  onBack,
  onChange,
  onRemove,
}: {
  block: TextBlock;
  layoutFields: ReactNode;
  onBack: () => void;
  onChange: (next: Partial<TextBlock>) => void;
  onRemove: () => void;
}) {
  const style = block.style ?? "BODY";
  const align = block.align ?? "START";
  return (
    <div className="studio-fields">
      <div className="piece-heading">
        <div className="piece-heading__thumb piece-heading__thumb--text">
          <span aria-hidden="true">T</span>
        </div>
        <div>
          <h3>Text block</h3>
          <p className="upload-muted">{TEXT_STYLE_LABELS[style]}</p>
        </div>
        <button
          type="button"
          className="piece-heading__close"
          aria-label="Back to the collection"
          title="Deselect"
          onClick={onBack}
        >
          ×
        </button>
      </div>
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
      <TextStyleChoice
        value={style}
        onChange={(value) => onChange({ style: value })}
      />
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
      {layoutFields}
      <div className="piece-actions">
        <button type="button" className="studio-danger" onClick={onRemove}>
          Remove text block
        </button>
      </div>
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

function GapIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="7" height="14" rx="1" />
      <rect x="14" y="5" width="7" height="14" rx="1" />
      <path d="M10.5 12h3M12 10.5 13.5 12 12 13.5" strokeLinecap="round" />
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
