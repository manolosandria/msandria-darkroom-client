"use client";
import { useId } from "react";
import {
  GalleryVisitorOptions,
  galleryLayoutLabels,
  galleryCropLabels,
} from "@/src/domain/entities/GallerySettings";

// Small pictures of each choice, drawn in the gallery's own text colour.
export const galleryOptionIcons: Record<string, React.ReactNode> = {
  uniform: (
    <>
      <rect x="2" y="2" width="7" height="7" />
      <rect x="11" y="2" width="7" height="7" />
      <rect x="2" y="11" width="7" height="7" />
      <rect x="11" y="11" width="7" height="7" />
    </>
  ),
  random: (
    <>
      <rect x="2" y="2" width="10" height="10" />
      <rect x="14" y="2" width="4" height="4" />
      <rect x="14" y="8" width="4" height="4" />
      <rect x="2" y="14" width="4" height="4" />
      <rect x="8" y="14" width="10" height="4" />
    </>
  ),
  justified: (
    <>
      <rect x="2" y="3" width="9" height="6" />
      <rect x="13" y="3" width="5" height="6" />
      <rect x="2" y="11" width="5" height="6" />
      <rect x="9" y="11" width="9" height="6" />
    </>
  ),
  mixed: (
    <>
      <rect x="2" y="4" width="6" height="12" />
      <rect x="10" y="4" width="8" height="5" />
      <rect x="10" y="11" width="5" height="5" />
    </>
  ),
  square: <rect x="4" y="4" width="12" height="12" />,
  rectangular: (
    <>
      <rect x="2" y="6" width="9" height="8" />
      <rect x="13" y="3" width="5" height="14" />
    </>
  ),
  portrait: <rect x="6" y="2" width="8" height="16" />,
  landscape: <rect x="2" y="5" width="16" height="10" />,
};

export function GalleryVisitorControls({
  options,
  layout,
  crops,
  onChange,
}: {
  options: GalleryVisitorOptions;
  layout: string;
  crops: string;
  onChange: (key: "layout" | "crops", value: string) => void;
}) {
  const id = useId();
  return (
    <div
      className="gallery-visitor-controls"
      aria-label="Gallery display options"
    >
      {(
        [
          [
            "layout",
            "Distribution",
            options.layouts,
            galleryLayoutLabels,
            layout,
          ],
          ["crops", "View shapes", options.crops, galleryCropLabels, crops],
        ] as const
      ).map(([key, label, values, labels, value]) => (
        <fieldset
          key={key}
          className="gallery-segmented"
          role="radiogroup"
          aria-label={label}
        >
          <legend className="gallery-sr-only">{label}</legend>
          <div className="gallery-segmented__options">
            {values.map((option) => (
              <label key={option} title={labels[option]}>
                <input
                  type="radio"
                  name={`${id}-${key}`}
                  value={option}
                  checked={value === option}
                  onChange={() => onChange(key, option)}
                />
                <svg
                  viewBox="0 0 20 20"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  {galleryOptionIcons[option]}
                </svg>
                <span className="gallery-sr-only">{labels[option]}</span>
              </label>
            ))}
          </div>
          <span className="gallery-segmented__caption" aria-hidden="true">
            {labels[value]}
          </span>
        </fieldset>
      ))}
    </div>
  );
}
