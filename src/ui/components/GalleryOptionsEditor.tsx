"use client";
import {
  defaultVisitorOptions,
  GalleryVisitorOptions,
  galleryLayoutLabels,
  galleryCropLabels,
} from "@/src/domain/entities/GallerySettings";
import { galleryOptionIcons } from "./GalleryVisitorControls";
export function GalleryOptionsEditor({
  value = defaultVisitorOptions,
  disabled,
  onChange,
}: {
  value?: GalleryVisitorOptions;
  disabled: boolean;
  onChange: (next: GalleryVisitorOptions) => void;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend>Visitor controls</legend>
      <p>
        Light up what visitors can choose. At least one stays on in each group.
      </p>
      {(
        [
          ["layouts", "Distributions", galleryLayoutLabels],
          ["crops", "View shapes", galleryCropLabels],
        ] as const
      ).map(([key, title, labels]) => (
        <fieldset key={key} className="gallery-option-tiles">
          <legend>{title}</legend>
          {Object.entries(labels).map(([option, label]) => (
            <label className="gallery-option-tile" key={option} title={label}>
              <input
                type="checkbox"
                aria-label={`Offer ${label}`}
                checked={value[key].includes(option)}
                disabled={
                  value[key].length === 1 && value[key].includes(option)
                }
                onChange={(event) =>
                  onChange({
                    ...value,
                    [key]: event.target.checked
                      ? [...value[key], option]
                      : value[key].filter((item) => item !== option),
                  })
                }
              />
              <svg
                viewBox="0 0 20 20"
                width="30"
                height="30"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                {galleryOptionIcons[option]}
              </svg>
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
      ))}
    </fieldset>
  );
}
