"use client";
import {
  defaultVisitorOptions,
  GalleryVisitorOptions,
  galleryLayoutLabels,
  galleryCropLabels,
} from "@/src/domain/entities/GallerySettings";
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
        Choose which controls visitors can use. Keep at least one option in each
        group.
      </p>
      {(
        [
          ["layouts", "Distributions", galleryLayoutLabels],
          ["crops", "View shapes", galleryCropLabels],
        ] as const
      ).map(([key, title, labels]) => (
        <fieldset key={key}>
          <legend>{title}</legend>
          {Object.entries(labels).map(([option, label]) => (
            <label className="gallery-editor-check" key={option}>
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
              {label}
            </label>
          ))}
        </fieldset>
      ))}
    </fieldset>
  );
}
