"use client";
import { useState } from "react";
import {
  GalleryAppearance,
  GalleryPalette,
} from "@/src/domain/entities/GallerySettings";
import { useEditingWorkspace } from "./EditingWorkspace";
export function GalleryPaletteLibrary({
  palettes,
  appearance,
  disabled,
  applyDisabled,
  onChange,
  onApply,
}: {
  palettes: GalleryPalette[];
  appearance: GalleryAppearance;
  disabled: boolean;
  applyDisabled: boolean;
  onChange: (palettes: GalleryPalette[]) => void;
  onApply: (
    colors: Pick<
      GalleryAppearance,
      "background" | "text" | "accent" | "surface"
    >,
  ) => void;
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
  return (
    <fieldset disabled={disabled}>
      <legend>Palette library</legend>
      <p>
        Edit the library, then apply a palette to the selected general or
        category style. Save gallery to publish all changes.
      </p>
      <label>
        Saved palette
        <select
          value={current?.id ?? ""}
          onChange={(event) => setSelected(event.target.value)}
        >
          <option value="">Choose a palette</option>
          {palettes.map((palette) => (
            <option key={palette.id} value={palette.id}>
              {palette.name}
            </option>
          ))}
        </select>
      </label>
      {current && (
        <>
          <label>
            Palette name
            <input
              maxLength={80}
              required
              value={current.name}
              onChange={(event) => edit({ name: event.target.value })}
            />
          </label>
          <div className="banner-editor__colors">
            {(["background", "text", "accent", "surface"] as const).map(
              (key) => (
                <label key={key}>
                  Palette {key}
                  <input
                    type="color"
                    value={current[key]}
                    onChange={(event) => edit({ [key]: event.target.value })}
                  />
                </label>
              ),
            )}
          </div>
          <div
            className="gallery-palette-swatch"
            style={{
              background: current.background,
              color: current.text,
              borderColor: current.accent,
            }}
          >
            Aa{" "}
            <span
              style={{ background: current.accent, color: current.background }}
            >
              Accent
            </span>
            <span style={{ background: current.surface }}>Surface</span>
          </div>
          <div className="highlight-actions">
            <button
              type="button"
              disabled={applyDisabled}
              onClick={() => {
                const { background, text, accent, surface } = current;
                onApply({ background, text, accent, surface });
              }}
            >
              Apply palette
            </button>
            <button
              type="button"
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
        </>
      )}
      <label>
        New palette name
        <input
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        disabled={palettes.length >= 30}
        onClick={() => {
          if (!name.trim()) {
            setError("Give the new palette a name.");
            return;
          }
          const { background, text, accent, surface } = appearance;
          const palette = {
            id: crypto.randomUUID(),
            name: name.trim(),
            background,
            text,
            accent,
            surface,
          };
          onChange([...palettes, palette]);
          setSelected(palette.id);
          setName("");
          setError("");
        }}
      >
        Save current colors as new palette
      </button>
    </fieldset>
  );
}
