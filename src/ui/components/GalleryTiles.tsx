"use client";
import Link from "next/link";
import { CSSProperties, useState } from "react";
import { CatalogTile } from "@/src/domain/catalogSelection";
import { PhotoImage } from "./PhotoImage";
import { rememberTilesOnViewerClick } from "@/src/ui/viewerSequence";

import {
  choosePhotoView,
  GalleryViewContext,
} from "@/src/domain/photoPresentation";
import { PackedTile, packGallery } from "./galleryPacking";
export { galleryPriorities } from "./galleryPacking";

export function GalleryTiles({
  tiles,
  layout,
  context,
}: {
  tiles: CatalogTile[];
  layout: string;
  context?: GalleryViewContext;
}) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const photos = tiles.map(
    (tile) =>
      tile.variants.find((photo) => photo.getId() === selected[tile.key]) ??
      tile.photo,
  );
  const seed = tiles.map((tile) => tile.key).join("|");
  const views = photos.map((photo) => [
    choosePhotoView(photo, "gallery", seed, context),
  ]);
  const keys = tiles.map((tile) => tile.key);
  const desktop = packGallery(keys, views, 4);
  const mobile = packGallery(keys, views, 3);
  return (
    <ul
      className={`gallery-tiles gallery-tiles--${layout}`}
      onClickCapture={(event) =>
        rememberTilesOnViewerClick(event.target, tiles, (_tile, index) =>
          photos[index].getId(),
        )
      }
      style={
        {
          "--desktop-rows": desktop.rows,
          "--mobile-rows": mobile.rows,
        } as CSSProperties
      }
    >
      {tiles.map((tile, index) => (
        <Tile
          key={tile.key}
          tile={tile}
          photo={photos[index]}
          desktop={desktop.tiles[index]}
          mobile={mobile.tiles[index]}
          layout={layout}
          onSelect={(id) =>
            setSelected((previous) => ({ ...previous, [tile.key]: id }))
          }
        />
      ))}
    </ul>
  );
}
function Tile({
  tile,
  photo,
  desktop,
  mobile,
  layout,
  onSelect,
}: {
  tile: CatalogTile;
  photo: CatalogTile["photo"];
  desktop: PackedTile;
  mobile: PackedTile;
  layout: string;
  onSelect: (id: string) => void;
}) {
  const style = {
    "--ratio": desktop.view.ratio,
    "--dx": desktop.x,
    "--dy": desktop.y,
    "--dw": desktop.width,
    "--dh": desktop.height,
    "--mx": mobile.x,
    "--my": mobile.y,
    "--mw": mobile.width,
    "--mh": mobile.height,
  } as CSSProperties;
  return (
    <li
      className={`gallery-tile ${layout === "random" && desktop.large ? "gallery-tile--large" : ""}`}
      style={style}
    >
      <Link
        href={`/photo/${encodeURIComponent(photo.getId())}`}
        className="gallery-tile__image"
      >
        <PhotoImage
          photo={photo}
          crop={desktop.view.crop}
          className="object-cover"
          fallbackSizes="(max-width: 600px) 66vw, 50vw"
        />
        <span className="photo-grid__caption">{photo.getTitle()}</span>
      </Link>
      {tile.variants.length > 1 && (
        <label className="gallery-tile__variants">
          Variant
          <select
            aria-label={`Variant of ${tile.photo.getTitle()}`}
            value={photo.getId()}
            onChange={(event) => onSelect(event.target.value)}
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
