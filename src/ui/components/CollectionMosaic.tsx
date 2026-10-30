"use client";
import "./catalogStudio.css";
import Link from "next/link";
import { CSSProperties, Fragment, useState } from "react";
import { CatalogTile } from "@/src/domain/catalogSelection";
import { CollectionText } from "@/src/domain/entities/Catalog";
import { spanStyle } from "@/src/domain/collectionLayout";
import { PhotoImage } from "./PhotoImage";
import { VariantThumbs } from "./VariantThumbs";
import { rememberTilesOnViewerClick } from "@/src/ui/viewerSequence";

/**
 * A collection as visitors see it: eight columns on wide screens and four on phones,
 * each piece in the size the curator gave it, with the collection's text blocks
 * between the photos. A text placed before a photo appears right before it.
 */
export function CollectionMosaic({
  tiles,
  mosaic,
  variants = false,
  texts = [],
}: {
  tiles: CatalogTile[];
  mosaic: boolean;
  /** Whether visitors may switch each work's variant; the collection decides. */
  variants?: boolean;
  /** The text blocks to show among these tiles, already chosen for the page. */
  texts?: CollectionText[];
}) {
  const queue = mosaic
    ? [...texts].sort((a, b) => a.position - b.position)
    : [];
  const textsBefore = (position: number) => {
    const taken: CollectionText[] = [];
    while (queue.length && queue[0].position <= position)
      taken.push(queue.shift()!);
    return taken;
  };
  return (
    <div className="collection-canvas">
      <ul
        className={mosaic ? "collection-mosaic" : "catalog-grid"}
        onClickCapture={(event) =>
          rememberTilesOnViewerClick(event.target, tiles)
        }
      >
        {tiles.map((tile, index) => (
          <Fragment key={`${tile.key}:${tile.photo.getId()}`}>
            {textsBefore(tile.entry?.position ?? index).map((text, order) => (
              <MosaicText key={`text:${text.position}:${order}`} text={text} />
            ))}
            <MosaicTile tile={tile} mosaic={mosaic} variants={variants} />
          </Fragment>
        ))}
        {textsBefore(Infinity).map((text, order) => (
          <MosaicText key={`text:end:${order}`} text={text} />
        ))}
      </ul>
    </div>
  );
}

function MosaicText({ text }: { text: CollectionText }) {
  return (
    <li
      className="mosaic-piece mosaic-piece--text"
      style={spanStyle(text) as CSSProperties}
    >
      <p
        className="mosaic-text"
        data-style={text.style ?? "BODY"}
        data-align={text.align ?? "START"}
      >
        {text.text}
      </p>
    </li>
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
  const caption = mosaic ? tile.entry?.caption?.trim() : "";
  return (
    <li
      style={
        mosaic && tile.entry
          ? (spanStyle(tile.entry) as CSSProperties)
          : undefined
      }
      className={`catalog-tile mosaic-piece${caption ? " mosaic-piece--captioned" : ""}`}
    >
      <figure className="mosaic-piece__frame">
        <div className="mosaic-piece__image">
          <Link
            href={`/photo/${encodeURIComponent(photo.getId())}`}
            className="catalog-tile__image"
            aria-describedby={caption ? `caption-${tile.key}` : undefined}
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
        </div>
        {caption && (
          <figcaption
            id={`caption-${tile.key}`}
            className="mosaic-piece__caption"
          >
            {caption}
          </figcaption>
        )}
      </figure>
    </li>
  );
}
