"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { editCatalog } from "@/src/infrastructure/catalogServices";
import { getPhotoById } from "@/src/infrastructure/photoServices";
import { Photo } from "@/src/domain/entities/Photo";
import { PhotoImage } from "./PhotoImage";
import "./catalogStudio.css";
export function ViewerVariants({
  photoId,
  photos,
}: {
  photoId: string;
  photos: Photo[];
}) {
  const [variants, setVariants] = useState<Photo[]>([]);
  useEffect(() => {
    let active = true;
    void editCatalog
      .load()
      .then(async (catalog) => {
        const ids =
          catalog.works
            .find((work) => work.variants.some((v) => v.photoId === photoId))
            ?.variants.map((v) => v.photoId) ?? [];
        const resolved = await Promise.all(
          ids.map(
            async (id) =>
              photos.find((photo) => photo.getId() === id) ??
              (await getPhotoById.execute(id).catch(() => null)),
          ),
        );
        if (active)
          setVariants(resolved.filter((photo): photo is Photo => !!photo));
      })
      .catch(() => {
        if (active) setVariants([]);
      });
    return () => {
      active = false;
    };
  }, [photoId, photos]);
  if (variants.length < 2) return null;
  return (
    <nav className="viewer-variants" aria-label="Photograph variants">
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
            fallbackSizes="54px"
            className="object-cover"
          />
        </Link>
      ))}
    </nav>
  );
}
