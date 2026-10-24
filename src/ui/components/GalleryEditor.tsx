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
import Gallery from "./Gallery";
import { GalleryOptionsEditor } from "./GalleryOptionsEditor";
import { GalleryPaletteLibrary } from "./GalleryPaletteLibrary";
import "./homeBannerEditor.css";
import "./galleryStudio.css";

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
        <div className="banner-editor__workspace">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              await save();
            }}
          >
            <fieldset disabled={busy}>
              <legend>Introduction</legend>
              <p>
                Empty text is hidden. Remove every block to show only the
                filters and photographs.
              </p>
              {draft.blocks.map((block, index) => (
                <div className="gallery-editor-block" key={index}>
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
                      <option value="eyebrow">Eyebrow</option>
                      <option value="title">Title</option>
                      <option value="body">Description</option>
                    </select>
                  </label>
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
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        blocks: draft.blocks.filter((_, i) => i !== index),
                      })
                    }
                  >
                    Remove text {index + 1}
                  </button>
                </div>
              ))}
              <button
                type="button"
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
                Add text
              </button>
            </fieldset>
            <fieldset disabled={busy}>
              <legend>Category & appearance</legend>
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
                  <label>
                    Category group
                    <select
                      value={
                        category?.group ??
                        groupGalleryCategories(categories).find((group) =>
                          group.categories.some((item) => item.id === target),
                        )?.label ??
                        "Other"
                      }
                      onChange={(event) =>
                        updateCategory({ group: event.target.value })
                      }
                    >
                      {["Subjects", "Color & treatment", "Themes", "Other"].map(
                        (group) => (
                          <option key={group}>{group}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
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
              <AppearanceFields
                value={appearance}
                disabled={!!target && !category?.customize}
                onChange={changeAppearance}
              />
            </fieldset>
            <GalleryOptionsEditor
              value={draft.visitorOptions}
              disabled={busy}
              onChange={(visitorOptions) => {
                setDraft((previous) => ({ ...previous, visitorOptions }));
                setNotice("");
              }}
            />
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
            <div className="banner-editor__actions">
              <button disabled={busy || !dirty} type="submit">
                {busy ? "Saving…" : "Save gallery"}
              </button>
              <button
                type="button"
                disabled={busy || !dirty}
                onClick={async () => {
                  if (
                    await confirm(
                      "Cancel changes?",
                      "Return to the saved design?",
                    )
                  ) {
                    setDraft(saved);
                    setNotice("");
                  }
                }}
              >
                Cancel changes
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
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
              >
                Restore original
              </button>
            </div>
          </form>
          <section
            className="banner-editor__preview"
            aria-label="Gallery preview"
          >
            <div className="banner-editor__preview-bar">
              <h2>Live preview</h2>
              <button
                type="button"
                aria-pressed={mobile}
                onClick={() => setMobile(!mobile)}
              >
                {mobile ? "Show desktop" : "Show mobile"}
              </button>
              <span>Unsaved preview</span>
            </div>
            <div
              className={`banner-editor__viewport ${mobile ? "banner-editor__viewport--mobile" : ""}`}
            >
              <Gallery settings={draft} />
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
function AppearanceFields({
  value,
  disabled,
  onChange,
}: {
  value: GalleryAppearance;
  disabled: boolean;
  onChange: (value: GalleryAppearance) => void;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend>Palette, type & photographs</legend>
      <label>
        Gallery font
        <select
          value={value.font}
          onChange={(event) => onChange({ ...value, font: event.target.value })}
        >
          <FontOptions />
        </select>
      </label>
      <div className="banner-editor__colors">
        {(["background", "text", "accent", "surface"] as const).map((key) => (
          <label key={key}>
            {key}
            <input
              type="color"
              value={value[key]}
              onChange={(event) =>
                onChange({ ...value, [key]: event.target.value })
              }
            />
            <span>{value[key]}</span>
          </label>
        ))}
      </div>
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
