"use client";
import "./catalogStudio.css";
import Link from "next/link";
import { useState } from "react";
import { CatalogTile } from "@/src/domain/catalogSelection";
import { PhotoImage } from "./PhotoImage";
import { VariantThumbs } from "./VariantThumbs";
import { rememberTilesOnViewerClick } from "@/src/ui/viewerSequence";

export function CollectionMosaic({
  tiles,
  mosaic,
  variants = false,
}: {
  tiles: CatalogTile[];
  mosaic: boolean;
  /** Whether visitors may switch each work's variant; the collection decides. */
  variants?: boolean;
}) {
  return (
    <div className="collection-canvas">
      <ul
        className={mosaic ? "collection-mosaic" : "catalog-grid"}
        onClickCapture={(event) =>
          rememberTilesOnViewerClick(event.target, tiles)
        }
      >
        {tiles.map((tile) => (
          <MosaicTile
            key={`${tile.key}:${tile.photo.getId()}`}
            tile={tile}
            mosaic={mosaic}
            variants={variants}
          />
        ))}
      </ul>
    </div>
  );
}

function MosaicTile({
  tile,
  mosaic,
  variants,
}: {
  tile: CatalogTile;
  mosaic: boolean;
  variants: boolean;
}) {
  const [selectedId, setSelectedId] = useState(tile.photo.getId());
  const photo =
    tile.variants.find((item) => item.getId() === selectedId) ?? tile.photo;
  return (
    <li
      style={
        mosaic
          ? {
              gridColumn: `span ${tile.entry?.columns ?? 1}`,
              gridRow: `span ${tile.entry?.rows ?? 1}`,
            }
          : undefined
      }
      className="catalog-tile"
    >
      <Link
        href={`/photo/${encodeURIComponent(photo.getId())}`}
        className="catalog-tile__image"
      >
        <PhotoImage
          photo={photo}
          className="object-contain"
          fallbackSizes="(max-width: 640px) 100vw, 50vw"
        />
        {tile.entry?.showTitle !== false && (
          <span className="photo-grid__caption">{photo.getTitle()}</span>
        )}
      </Link>
      {variants && (
        <VariantThumbs
          className="catalog-variants"
          variants={tile.variants}
          selectedId={photo.getId()}
          onSelect={setSelectedId}
          label={`Variants of ${tile.photo.getTitle()}`}
        />
      )}
    </li>
  );
}
