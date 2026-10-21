"use client";

import { PhotoFrame } from "@/src/domain/entities/PhotoFrame";
import { framedLayout } from "@/src/ui/framedLayout";
import "./frameFields.css";

// The API's ceiling for each side, as a percentage of the photo's short side.
export const FRAME_MAX_PERCENT = 25;

const DEFAULT_FRAME: PhotoFrame = {
  color: "#ffffff",
  leftRight: 4,
  topBottom: 4,
};

const SWATCHES = [
  { color: "#ffffff", label: "White" },
  { color: "#f2efe6", label: "Paper" },
  { color: "#1b1b1b", label: "Black" },
  { color: "#6b6b6b", label: "Grey" },
];

// The mat around a photo: one colour, and separate thicknesses for the sides and for
// top and bottom. `null` means no frame at all. The preview uses the same layout as
// the viewer, so what is shown here is what visitors see.
export function FrameFields({
  value,
  onChange,
  src,
  width,
  height,
  disabled = false,
}: {
  value: PhotoFrame | null;
  onChange: (frame: PhotoFrame | null) => void;
  src: string;
  width: number;
  height: number;
  disabled?: boolean;
}) {
  const frame = value ?? DEFAULT_FRAME;
  const update = (fields: Partial<PhotoFrame>) => onChange({ ...frame, ...fields });
  const layout = framedLayout(width / height, value);
  return (
    <fieldset className="frame-fields" disabled={disabled}>
      <legend>Frame</legend>
      <label className="frame-fields__toggle">
        <input
          type="checkbox"
          checked={value !== null}
          onChange={(event) => onChange(event.target.checked ? frame : null)}
        />
        Show a frame around this photo
      </label>
      {value && (
        <div className="frame-fields__controls">
          <div className="frame-fields__colors" role="group" aria-label="Frame colour">
            {SWATCHES.map((swatch) => (
              <button
                key={swatch.color}
                type="button"
                className="frame-fields__swatch"
                style={{ background: swatch.color }}
                aria-label={swatch.label}
                aria-pressed={value.color.toLowerCase() === swatch.color}
                onClick={() => update({ color: swatch.color })}
              />
            ))}
            <label className="frame-fields__custom">
              <input
                type="color"
                value={value.color}
                aria-label="Custom frame colour"
                onChange={(event) => update({ color: event.target.value })}
              />
              <span>{value.color.toUpperCase()}</span>
            </label>
          </div>
          <ThicknessField
            label="Sides"
            value={value.leftRight}
            onChange={(leftRight) => update({ leftRight })}
          />
          <ThicknessField
            label="Top and bottom"
            value={value.topBottom}
            onChange={(topBottom) => update({ topBottom })}
          />
        </div>
      )}
      <div className="frame-fields__preview" aria-hidden="true">
        <div
          data-testid="frame-preview"
          style={{
            background: value?.color,
            padding: `${layout.paddingY}% ${layout.paddingX}%`,
            width: `min(100%, ${(180 / layout.heightPerWidth).toFixed(1)}px)`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- A local preview or an API rendition, used verbatim. */}
          <img src={src} alt="" width={width} height={height} />
        </div>
      </div>
    </fieldset>
  );
}

function ThicknessField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="frame-fields__thickness">
      <span>
        {label} <output>{value}%</output>
      </span>
      <input
        type="range"
        min={0}
        max={FRAME_MAX_PERCENT}
        step={0.5}
        value={value}
        aria-label={`${label} thickness`}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
