"use client";
import "./catalogStudio.css";
import Link from "next/link";
import { CSSProperties, Fragment, useState } from "react";
import { CatalogTile } from "@/src/domain/catalogSelection";
import { CollectionText, MosaicSize } from "@/src/domain/entities/Catalog";
import {
  MOBILE_MOSAIC_COLUMNS,
  MOSAIC_COLUMNS,
  MosaicCell,
  mobileSpan,
  placePieces,
  spanIn,
  spanStyle,
} from "@/src/domain/collectionLayout";
import { shareSizes } from "@/src/ui/imageSizes";
import { PhotoImage } from "./PhotoImage";
import { VariantThumbs } from "./VariantThumbs";
import { rememberTilesOnViewerClick } from "@/src/ui/viewerSequence";

/**
 * A collection as visitors see it: eight columns on wide screens and four on phones,
 * each piece in the size the curator gave it, with the collection's text blocks
 * between the photos. A text placed before a photo appears right before it. On wide
 * screens every piece sits in the cell the curator chose (`placePieces`), the page's
 * first row on top; phones read them in order.
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
  // The page's pieces in reading order, texts before the photo they precede.
  const pieces = tiles.map((tile, index) => ({
    tile,
    texts: textsBefore(tile.entry?.position ?? index),
  }));
  const closing = textsBefore(Infinity);
  const sizes: MosaicSize[] = pieces.flatMap(({ tile, texts }) => [
    ...texts,
    tile.entry ?? { columns: 2, rows: 2 },
  ]);
  sizes.push(...closing);
  const placed = mosaic ? placePieces(sizes) : [];
  // A later page starts at its own first row, not under the rows of the pages before.
  const top = Math.min(...placed.map((cell) => cell.row)) - 1;
  let next = 0;
  const cellOf = () => {
    const cell = placed[next++];
    return cell && { ...cell, row: cell.row - top };
  };
  return (
    <div className="collection-canvas">
      <ul
        className={mosaic ? "collection-mosaic" : "catalog-grid"}
        onClickCapture={(event) =>
          rememberTilesOnViewerClick(event.target, tiles)
        }
      >
        {pieces.map(({ tile, texts }) => (
          <Fragment key={`${tile.key}:${tile.photo.getId()}`}>
            {texts.map((text, order) => (
              <MosaicText
                key={`text:${text.position}:${order}`}
                text={text}
                cell={cellOf()}
              />
            ))}
            <MosaicTile
              tile={tile}
              mosaic={mosaic}
              variants={variants}
              cell={cellOf()}
            />
          </Fragment>
        ))}
        {closing.map((text, order) => (
          <MosaicText key={`text:end:${order}`} text={text} cell={cellOf()} />
        ))}
      </ul>
    </div>
  );
}

function MosaicText({
  text,
  cell,
}: {
  text: CollectionText;
  cell?: MosaicCell;
}) {
  return (
    <li
      className="mosaic-piece mosaic-piece--text"
      style={spanStyle(text, cell) as CSSProperties}
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
  cell,
}: {
  tile: CatalogTile;
  mosaic: boolean;
  variants: boolean;
  cell?: MosaicCell;
}) {
  const [selectedId, setSelectedId] = useState(tile.photo.getId());
  const photo =
    tile.variants.find((item) => item.getId() === selectedId) ?? tile.photo;
  const caption = mosaic ? tile.entry?.caption?.trim() : "";
  return (
    <li
      style={
        mosaic && tile.entry
          ? (spanStyle(tile.entry, cell) as CSSProperties)
          : undefined
      }
      className={`catalog-tile mosaic-piece${caption ? " mosaic-piece--captioned" : ""}`}
    >
      <figure className="mosaic-piece__frame">
        <div className="mosaic-piece__image">
          <span
            className="mosaic-photo"
            style={{ "--photo-ratio": photo.getAspectRatio() } as CSSProperties}
          >
            <Link
              href={`/photo/${encodeURIComponent(photo.getId())}`}
              className="catalog-tile__image"
              aria-describedby={caption ? `caption-${tile.key}` : undefined}
            >
              <PhotoImage
                photo={photo}
                className="object-contain"
                fallbackSizes={
                  // A piece takes its columns of eight (four on phones).
                  mosaic && tile.entry
                    ? shareSizes(
                        mobileSpan(tile.entry).columns / MOBILE_MOSAIC_COLUMNS,
                        spanIn(tile.entry, "desktop").columns / MOSAIC_COLUMNS,
                        640,
                      )
                    : "(max-width: 640px) 100vw, 25vw"
                }
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
          </span>
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
