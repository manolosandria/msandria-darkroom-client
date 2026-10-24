"use client";
import {
  GalleryVisitorOptions,
  galleryLayoutLabels,
  galleryCropLabels,
} from "@/src/domain/entities/GallerySettings";
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
        <label key={key}>
          {label}
          <select
            value={value}
            onChange={(event) => onChange(key, event.target.value)}
          >
            {values.map((option) => (
              <option key={option} value={option}>
                {labels[option]}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
