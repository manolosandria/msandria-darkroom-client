"use client";
import { PointerEvent as ReactPointerEvent, useRef, useState } from "react";
import { CollectionEntry } from "@/src/domain/entities/Catalog";
import { Photo } from "@/src/domain/entities/Photo";
import { PhotoImage } from "./PhotoImage";

export const MOSAIC_COLUMNS = 4;
const DRAG_THRESHOLD = 6;
const clampSpan = (value: number) =>
  Math.min(MOSAIC_COLUMNS, Math.max(1, Math.round(value)));

export const isHiddenFromPublic = (photo?: Photo) =>
  !!photo &&
  ["PRIVATE", "SELECT"].includes(photo.getClassification().visibility);

type Resize = { columns: boolean; rows: boolean };

/**
 * The collection's mosaic as the curator edits it: the same four-column canvas as
 * the public one, where a tile is dragged to a new place, resized from its edges or
 * corner and selected with a click. Every change has a keyboard equivalent in the
 * side panel, so the pointer is a shortcut rather than the only way.
 */
export function CollectionCanvas({
  entries,
  photos,
  selectedId,
  coverId,
  excluded,
  onSelect,
  onMove,
  onResize,
}: {
  entries: CollectionEntry[];
  photos: Photo[];
  selectedId: string | null;
  coverId: string | null;
  excluded: string[];
  onSelect: (photoId: string) => void;
  onMove: (from: number, to: number) => void;
  onResize: (index: number, columns: number, rows: number) => void;
}) {
  const grid = useRef<HTMLUListElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [resizing, setResizing] = useState<string | null>(null);
  const suppressClick = useRef(false);

  // One cell plus its gap, measured from the laid-out grid so it follows any width.
  function cellSize() {
    const element = grid.current;
    if (!element) return 1;
    const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
    return (element.clientWidth + gap) / MOSAIC_COLUMNS || 1;
  }

  function startDrag(
    event: ReactPointerEvent<HTMLElement>,
    photoId: string,
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
      setDragging(photoId);
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
    const entry = entries[index];
    const cell = cellSize();
    const start = { x: event.clientX, y: event.clientY };
    let current = { columns: entry.columns, rows: entry.rows };
    const target = event.currentTarget;
    target.setPointerCapture?.(event.pointerId);
    setResizing(entry.photoId);
    const move = (next: PointerEvent) => {
      const size = {
        columns: axes.columns
          ? clampSpan(entry.columns + (next.clientX - start.x) / cell)
          : entry.columns,
        rows: axes.rows
          ? clampSpan(entry.rows + (next.clientY - start.y) / cell)
          : entry.rows,
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
        aria-label="Collection composition"
      >
        {entries.map((entry, index) => {
          const photo = photos.find(
            (candidate) => candidate.getId() === entry.photoId,
          );
          const hidden = isHiddenFromPublic(photo);
          const removed = excluded.includes(entry.photoId);
          const title = photo?.getTitle() ?? "Unavailable photo";
          const classes = [
            "studio-tile",
            selectedId === entry.photoId && "studio-tile--selected",
            dragging === entry.photoId && "studio-tile--dragging",
            resizing === entry.photoId && "studio-tile--resizing",
            hidden && "studio-tile--private",
            removed && "studio-tile--removed",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <li
              key={entry.photoId}
              data-entry-index={index}
              className={classes}
              style={{
                gridColumn: `span ${entry.columns}`,
                gridRow: `span ${entry.rows}`,
              }}
            >
              <button
                type="button"
                className="studio-tile__surface"
                aria-pressed={selectedId === entry.photoId}
                aria-label={`Photo ${index + 1}: ${title}`}
                onPointerDown={(event) =>
                  startDrag(event, entry.photoId, index)
                }
                onClick={() => {
                  if (suppressClick.current) {
                    suppressClick.current = false;
                    return;
                  }
                  onSelect(entry.photoId);
                }}
              >
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
                <span className="studio-tile__index">{index + 1}</span>
                {coverId === entry.photoId && (
                  <span className="studio-tile__cover">★ Cover</span>
                )}
                {entry.showTitle !== false && photo && (
                  <span className="studio-tile__caption">{title}</span>
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
