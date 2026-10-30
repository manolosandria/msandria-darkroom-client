"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultHomeBanner,
  defaultWelcomePanel,
  HomeBanner,
} from "@/src/domain/entities/HomeBanner";
import { manageHomeBanner } from "@/src/infrastructure/homeBannerServices";
import { useSessionValue } from "./SessionProvider";
import { useEditingWorkspace, useUnsavedEditor } from "./EditingWorkspace";
import { VisualChoice } from "./VisualChoice";
import HomePage from "./HomePage";
import "./homeBannerEditor.css";
import { bannerFonts, bannerPalettes } from "../bannerPresets";
import { BannerPhotoSettings } from "./BannerPhotoSettings";
import { BannerSlideList } from "./BannerSlideList";
import { BannerLayoutPicker, WelcomePanelControls } from "./BannerLayoutPicker";
import { ArrangeTarget } from "./BannerArrange";
import { Photo } from "@/src/domain/entities/Photo";

export default function HomeBannerEditor() {
  const { user } = useSessionValue();
  return user?.isAdmin() ? (
    <Editor />
  ) : (
    <p>Sign in as the administrator to edit Home.</p>
  );
}
function Editor() {
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  useEffect(() => {
    if (editingPhoto)
      document
        .querySelector(".banner-photo-settings")
        ?.scrollIntoView?.({ block: "nearest" });
  }, [editingPhoto]);
  const [saved, setSaved] = useState<HomeBanner | null>(null);
  const [draft, setDraft] = useState<HomeBanner>(defaultHomeBanner);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [highlightDirty, setHighlightDirty] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [focusSlide, setFocusSlide] = useState<{ photoId: string }>();
  const [activePhotoId, setActivePhotoId] = useState<string>();
  const onActiveChange = useCallback((id: string) => setActivePhotoId(id), []);
  const { confirm } = useEditingWorkspace();
  const dirty =
    saved !== null && JSON.stringify(draft) !== JSON.stringify(saved);
  async function load() {
    setBusy(true);
    setError("");
    try {
      const value = await manageHomeBanner.get();
      setSaved(value);
      setDraft(value);
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
      const value = await manageHomeBanner.save(draft);
      setSaved(value);
      setDraft(value);
      setNotice("Home banner saved.");
      return true;
    } catch (failure) {
      setError((failure as Error).message);
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function change(key: keyof HomeBanner, value: string | number) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setNotice("");
  }
  // A drop over the photographs also chooses Welcome's anchor there.
  function arrange(target: ArrangeTarget) {
    setDraft((previous) => ({
      ...previous,
      layout: target.layout,
      ...(target.position
        ? {
            welcome: {
              ...defaultWelcomePanel,
              ...previous.welcome,
              position: target.position,
            },
          }
        : {}),
    }));
    setNotice("");
  }
  useUnsavedEditor(dirty, {
    label: "Home banner",
    save,
    discard: () => {
      if (saved) setDraft(saved);
    },
  });
  return (
    <div className="banner-editor">
      <header>
        <p className="banner-editor__eyebrow">CURATOR / HOME</p>
        <h1>Make an entrance.</h1>
        <p>
          Shape the welcome to your gallery. Preview your changes, then save to
          update Home for everyone.
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
                  "Reload banner?",
                  "Discard your draft and load the latest saved banner?",
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
        <p>{busy ? "Loading banner…" : "Banner settings are unavailable."}</p>
      ) : (
        <div className="banner-editor__workspace">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              await save();
            }}
          >
            <fieldset disabled={busy}>
              <legend>Words</legend>
              {(
                [
                  ["eyebrow", "Eyebrow", 120],
                  ["title", "Title", 200],
                  ["accentText", "Accent text", 200],
                  ["linkText", "Gallery link text", 80],
                ] as const
              ).map(([key, label, max]) => (
                <label key={key}>
                  {label}
                  <textarea
                    rows={key === "eyebrow" || key === "linkText" ? 1 : 2}
                    maxLength={max}
                    value={draft[key]}
                    onChange={(event) => change(key, event.target.value)}
                  />
                </label>
              ))}
            </fieldset>
            <fieldset disabled={busy}>
              <legend>Palette</legend>
              <div className="banner-editor__palettes">
                {bannerPalettes.map((palette) => (
                  <button
                    key={palette.name}
                    type="button"
                    aria-label={`Apply ${palette.name} palette`}
                    onClick={() => {
                      const [
                        backgroundColor,
                        textColor,
                        accentColor,
                        surfaceColor,
                      ] = palette.colors;
                      setDraft((previous) => ({
                        ...previous,
                        backgroundColor,
                        textColor,
                        accentColor,
                        surfaceColor,
                      }));
                      setNotice("");
                    }}
                  >
                    <span
                      className="banner-editor__swatches"
                      aria-hidden="true"
                    >
                      {palette.colors.map((color) => (
                        <i key={color} style={{ background: color }} />
                      ))}
                    </span>
                    {palette.name}
                  </button>
                ))}
              </div>
              <div className="banner-editor__colors">
                {(
                  [
                    ["backgroundColor", "Background"],
                    ["textColor", "Text"],
                    ["accentColor", "Accent"],
                    ["surfaceColor", "Photo surround"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="color"
                      aria-label={label}
                      value={draft[key]}
                      onChange={(event) => change(key, event.target.value)}
                    />
                    <span>{draft[key]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset disabled={busy}>
              <legend>Typography & composition</legend>
              <label>
                Font
                <select
                  value={draft.font}
                  onChange={(event) => change("font", event.target.value)}
                >
                  {bannerFonts.map((font) => (
                    <option key={font.id} value={font.id}>
                      {font.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Title size · {draft.fontSize}px
                <input
                  type="range"
                  min="24"
                  max="96"
                  value={draft.fontSize}
                  onChange={(event) =>
                    change("fontSize", Number(event.target.value))
                  }
                />
              </label>
              <label>
                Text alignment
                <select
                  value={draft.textAlign}
                  onChange={(event) => change("textAlign", event.target.value)}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
              <label>
                Banner shape
                <select
                  value={draft.shape}
                  onChange={(event) => change("shape", event.target.value)}
                >
                  <option value="square">Rectangle</option>
                  <option value="rounded">Rounded corners</option>
                  <option value="arch">Arch</option>
                </select>
              </label>
            </fieldset>
            <fieldset disabled={busy}>
              <legend>Photograph framing</legend>
              <div
                className="display-choice"
                role="group"
                aria-label="Image presentation"
              >
                {[
                  ["highlight", "Use highlight", "▦"],
                  ["fill", "Fill photograph", "▭"],
                  ["framed", "Complete framed photo", "□"],
                ].map(([value, label, icon]) => (
                  <VisualChoice
                    key={value}
                    label={label}
                    icon={icon}
                    active={(draft.imageMode ?? "highlight") === value}
                    onClick={() => change("imageMode", value)}
                  />
                ))}
              </div>
              <p>
                Fill may trim the selected area. Click a preview photo to choose
                or edit its highlights.
              </p>
              {(draft.imageMode ?? "highlight") === "highlight" &&
                (["desktopCrop", "mobileCrop"] as const).map((key) => (
                  <div key={key}>
                    <p>
                      {key === "desktopCrop"
                        ? "Desktop highlight"
                        : "Mobile highlight"}
                    </p>
                    <div
                      className="display-choice"
                      role="group"
                      aria-label={
                        key === "desktopCrop"
                          ? "Desktop highlight"
                          : "Mobile highlight"
                      }
                    >
                      {[
                        ["landscape", "Landscape 3:2", "▭"],
                        ["portrait", "Portrait 2:3", "▯"],
                        ["square", "Square 1:1", "□"],
                        ["full", "Full photograph", "▦"],
                      ].map(([value, label, icon]) => (
                        <VisualChoice
                          key={value}
                          label={`${key === "desktopCrop" ? "Desktop" : "Mobile"} ${label}`}
                          icon={icon}
                          active={
                            (draft[key] ??
                              (key === "desktopCrop"
                                ? "landscape"
                                : "portrait")) === value
                          }
                          onClick={() => change(key, value)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
            </fieldset>
            <fieldset disabled={busy}>
              <legend>Carousel</legend>
              <label>
                Navigation
                <select
                  value={draft.navigation ?? "dots"}
                  onChange={(event) => change("navigation", event.target.value)}
                >
                  <option value="dots">Dots</option>
                  <option value="thumbnails">Photograph thumbnails</option>
                  <option value="progress">Progress bar</option>
                </select>
              </label>
              <label>
                Controls placement
                <select
                  value={draft.controlsPosition ?? "below"}
                  onChange={(event) =>
                    change("controlsPosition", event.target.value)
                  }
                >
                  <option value="below">Below photograph</option>
                  <option value="overlay">Over photograph</option>
                </select>
              </label>
              <label>
                Banner height · {draft.bannerHeight ?? 620}px
                <input
                  type="range"
                  min={240}
                  max={1000}
                  step={10}
                  value={draft.bannerHeight ?? 620}
                  onChange={(event) =>
                    change("bannerHeight", Number(event.target.value))
                  }
                />
              </label>
            </fieldset>
            <div className="banner-editor__actions">
              <button type="submit" disabled={busy || !dirty}>
                {busy ? "Saving…" : "Save banner"}
              </button>
              <button
                type="button"
                disabled={busy || !dirty}
                onClick={async () => {
                  if (
                    await confirm(
                      "Discard changes?",
                      "Return to the last saved banner?",
                    )
                  )
                    setDraft(saved);
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
                      "Load the original design into your preview. Save to apply it.",
                    )
                  )
                    setDraft({ ...defaultHomeBanner, version: saved.version });
                }}
              >
                Restore original
              </button>
            </div>
          </form>
          <section
            className="banner-editor__preview"
            aria-label="Banner preview"
          >
            <div className="banner-editor__preview-bar">
              <h2>Live preview</h2>
              <div
                className="display-choice"
                role="group"
                aria-label="Preview display"
              >
                <VisualChoice
                  label="Desktop preview"
                  icon="▰"
                  active={!mobile}
                  onClick={() => setMobile(false)}
                />
                <VisualChoice
                  label="Mobile preview"
                  icon="▯"
                  active={mobile}
                  onClick={() => setMobile(true)}
                />
              </div>
              <span>Unsaved preview</span>
            </div>
            <div
              className={`banner-editor__viewport ${mobile ? "banner-editor__viewport--mobile" : ""}`}
            >
              <HomePage
                banner={draft}
                onEditPhoto={async (photo) => {
                  if (editingPhoto?.getId() === photo.getId()) return;
                  if (
                    !highlightDirty ||
                    (await confirm(
                      "Discard highlight changes?",
                      "Switching photos will discard your unsaved photo highlight edits.",
                    ))
                  )
                    setEditingPhoto(photo);
                }}
                editedPhoto={editingPhoto}
                onArrange={busy ? undefined : arrange}
                focusSlide={focusSlide}
                onActiveChange={onActiveChange}
              />
            </div>
            <BannerSlideList
              slides={draft.slides ?? []}
              disabled={busy}
              activePhotoId={activePhotoId}
              onFocusSlide={(photoId) => setFocusSlide({ photoId })}
              onChange={(slides) => {
                setDraft((previous) => ({ ...previous, slides }));
                setNotice("");
              }}
            />
          </section>
          <aside
            className="banner-editor__inspector"
            aria-label="Composition and photo"
          >
            <section className="banner-arrange" aria-label="Arrange the banner">
              <header>
                <h2>Composition</h2>
                <p>
                  Choose a layout, or drag the ⠿ grips of Welcome and Photographs
                  in the preview: drop on an edge to sit beside the photographs, or
                  inside to float over them.
                </p>
              </header>
              <BannerLayoutPicker
                value={draft.layout}
                disabled={busy}
                onChange={(value) => change("layout", value)}
              />
              {draft.layout === "text-overlay" && (
                <WelcomePanelControls
                  welcome={{ ...defaultWelcomePanel, ...draft.welcome }}
                  opacity={draft.overlayOpacity ?? 45}
                  disabled={busy}
                  onChange={(welcome) => {
                    setDraft((previous) => ({ ...previous, welcome }));
                    setNotice("");
                  }}
                  onOpacityChange={(value) => change("overlayOpacity", value)}
                />
              )}
            </section>
            {editingPhoto && (
              <BannerPhotoSettings
                key={editingPhoto.getId()}
                photo={editingPhoto}
                onUpdated={setEditingPhoto}
                onDirty={setHighlightDirty}
                onSlideChange={(slides) => {
                  setDraft((previous) => ({ ...previous, slides }));
                  setNotice("");
                }}
                display={mobile ? "mobile" : "desktop"}
                onDisplayChange={(value) => setMobile(value === "mobile")}
                banner={draft}
                onClose={() => setEditingPhoto(null)}
                onChange={(photoCrops) => {
                  setDraft((previous) => ({
                    ...previous,
                    imageMode: "highlight",
                    photoCrops,
                  }));
                  setNotice("");
                }}
              />
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
