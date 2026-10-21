"use client";
import "./catalogStudio.css";
import Link from "next/link";
import { useState } from "react";
import { CatalogTile } from "@/src/domain/catalogSelection";
import { PhotoImage } from "./PhotoImage";

export function CollectionMosaic({
  tiles,
  mosaic,
}: {
  tiles: CatalogTile[];
  mosaic: boolean;
}) {
  return (
    <div className="collection-canvas">
      <ul className={mosaic ? "collection-mosaic" : "catalog-grid"}>
        {tiles.map((tile) => (
          <MosaicTile
            key={`${tile.key}:${tile.photo.getId()}`}
            tile={tile}
            mosaic={mosaic}
          />
        ))}
      </ul>
    </div>
  );
}

function MosaicTile({ tile, mosaic }: { tile: CatalogTile; mosaic: boolean }) {
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
      {tile.variants.length > 1 && (
        <label className="catalog-variants">
          Variant
          <select
            aria-label={`Variant of ${tile.photo.getTitle()}`}
            value={photo.getId()}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {tile.variants.map((variant) => (
              <option key={variant.getId()} value={variant.getId()}>
                {variant.getTitle()}
              </option>
            ))}
          </select>
        </label>
      )}
    </li>
  );
}
