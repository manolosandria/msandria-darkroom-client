"use client";
import { useEffect, useRef, useState } from "react";
import { CatalogCategory } from "@/src/domain/entities/Catalog";
import {
  defaultGallerySettings,
  defaultGalleryPalettes,
  GalleryAppearance,
  GallerySettings,
} from "@/src/domain/entities/GallerySettings";
import { manageGallerySettings } from "@/src/infrastructure/gallerySettingsServices";
import { manageCatalog } from "@/src/infrastructure/catalogServices";
import { useSessionValue } from "./SessionProvider";
import { useEditingWorkspace, useUnsavedEditor } from "./EditingWorkspace";
import { groupGalleryCategories } from "./galleryCategoryGroups";
import { GalleryDepartmentsEditor } from "./GalleryDepartmentsEditor";
import { GalleryPageLayoutEditor } from "./GalleryPageLayoutEditor";
import { GalleryFilterBuilder } from "./GalleryFilterBuilder";
import { PropertyTabs, propertyPanel } from "./PropertyTabs";
import { EditorActions } from "./EditorActions";
import Gallery from "./Gallery";
import { GalleryOptionsEditor } from "./GalleryOptionsEditor";
import { GalleryPaletteLibrary, PaletteSwatch } from "./GalleryPaletteLibrary";
import { GALLERY_SETTINGS_SAVED } from "./PaletteManager";
import { DisplayIcon } from "./DisplayIcon";
import "./homeBannerEditor.css";
import "./galleryStudio.css";

// The studio's settings, one group at a time beside the preview.
const galleryTabs = [
  "Style",
  "Page",
  "Filters",
  "Photos",
  "Introduction",
  "Visitors",
] as const;

export default function GalleryEditor() {
  const { user } = useSessionValue();
  return user?.isAdmin() ? (
    <Editor />
  ) : (
    <p>Sign in as the administrator to edit Gallery.</p>
  );
}
function Editor() {
  const [saved, setSaved] = useState<GallerySettings | null>(null);
  const [draft, setDraft] = useState(defaultGallerySettings);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mobile, setMobile] = useState(false);
  const [tab, setTab] = useState<(typeof galleryTabs)[number]>("Style");
  const lock = useRef(false);
  const { confirm } = useEditingWorkspace();
  const dirty =
    saved !== null && JSON.stringify(saved) !== JSON.stringify(draft);
  async function load() {
    setBusy(true);
    setError("");
    try {
      const [settings, catalog] = await Promise.all([
        manageGallerySettings.get(),
        manageCatalog.load(),
      ]);
      setSaved(settings);
      setDraft(settings);
      setCategories(catalog.categories);
      setNotice("");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  // Palettes saved in their own tab arrive with the new version; the rest of a draft stays.
  useEffect(() => {
    const adopt = (event: Event) => {
      const settings = (event as CustomEvent<GallerySettings>).detail;
      if (!settings) return;
      const patch = { palettes: settings.palettes, version: settings.version };
      setSaved((previous) => (previous ? { ...previous, ...patch } : previous));
      setDraft((previous) => ({ ...previous, ...patch }));
    };
    window.addEventListener(GALLERY_SETTINGS_SAVED, adopt);
    return () => window.removeEventListener(GALLERY_SETTINGS_SAVED, adopt);
  }, []);
  async function save() {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await manageGallerySettings.save(draft);
      setSaved(result);
      setDraft(result);
      setNotice("Gallery design saved.");
      window.dispatchEvent(
        new CustomEvent(GALLERY_SETTINGS_SAVED, { detail: result }),
      );
      return true;
    } catch (failure) {
      setError((failure as Error).message);
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  useUnsavedEditor(dirty, {
    label: "Gallery design",
    save,
    discard: () => {
      if (saved) setDraft(saved);
    },
  });
  const category = draft.categories.find((item) => item.categoryId === target);
  const appearance = category?.customize
    ? category.appearance
    : draft.appearance;
  function updateCategory(
    patch: Partial<GallerySettings["categories"][number]>,
  ) {
    setDraft((previous) => {
      const existing = previous.categories.find(
        (item) => item.categoryId === target,
      );
      const group =
        groupGalleryCategories(categories).find((item) =>
          item.categories.some((c) => c.id === target),
        )?.label ?? "Other";
      const value = {
        categoryId: target,
        group,
        customize: false,
        appearance: { ...previous.appearance },
        ...existing,
        ...patch,
      };
      return {
        ...previous,
        categories: [
          ...previous.categories.filter((item) => item.categoryId !== target),
          value,
        ],
      };
    });
    setNotice("");
  }
  function changeAppearance(next: GalleryAppearance) {
    if (target) updateCategory({ appearance: next });
    else {
      setDraft((previous) => ({ ...previous, appearance: next }));
      setNotice("");
    }
  }
  return (
    <div className="banner-editor gallery-editor">
      <header>
        <p className="banner-editor__eyebrow">CURATOR / GALLERY</p>
        <h1>Shape the archive.</h1>
        <p>
          Edit the introduction, category styles and photo arrangement. Save to
          apply your preview for everyone.
        </p>
        {saved && (
          <EditorActions
            form="gallery-settings-form"
            busy={busy}
            dirty={dirty}
            saveLabel="Save gallery"
            onCancel={async () => {
              if (
                await confirm("Cancel changes?", "Return to the saved design?")
              ) {
                setDraft(saved);
                setNotice("");
              }
            }}
            onRestore={async () => {
              if (
                await confirm(
                  "Restore original design?",
                  "Load the original gallery design into your draft?",
                )
              )
                setDraft({
                  ...defaultGallerySettings,
                  version: saved.version,
                });
            }}
          />
        )}
      </header>
      {error && (
        <p role="alert">
          {error}{" "}
          <button
            disabled={busy}
            onClick={async () => {
              if (
                !dirty ||
                (await confirm(
                  "Reload design?",
                  "Discard your draft and load the latest saved design?",
                ))
              )
                await load();
            }}
          >
            Reload state
          </button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!saved ? (
        <p>
          {busy
            ? "Loading gallery design…"
            : "Gallery settings are unavailable."}
        </p>
      ) : (
        <div
          className={`banner-editor__workspace${tab === "Filters" ? " is-wide" : ""}`}
        >
          <form
            id="gallery-settings-form"
            className="banner-editor__properties"
            onSubmit={async (event) => {
              event.preventDefault();
              await save();
            }}
          >
            <PropertyTabs
              label="Gallery properties"
              idPrefix="gallery"
              tabs={galleryTabs}
              value={tab}
              onChange={setTab}
            />
            <div {...propertyPanel("gallery", "Page", tab)}>
              <GalleryPageLayoutEditor
                value={draft.pageLayout}
                disabled={busy}
                onChange={(pageLayout) => {
                  setDraft((previous) => ({ ...previous, pageLayout }));
                  setNotice("");
                }}
              />
            </div>
            <fieldset
              disabled={busy}
              className="gallery-editor-style"
              {...propertyPanel("gallery", "Style", tab)}
            >
              <legend>Type & color</legend>
              <label>
                Edit style for
                <select
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                >
                  <option value="">All photographs · general style</option>
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              {target && (
                <>
                  <label className="gallery-editor-check">
                    <input
                      type="checkbox"
                      checked={category?.customize ?? false}
                      onChange={(event) =>
                        updateCategory({ customize: event.target.checked })
                      }
                    />
                    Customize this category
                  </label>
                  <p>
                    Otherwise this category follows the general style. Select it
                    in the preview to see its design.
                  </p>
                </>
              )}
              <TypeColorFields
                value={appearance}
                disabled={!!target && !category?.customize}
                onChange={changeAppearance}
              />
              <details className="palette-drawer">
                <summary>
                  <PaletteSwatch colors={appearance} />
                  <span>Palettes</span>
                  <small>
                    {(draft.palettes ?? defaultGalleryPalettes).length} saved
                  </small>
                </summary>
                <GalleryPaletteLibrary
                  palettes={draft.palettes ?? defaultGalleryPalettes}
                  appearance={appearance}
                  disabled={busy}
                  applyDisabled={!!target && !category?.customize}
                  onChange={(palettes) => {
                    setDraft((previous) => ({ ...previous, palettes }));
                    setNotice("");
                  }}
                  onApply={(colors) =>
                    changeAppearance({ ...appearance, ...colors })
                  }
                />
                <p className="palette-drawer__note">
                  Curator → Palettes shows where each color goes.
                </p>
              </details>
            </fieldset>
            <div {...propertyPanel("gallery", "Filters", tab)}>
              <GalleryFilterBuilder
                categories={categories}
                settings={draft}
                disabled={busy}
                onChange={(filterLayout) => {
                  setDraft((previous) => {
                    const next = { ...previous, filterLayout };
                    if (!filterLayout) delete next.filterLayout;
                    return next;
                  });
                  setNotice("");
                }}
              />
              <GalleryDepartmentsEditor
                categories={categories}
                settings={draft}
                disabled={busy}
                onChange={(departments) => {
                  setDraft((previous) => {
                    const next = { ...previous, departments };
                    if (!departments) delete next.departments;
                    return next;
                  });
                  setNotice("");
                }}
              />
            </div>
            <div {...propertyPanel("gallery", "Photos", tab)}>
              <ArrangementFields
                value={appearance}
                disabled={busy || (!!target && !category?.customize)}
                onChange={changeAppearance}
              />
            </div>
            <fieldset
              disabled={busy}
              {...propertyPanel("gallery", "Introduction", tab)}
            >
              <legend>Introduction</legend>
              <p>
                Empty text is hidden. Remove every block to show only the
                filters and photographs.
              </p>
              <ol className="gallery-editor-blocks">
                {draft.blocks.map((block, index) => (
                  <li
                    className="gallery-editor-block"
                    data-kind={block.kind}
                    key={index}
                  >
                    <div className="gallery-editor-block__head">
                      <span className="gallery-editor-block__number">
                        {index + 1}
                      </span>
                      <strong>{BLOCK_KINDS[block.kind] ?? block.kind}</strong>
                      <button
                        type="button"
                        className="gallery-editor-block__remove"
                        aria-label={`Remove text ${index + 1}`}
                        title="Remove this text"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            blocks: draft.blocks.filter((_, i) => i !== index),
                          })
                        }
                      >
                        ×
                      </button>
                    </div>
                    <label>
                      Text {index + 1}
                      <textarea
                        maxLength={1000}
                        value={block.text}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            blocks: draft.blocks.map((item, i) =>
                              i === index
                                ? { ...item, text: event.target.value }
                                : item,
                            ),
                          })
                        }
                      />
                    </label>
                    <div className="gallery-editor-block__row">
                      <label>
                        Role {index + 1}
                        <select
                          value={block.kind}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              blocks: draft.blocks.map((item, i) =>
                                i === index
                                  ? { ...item, kind: event.target.value }
                                  : item,
                              ),
                            })
                          }
                        >
                          {Object.entries(BLOCK_KINDS).map(([kind, label]) => (
                            <option key={kind} value={kind}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Text font {index + 1}
                        <select
                          value={block.font}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              blocks: draft.blocks.map((item, i) =>
                                i === index
                                  ? { ...item, font: event.target.value }
                                  : item,
                              ),
                            })
                          }
                        >
                          <option value="inherit">Use gallery font</option>
                          <FontOptions />
                        </select>
                      </label>
                    </div>
                    <label>
                      Text size {index + 1} · {block.size}px
                      <input
                        type="range"
                        min={10}
                        max={100}
                        value={block.size}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            blocks: draft.blocks.map((item, i) =>
                              i === index
                                ? { ...item, size: Number(event.target.value) }
                                : item,
                            ),
                          })
                        }
                      />
                    </label>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                className="gallery-editor-add"
                disabled={draft.blocks.length >= 12}
                onClick={() =>
                  setDraft({
                    ...draft,
                    blocks: [
                      ...draft.blocks,
                      { kind: "body", text: "", size: 17, font: "inherit" },
                    ],
                  })
                }
              >
                + Add text
              </button>
            </fieldset>
            <div {...propertyPanel("gallery", "Visitors", tab)}>
              <GalleryOptionsEditor
                value={draft.visitorOptions}
                disabled={busy}
                onChange={(visitorOptions) => {
                  setDraft((previous) => ({ ...previous, visitorOptions }));
                  setNotice("");
                }}
              />
            </div>
          </form>
          <section
            className="banner-editor__preview device-preview"
            aria-label="Gallery preview"
          >
            <div className="device-preview__bar">
              <h2>Live preview</h2>
              <div
                className="device-switch"
                role="radiogroup"
                aria-label="Preview device"
              >
                {(["desktop", "mobile"] as const).map((device) => (
                  <button
                    key={device}
                    type="button"
                    role="radio"
                    aria-checked={mobile === (device === "mobile")}
                    title={device === "mobile" ? "Phone" : "Desktop monitor"}
                    onClick={() => setMobile(device === "mobile")}
                  >
                    <DisplayIcon kind={device} />
                    <span>{device === "mobile" ? "Phone" : "Desktop"}</span>
                  </button>
                ))}
              </div>
              {dirty && <span>Unsaved preview</span>}
            </div>
            <div
              className={`device-frame device-frame--${mobile ? "mobile" : "desktop"}`}
            >
              <div
                className={`banner-editor__viewport ${mobile ? "banner-editor__viewport--mobile" : ""}`}
              >
                <Gallery settings={draft} />
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function FontOptions() {
  return (
    <>
      <option value="serif">Editorial · Georgia</option>
      <option value="sans">Clean · Arial</option>
      <option value="mono">Monospace · Courier</option>
    </>
  );
}
const BLOCK_KINDS: Record<string, string> = {
  eyebrow: "Eyebrow",
  title: "Title",
  body: "Description",
};
type AppearanceProps = {
  value: GalleryAppearance;
  disabled: boolean;
  onChange: (value: GalleryAppearance) => void;
};
const COLOR_HINTS = {
  background: "Page",
  text: "Text",
  accent: "Accent",
  surface: "Surface",
};
function TypeColorFields({ value, disabled, onChange }: AppearanceProps) {
  return (
    <fieldset disabled={disabled} className="gallery-editor-type">
      <legend className="sr-only">Type and colors</legend>
      <label>
        Gallery font
        <select
          value={value.font}
          onChange={(event) => onChange({ ...value, font: event.target.value })}
        >
          <FontOptions />
        </select>
      </label>
      <div className="gallery-editor-colors">
        {(["background", "text", "accent", "surface"] as const).map((key) => (
          <label key={key}>
            <input
              type="color"
              aria-label={key}
              value={value[key]}
              onChange={(event) =>
                onChange({ ...value, [key]: event.target.value })
              }
            />
            <span>{COLOR_HINTS[key]}</span>
            <small>{value[key]}</small>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
function ArrangementFields({ value, disabled, onChange }: AppearanceProps) {
  return (
    <fieldset disabled={disabled}>
      <legend>Photographs</legend>
      <label>
        Photo arrangement
        <select
          value={value.layout}
          onChange={(event) =>
            onChange({ ...value, layout: event.target.value })
          }
        >
          <option value="justified">
            Natural proportions · justified rows
          </option>
          <option value="uniform">Even grid</option>
          <option value="random">
            Random emphasis · up to two large photographs
          </option>
        </select>
      </label>
      <label>
        Photo size · {value.tileSize}px
        <input
          type="range"
          min={120}
          max={400}
          value={value.tileSize}
          onChange={(event) =>
            onChange({ ...value, tileSize: Number(event.target.value) })
          }
        />
      </label>
      <label>
        Photo spacing · {value.gap}px
        <input
          type="range"
          min={4}
          max={40}
          value={value.gap}
          onChange={(event) =>
            onChange({ ...value, gap: Number(event.target.value) })
          }
        />
      </label>
      <p>
        Random emphasis stays stable while browsing. Phone layouts use smaller
        tiles. Grid thumbnails are cropped; open a photograph for the full
        composition.
      </p>
    </fieldset>
  );
}
