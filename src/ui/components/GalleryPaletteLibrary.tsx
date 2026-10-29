"use client";
import "./paletteStudio.css";
import { useState } from "react";
import {
  GalleryAppearance,
  GalleryPalette,
} from "@/src/domain/entities/GallerySettings";
import { useEditingWorkspace } from "./EditingWorkspace";

type PaletteColors = Pick<
  GalleryAppearance,
  "background" | "text" | "accent" | "surface"
>;
export const PALETTE_KEYS = [
  "background",
  "text",
  "accent",
  "surface",
] as const;

// Where each colour of a palette ends up on the public Gallery.
export const PALETTE_ROLES: Record<(typeof PALETTE_KEYS)[number], string> = {
  background: "Page behind the photographs and the filter fields",
  text: "Headings, descriptions, labels and icons",
  accent:
    "Chosen filters and their badges, active buttons, the title's dot and rules",
  surface: "Filter panel, open menus and empty photo frames",
};

const pick = ({ background, text, accent, surface }: PaletteColors) => ({
  background,
  text,
  accent,
  surface,
});

export function GalleryPaletteLibrary({
  palettes,
  appearance,
  disabled,
  applyDisabled = false,
  onChange,
  onApply,
}: {
  palettes: GalleryPalette[];
  appearance: GalleryAppearance;
  disabled: boolean;
  applyDisabled?: boolean;
  onChange: (palettes: GalleryPalette[]) => void;
  /** Without it the library only manages palettes, as Curator → Palettes does. */
  onApply?: (colors: PaletteColors) => void;
}) {
  const [selected, setSelected] = useState(palettes[0]?.id ?? "");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const { confirm } = useEditingWorkspace();
  const current = palettes.find((palette) => palette.id === selected);
  function edit(patch: Partial<GalleryPalette>) {
    onChange(
      palettes.map((palette) =>
        palette.id === selected ? { ...palette, ...patch } : palette,
      ),
    );
  }
  function create(colors: PaletteColors, paletteName: string) {
    const palette = {
      id: crypto.randomUUID(),
      name: paletteName,
      ...pick(colors),
    };
    onChange([...palettes, palette]);
    setSelected(palette.id);
  }
  return (
    <fieldset className="palette-library" disabled={disabled}>
      <legend>Palette library</legend>
      <ul className="palette-library__grid" aria-label="Saved palettes">
        {palettes.map((palette) => (
          <li key={palette.id}>
            <button
              type="button"
              className="palette-card"
              aria-pressed={palette.id === selected}
              aria-label={palette.name}
              onClick={() => setSelected(palette.id)}
            >
              <PaletteSwatch colors={palette} />
              <span className="palette-card__name">{palette.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {current && (
        <div className="palette-library__editor">
          <label>
            Palette name
            <input
              maxLength={80}
              required
              value={current.name}
              onChange={(event) => edit({ name: event.target.value })}
            />
          </label>
          <div className="palette-library__colors">
            {PALETTE_KEYS.map((key) => (
              <label key={key} className="palette-color">
                <input
                  type="color"
                  aria-label={`Palette ${key}`}
                  value={current[key]}
                  onChange={(event) => edit({ [key]: event.target.value })}
                />
                <span>
                  <strong>{key[0].toUpperCase() + key.slice(1)}</strong>
                  <small>{PALETTE_ROLES[key]}</small>
                </span>
              </label>
            ))}
          </div>
          <div className="palette-library__actions">
            {onApply && (
              <button
                type="button"
                className="palette-library__apply"
                disabled={applyDisabled}
                onClick={() => onApply(pick(current))}
              >
                Apply palette
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                create(current, `${current.name} copy`.slice(0, 80))
              }
              disabled={palettes.length >= 30}
            >
              Duplicate
            </button>
            <button
              type="button"
              className="palette-library__delete"
              onClick={async () => {
                if (
                  await confirm(
                    "Delete palette?",
                    "Remove this palette from the library? Applied colors stay in the designs.",
                  )
                ) {
                  onChange(
                    palettes.filter((palette) => palette.id !== current.id),
                  );
                  setSelected("");
                }
              }}
            >
              Delete palette
            </button>
          </div>
        </div>
      )}
      <div className="palette-library__new">
        <label>
          New palette name
          <input
            maxLength={80}
            value={name}
            placeholder="From the current colors"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={palettes.length >= 30}
          onClick={() => {
            if (!name.trim()) {
              setError("Give the new palette a name.");
              return;
            }
            create(appearance, name.trim());
            setName("");
            setError("");
          }}
        >
          Save current colors as new palette
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}

export function PaletteSwatch({ colors }: { colors: PaletteColors }) {
  return (
    <span className="palette-swatch" aria-hidden="true">
      {PALETTE_KEYS.map((key) => (
        <span key={key} style={{ background: colors[key] }} />
      ))}
    </span>
  );
}
