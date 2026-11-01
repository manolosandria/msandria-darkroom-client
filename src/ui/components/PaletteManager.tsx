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
import { EditorActions } from "./EditorActions";
import { ChoiceMenu } from "./ChoiceMenu";
import {
  GalleryPaletteLibrary,
  PALETTE_KEYS,
  PALETTE_ROLES,
  PaletteKey,
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
  const [preview, setPreview] = useState("");
  // The color pointed at, by its row in the editor or its zone in the drawing.
  const [highlighted, setHighlighted] = useState<PaletteKey | null>(null);
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
  const shown =
    palettes.find((palette) => palette.id === preview) ?? palettes[0];
  // A click on the drawing opens that color's picker in the editor, which always
  // shows the palette drawn.
  const form = useRef<HTMLFormElement>(null);
  function pick(key: PaletteKey) {
    const input = form.current?.querySelector<HTMLInputElement>(
      `input[aria-label="Palette ${key}"]`,
    );
    input?.focus();
    input?.click();
  }
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
        {saved && (
          <EditorActions
            form="palette-manager-form"
            busy={busy}
            dirty={dirty}
            saveLabel="Save palettes"
            onCancel={async () => {
              if (
                await confirm(
                  "Cancel changes?",
                  "Return to the saved palettes?",
                )
              )
                setPalettes(savedPalettes);
            }}
          />
        )}
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
            id="palette-manager-form"
            ref={form}
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
              selectedId={shown?.id ?? ""}
              onSelect={setPreview}
              highlighted={highlighted}
              onHighlight={setHighlighted}
            />
          </form>
          <aside className="palette-guide" aria-label="Where each color goes">
            <h2>Where each color goes</h2>
            <label className="palette-guide__pick">
              Preview
              <ChoiceMenu
                value={shown?.id ?? ""}
                onChange={setPreview}
                options={palettes.map((palette) => ({
                  value: palette.id,
                  label: palette.name,
                  swatch: [
                    palette.background,
                    palette.text,
                    palette.accent,
                    palette.surface,
                  ],
                }))}
              />
            </label>
            {shown && (
              <PaletteDiagram
                palette={shown}
                highlighted={highlighted}
                onHighlight={setHighlighted}
                onPick={pick}
              />
            )}
            <ol className="palette-guide__legend">
              {PALETTE_KEYS.map((key, index) => (
                <li
                  key={key}
                  data-linked={highlighted === key || undefined}
                  onPointerEnter={() => setHighlighted(key)}
                  onPointerLeave={() => setHighlighted(null)}
                >
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
// Every zone carries the color it shows: pointing at one lights it up and names it
// in the editor, and a color pointed at in the editor lights up its zones here.
function PaletteDiagram({
  palette,
  highlighted,
  onHighlight,
  onPick,
}: {
  palette: GalleryPalette;
  highlighted: PaletteKey | null;
  onHighlight: (key: PaletteKey | null) => void;
  onPick: (key: PaletteKey) => void;
}) {
  const mark = (index: number) => (
    <span className="palette-diagram__mark" aria-hidden="true">
      {index}
    </span>
  );
  return (
    <div
      className="palette-diagram"
      data-zone="background"
      data-highlight={highlighted ?? undefined}
      style={{ background: palette.background, color: palette.text }}
      aria-hidden="true"
      onPointerOver={(event) => {
        const zone = (event.target as Element).closest<HTMLElement>(
          "[data-zone]",
        )?.dataset.zone;
        if (zone) onHighlight(zone as PaletteKey);
      }}
      onPointerLeave={() => onHighlight(null)}
      onClick={(event) => {
        const zone = (event.target as Element).closest<HTMLElement>(
          "[data-zone]",
        )?.dataset.zone;
        if (zone) onPick(zone as PaletteKey);
      }}
    >
      {mark(1)}
      <div className="palette-diagram__heading" data-zone="text">
        <span
          className="palette-diagram__rule"
          data-zone="accent"
          style={{ background: palette.accent }}
        />
        <strong>
          Gallery
          <i data-zone="accent" style={{ background: palette.accent }} />
          {mark(2)}
        </strong>
        <small>Twelve photographs at a time.</small>
      </div>
      <div
        className="palette-diagram__tools"
        data-zone="surface"
        style={{ background: palette.surface }}
      >
        {mark(4)}
        <span
          className="palette-diagram__field"
          data-zone="background"
          style={{ background: palette.background }}
        />
        <span
          className="palette-diagram__chip"
          data-zone="accent"
          style={{ background: palette.accent, color: palette.background }}
        >
          Street {mark(3)}
        </span>
        <span className="palette-diagram__chip" data-zone="text">
          Color
        </span>
      </div>
      <div className="palette-diagram__tiles">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            data-zone="surface"
            style={{ background: palette.surface }}
          />
        ))}
      </div>
    </div>
  );
}
