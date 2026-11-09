"use client";
import Link from "next/link";
import { Photo } from "@/src/domain/entities/Photo";
import { PhotoVariantPosition } from "@/src/domain/entities/PhotoTitlePosition";
import { PhotoImage } from "./PhotoImage";
import "./catalogStudio.css";

// Over the photo, in the corner the photo chose (never the title's), or centred at the
// bottom when it chose none. The variants come with the photo's detail
// (`getWorkVariants`), so opening a photo never downloads the whole catalog for them.
export function ViewerVariants({
  photoId,
  variants,
  position = null,
}: {
  photoId: string;
  variants: Photo[];
  position?: PhotoVariantPosition;
}) {
  if (variants.length < 2) return null;
  return (
    <nav
      className="viewer-variants"
      data-corner={position?.toLowerCase().replace("_", "-") ?? "bottom-center"}
      aria-label="Photograph variants"
    >
      <span className="viewer-variants__label" aria-hidden="true">
        {variants.length} variants
      </span>
      <div className="viewer-variants__strip">
        {variants.map((photo) => (
          <Link
            key={photo.getId()}
            href={`/photo/${encodeURIComponent(photo.getId())}`}
            aria-label={`View variant: ${photo.getTitle()}`}
            aria-current={photo.getId() === photoId ? "page" : undefined}
          >
            <PhotoImage
              photo={photo}
              maxWidth={160}
              fallbackSizes="58px"
              className="object-cover"
            />
          </Link>
        ))}
      </div>
    </nav>
  );
}
