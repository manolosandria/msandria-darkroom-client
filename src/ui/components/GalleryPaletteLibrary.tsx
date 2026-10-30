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
export type PaletteKey = (typeof PALETTE_KEYS)[number];

// Where each colour of a palette ends up on the public Gallery.
export const PALETTE_ROLES: Record<PaletteKey, string> = {
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
  selectedId,
  onSelect,
  highlighted = null,
  onHighlight,
}: {
  palettes: GalleryPalette[];
  appearance: GalleryAppearance;
  disabled: boolean;
  applyDisabled?: boolean;
  onChange: (palettes: GalleryPalette[]) => void;
  /** Without it the library only manages palettes, as Curator → Palettes does. */
  onApply?: (colors: PaletteColors) => void;
  /** With it, the palette open in the editor is chosen by whoever passes it. */
  selectedId?: string;
  onSelect?: (id: string) => void;
  /** The color pointed at elsewhere (the guide's drawing), marked on its row. */
  highlighted?: PaletteKey | null;
  /** Called while the pointer or keyboard focus rests on a color row. */
  onHighlight?: (key: PaletteKey | null) => void;
}) {
  const [ownSelected, setOwnSelected] = useState(palettes[0]?.id ?? "");
  const selected = selectedId ?? ownSelected;
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const { confirm } = useEditingWorkspace();
  const current = palettes.find((palette) => palette.id === selected);
  function setSelected(id: string) {
    setOwnSelected(id);
    onSelect?.(id);
  }
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
          <p className="palette-library__hint">
            Click any color to change it.
          </p>
          <div className="palette-library__colors">
            {PALETTE_KEYS.map((key, index) => (
              <label
                key={key}
                className="palette-color"
                data-linked={highlighted === key || undefined}
                onPointerEnter={() => onHighlight?.(key)}
                onPointerLeave={() => onHighlight?.(null)}
                onFocus={() => onHighlight?.(key)}
                onBlur={() => onHighlight?.(null)}
              >
                <span className="palette-color__chip">
                  <input
                    type="color"
                    aria-label={`Palette ${key}`}
                    value={current[key]}
                    onChange={(event) => edit({ [key]: event.target.value })}
                  />
                  <span className="palette-color__number" aria-hidden="true">
                    {index + 1}
                  </span>
                </span>
                <span className="palette-color__text">
                  <strong>{key[0].toUpperCase() + key.slice(1)}</strong>
                  <small>{PALETTE_ROLES[key]}</small>
                </span>
                <span className="palette-color__edit" aria-hidden="true">
                  <code>{current[key].toUpperCase()}</code>
                  <svg viewBox="0 0 16 16" width="14" height="14">
                    <path
                      d="M11.3 2.3a1.5 1.5 0 0 1 2.1 2.1L5.7 12.1 2.5 13l.9-3.2z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinejoin="round"
                    />
                  </svg>
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
