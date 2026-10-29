"use client";
import "./variantThumbs.css";
import { Photo } from "@/src/domain/entities/Photo";
import { PhotoImage } from "./PhotoImage";

/**
 * A row of small round thumbnails, one per variant of a work, to choose which one a
 * tile shows. Each is a radio button, checked while its variant is the one shown.
 */
export function VariantThumbs({
  variants,
  selectedId,
  onSelect,
  label,
  className = "",
}: {
  variants: Photo[];
  selectedId: string;
  onSelect: (id: string) => void;
  label: string;
  className?: string;
}) {
  if (variants.length < 2) return null;
  return (
    <div
      className={`variant-thumbs ${className}`}
      role="radiogroup"
      aria-label={label}
    >
      {variants.map((variant) => (
        <button
          type="button"
          key={variant.getId()}
          role="radio"
          aria-checked={variant.getId() === selectedId}
          aria-label={variant.getTitle()}
          title={variant.getTitle()}
          onClick={() => onSelect(variant.getId())}
        >
          <PhotoImage
            photo={variant}
            maxWidth={160}
            fallbackSizes="32px"
            className="object-cover"
            crop={variant.getHighlights().square}
          />
        </button>
      ))}
    </div>
  );
}
