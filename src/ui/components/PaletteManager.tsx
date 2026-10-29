"use client";
import "./paletteStudio.css";
import { useEffect, useRef, useState } from "react";
import {
  defaultGallerySettings,
  defaultGalleryPalettes,
  GalleryPalette,
  GallerySettings,
} from "@/src/domain/entities/GallerySettings";
import { manageGallerySettings } from "@/src/infrastructure/gallerySettingsServices";
import { useSessionValue } from "./SessionProvider";
import { useEditingWorkspace, useUnsavedEditor } from "./EditingWorkspace";
import {
  GalleryPaletteLibrary,
  PALETTE_KEYS,
  PALETTE_ROLES,
} from "./GalleryPaletteLibrary";

// Both editors keep the same settings document: each tells the other what it saved.
export const GALLERY_SETTINGS_SAVED = "curator:gallery-settings-saved";

export default function PaletteManager() {
  const { user } = useSessionValue();
  return user?.isAdmin() ? (
    <Manager />
  ) : (
    <p>Sign in as the administrator to manage palettes.</p>
  );
}

function Manager() {
  const [saved, setSaved] = useState<GallerySettings | null>(null);
  const [palettes, setPalettes] = useState<GalleryPalette[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState(0);
  const lock = useRef(false);
  const { confirm } = useEditingWorkspace();
  const savedPalettes = saved?.palettes ?? defaultGalleryPalettes;
  const dirty =
    saved !== null &&
    JSON.stringify(savedPalettes) !== JSON.stringify(palettes);
  async function load() {
    setBusy(true);
    setError("");
    try {
      const settings = await manageGallerySettings.get();
      setSaved(settings);
      setPalettes(settings.palettes ?? defaultGalleryPalettes);
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
  // A Gallery save carries its own palettes and a new version; keep a draft in progress.
  useEffect(() => {
    const adopt = (event: Event) => {
      const settings = (event as CustomEvent<GallerySettings>).detail;
      if (!settings) return;
      if (!dirty) setPalettes(settings.palettes ?? defaultGalleryPalettes);
      setSaved(settings);
    };
    window.addEventListener(GALLERY_SETTINGS_SAVED, adopt);
    return () => window.removeEventListener(GALLERY_SETTINGS_SAVED, adopt);
  }, [dirty]);
  async function save() {
    if (lock.current || !saved) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await manageGallerySettings.save({ ...saved, palettes });
      setSaved(result);
      setPalettes(result.palettes ?? defaultGalleryPalettes);
      setNotice("Palettes saved.");
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
    label: "Palettes",
    save,
    discard: () => setPalettes(savedPalettes),
  });
  const shown = palettes[preview] ?? palettes[0];
  return (
    <div className="palette-manager">
      <header>
        <p className="banner-editor__eyebrow">CURATOR / PALETTES</p>
        <h1>Colors for the archive.</h1>
        <p>
          Keep the palettes that Gallery and its categories can apply. A palette
          is copied when applied, so changing or deleting it here never alters a
          design already saved.
        </p>
      </header>
      {error && (
        <p role="alert">
          {error}{" "}
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (
                !dirty ||
                (await confirm(
                  "Reload palettes?",
                  "Discard your palette changes and load the saved ones?",
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
        <p>{busy ? "Loading palettes…" : "Palettes are unavailable."}</p>
      ) : (
        <div className="palette-manager__layout">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              await save();
            }}
          >
            <GalleryPaletteLibrary
              palettes={palettes}
              appearance={saved.appearance ?? defaultGallerySettings.appearance}
              disabled={busy}
              onChange={(next) => {
                setPalettes(next);
                setNotice("");
              }}
            />
            <div className="palette-manager__actions">
              <button type="submit" disabled={busy || !dirty}>
                {busy ? "Saving…" : "Save palettes"}
              </button>
              <button
                type="button"
                disabled={busy || !dirty}
                onClick={async () => {
                  if (
                    await confirm(
                      "Cancel changes?",
                      "Return to the saved palettes?",
                    )
                  )
                    setPalettes(savedPalettes);
                }}
              >
                Cancel changes
              </button>
            </div>
          </form>
          <aside className="palette-guide" aria-label="Where each color goes">
            <h2>Where each color goes</h2>
            <label className="palette-guide__pick">
              Preview
              <select
                value={palettes.indexOf(shown)}
                onChange={(event) => setPreview(Number(event.target.value))}
              >
                {palettes.map((palette, index) => (
                  <option key={palette.id} value={index}>
                    {palette.name}
                  </option>
                ))}
              </select>
            </label>
            {shown && <PaletteDiagram palette={shown} />}
            <ol className="palette-guide__legend">
              {PALETTE_KEYS.map((key, index) => (
                <li key={key}>
                  <span
                    className="palette-guide__dot"
                    style={{ background: shown?.[key] }}
                  >
                    {index + 1}
                  </span>
                  <span>
                    <strong>{key[0].toUpperCase() + key.slice(1)}</strong>
                    <small>{PALETTE_ROLES[key]}</small>
                  </span>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      )}
    </div>
  );
}

// A small drawing of the Gallery page in the palette's colors, with numbered marks.
function PaletteDiagram({ palette }: { palette: GalleryPalette }) {
  const mark = (index: number) => (
    <span className="palette-diagram__mark" aria-hidden="true">
      {index}
    </span>
  );
  return (
    <div
      className="palette-diagram"
      style={{ background: palette.background, color: palette.text }}
      aria-hidden="true"
    >
      {mark(1)}
      <div className="palette-diagram__heading">
        <span style={{ background: palette.text }} />
        <strong>
          Gallery
          <i style={{ background: palette.accent }} />
        </strong>
        {mark(2)}
      </div>
      <div
        className="palette-diagram__tools"
        style={{ background: palette.surface }}
      >
        {mark(4)}
        <span className="palette-diagram__field" />
        <span
          className="palette-diagram__chip"
          style={{ background: palette.accent, color: palette.background }}
        >
          Street {mark(3)}
        </span>
        <span className="palette-diagram__chip">Color</span>
      </div>
      <div className="palette-diagram__tiles">
        {[0, 1, 2].map((index) => (
          <span key={index} style={{ background: palette.surface }} />
        ))}
      </div>
    </div>
  );
}
