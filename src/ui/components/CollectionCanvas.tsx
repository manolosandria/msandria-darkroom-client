"use client";
import {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";
import {
  CollectionBlock,
  MOBILE_MOSAIC_COLUMNS,
  MOSAIC_COLUMNS,
  MOSAIC_MAX_ROWS,
  MosaicLayout,
  spanIn,
  spanStyle,
} from "@/src/domain/collectionLayout";
import { Photo } from "@/src/domain/entities/Photo";
import { PhotoImage } from "./PhotoImage";

export { MOSAIC_COLUMNS } from "@/src/domain/collectionLayout";
const DRAG_THRESHOLD = 6;

export const isHiddenFromPublic = (photo?: Photo) =>
  !!photo &&
  ["PRIVATE", "SELECT"].includes(photo.getClassification().visibility);

type Resize = { columns: boolean; rows: boolean };

/**
 * The collection's mosaic as the curator edits it: the same canvas as the public
 * one, eight columns wide or, in the phone layout, four. A piece is dragged to a new
 * place, resized from its edges or corner and selected with a click. Every change
 * has a keyboard equivalent in the side panel, so the pointer is a shortcut rather
 * than the only way.
 */
export function CollectionCanvas({
  blocks,
  photos,
  layout = "desktop",
  selectedKey,
  coverId,
  excluded,
  onSelect,
  onMove,
  onResize,
}: {
  blocks: CollectionBlock[];
  photos: Photo[];
  layout?: MosaicLayout;
  selectedKey: string | null;
  coverId: string | null;
  excluded: string[];
  onSelect: (key: string) => void;
  onMove: (from: number, to: number) => void;
  onResize: (index: number, columns: number, rows: number) => void;
}) {
  const grid = useRef<HTMLUListElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [resizing, setResizing] = useState<string | null>(null);
  const suppressClick = useRef(false);
  const columns = layout === "mobile" ? MOBILE_MOSAIC_COLUMNS : MOSAIC_COLUMNS;
  // Photos are numbered among themselves, as the side panel counts them.
  const photoNumbers = blocks.reduce<number[]>(
    (numbers, block) => [
      ...numbers,
      (numbers.at(-1) ?? 0) + (block.kind === "photo" ? 1 : 0),
    ],
    [],
  );

  // One cell plus its gap, measured from the laid-out grid so it follows any width.
  function cellSize() {
    const element = grid.current;
    if (!element) return 1;
    const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
    return (element.clientWidth + gap) / columns || 1;
  }

  function startDrag(
    event: ReactPointerEvent<HTMLElement>,
    key: string,
    index: number,
  ) {
    if (event.button !== 0) return;
    const start = { x: event.clientX, y: event.clientY };
    let moved = false;
    // Tracked here rather than read from props, which lag a render behind the drag.
    let position = index;
    const target = event.currentTarget;
    target.setPointerCapture?.(event.pointerId);
    const move = (next: PointerEvent) => {
      if (
        !moved &&
        Math.hypot(next.clientX - start.x, next.clientY - start.y) <
          DRAG_THRESHOLD
      )
        return;
      moved = true;
      setDragging(key);
      const over = document
        .elementFromPoint?.(next.clientX, next.clientY)
        ?.closest<HTMLElement>("[data-entry-index]");
      const to = Number(over?.dataset.entryIndex ?? position);
      if (over && to !== position) {
        onMove(position, to);
        position = to;
      }
    };
    const end = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", end);
      suppressClick.current = moved;
      setDragging(null);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
    target.addEventListener("pointercancel", end);
  }

  function startResize(
    event: ReactPointerEvent<HTMLElement>,
    index: number,
    axes: Resize,
  ) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const block = blocks[index];
    const initial = spanIn(block, layout);
    const cell = cellSize();
    const start = { x: event.clientX, y: event.clientY };
    let current = { columns: initial.columns, rows: initial.rows };
    const target = event.currentTarget;
    target.setPointerCapture?.(event.pointerId);
    setResizing(block.key);
    const clampTo = (value: number, max: number) =>
      Math.min(max, Math.max(1, Math.round(value)));
    const move = (next: PointerEvent) => {
      const size = {
        columns: axes.columns
          ? clampTo(initial.columns + (next.clientX - start.x) / cell, columns)
          : initial.columns,
        rows: axes.rows
          ? clampTo(
              initial.rows + (next.clientY - start.y) / cell,
              MOSAIC_MAX_ROWS,
            )
          : initial.rows,
      };
      if (size.columns === current.columns && size.rows === current.rows)
        return;
      current = size;
      onResize(index, size.columns, size.rows);
    };
    const end = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", end);
      setResizing(null);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
    target.addEventListener("pointercancel", end);
  }

  return (
    <div className="collection-canvas">
      <ul
        ref={grid}
        className="collection-mosaic studio-canvas"
        data-layout={layout}
        aria-label={
          layout === "mobile"
            ? "Collection composition on phones"
            : "Collection composition"
        }
      >
        {blocks.map((block, index) => {
          const span = spanIn(block, layout);
          const photo =
            block.kind === "photo"
              ? photos.find((candidate) => candidate.getId() === block.photoId)
              : undefined;
          const photoNumber = photoNumbers[index];
          const hidden = isHiddenFromPublic(photo);
          const removed =
            block.kind === "photo" && excluded.includes(block.photoId);
          const title =
            block.kind === "photo"
              ? (photo?.getTitle() ?? "Unavailable photo")
              : "Text block";
          const caption = block.kind === "photo" ? block.caption?.trim() : "";
          const classes = [
            "studio-tile",
            "mosaic-piece",
            block.kind === "text" && "mosaic-piece--text studio-tile--text",
            caption && "mosaic-piece--captioned",
            selectedKey === block.key && "studio-tile--selected",
            dragging === block.key && "studio-tile--dragging",
            resizing === block.key && "studio-tile--resizing",
            hidden && "studio-tile--private",
            removed && "studio-tile--removed",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <li
              key={block.key}
              data-entry-index={index}
              className={classes}
              style={spanStyle(block) as CSSProperties}
            >
              <button
                type="button"
                className="studio-tile__surface"
                aria-pressed={selectedKey === block.key}
                aria-label={
                  block.kind === "photo"
                    ? `Photo ${photoNumber}: ${title}${caption ? `, with text: ${caption}` : ""}`
                    : `Text block: ${block.text.trim() || "empty"}`
                }
                onPointerDown={(event) => startDrag(event, block.key, index)}
                onClick={() => {
                  if (suppressClick.current) {
                    suppressClick.current = false;
                    return;
                  }
                  onSelect(block.key);
                }}
              >
                {block.kind === "text" ? (
                  <span
                    className="mosaic-text"
                    data-style={block.style ?? "BODY"}
                    data-align={block.align ?? "START"}
                  >
                    {block.text.trim() || (
                      <span className="mosaic-text__placeholder">
                        Write this block’s text in the side panel
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="mosaic-piece__frame">
                    <span className="mosaic-piece__image">
                      {photo ? (
                        <PhotoImage
                          photo={photo}
                          className="object-contain"
                          fallbackSizes="(max-width: 640px) 50vw, 25vw"
                          maxWidth={640}
                        />
                      ) : (
                        <span className="studio-tile__missing">{title}</span>
                      )}
                      {block.showTitle !== false && photo && (
                        <span className="studio-tile__caption">{title}</span>
                      )}
                    </span>
                    {caption && (
                      <span className="mosaic-piece__caption">{caption}</span>
                    )}
                  </span>
                )}
                <span className="studio-tile__index">
                  {block.kind === "photo" ? photoNumber : "T"}
                </span>
                {block.kind === "photo" && coverId === block.photoId && (
                  <span className="studio-tile__cover">★ Cover</span>
                )}
                {resizing === block.key && (
                  <span className="studio-tile__size">
                    {span.columns} × {span.rows}
                  </span>
                )}
                {hidden && (
                  <span
                    className="studio-tile__warning"
                    title="Not shown in the public collection"
                  >
                    !
                  </span>
                )}
                {removed && (
                  <span className="studio-tile__removed">
                    Will be removed when you save
                  </span>
                )}
              </button>
              <span
                aria-hidden="true"
                className="studio-handle studio-handle--right"
                onPointerDown={(event) =>
                  startResize(event, index, { columns: true, rows: false })
                }
              />
              <span
                aria-hidden="true"
                className="studio-handle studio-handle--bottom"
                onPointerDown={(event) =>
                  startResize(event, index, { columns: false, rows: true })
                }
              />
              <span
                aria-hidden="true"
                className="studio-handle studio-handle--corner"
                onPointerDown={(event) =>
                  startResize(event, index, { columns: true, rows: true })
                }
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
