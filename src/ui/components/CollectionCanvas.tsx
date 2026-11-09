"use client";
import {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";
import {
  arrangePieces,
  CollectionBlock,
  MOBILE_MOSAIC_COLUMNS,
  MOSAIC_COLUMNS,
  MOSAIC_MAX_ROWS,
  MOSAIC_MAX_START_ROW,
  MosaicCell,
  MosaicLayout,
  mosaicRows,
  placePieces,
  spanIn,
  spanStyle,
} from "@/src/domain/collectionLayout";
import { Photo } from "@/src/domain/entities/Photo";
import { PhotoImage } from "./PhotoImage";

export { MOSAIC_COLUMNS } from "@/src/domain/collectionLayout";

export const isHiddenFromPublic = (photo?: Photo) =>
  !!photo &&
  ["PRIVATE", "SELECT"].includes(photo.getClassification().visibility);

type Resize = { columns: boolean; rows: boolean };

// Empty rows kept under the composition, so a piece can be dropped below the last one.
const ROOM_BELOW = 2;
// How far the pointer travels before a press becomes a drag.
const DRAG_THRESHOLD = 5;

const KEY_STEPS: Record<string, MosaicCell> = {
  ArrowLeft: { row: 0, column: -1 },
  ArrowRight: { row: 0, column: 1 },
  ArrowUp: { row: -1, column: 0 },
  ArrowDown: { row: 1, column: 0 },
};

/**
 * The collection's mosaic as the curator edits it: the same canvas as the public
 * one, eight columns wide or, in the phone layout, four. On wide screens a piece is
 * dragged to any cell, under another one or with empty cells around it, and the
 * pieces it lands on step down out of its way while it moves; the arrow keys move a
 * focused piece one cell. Pieces resize from their edges or corner and are selected
 * with a click. Phones show the pieces in reading order, so there they only resize.
 */
export function CollectionCanvas({
  blocks,
  photos,
  layout = "desktop",
  selectedKey,
  coverId,
  excluded,
  onSelect,
  onPlace,
  onResize,
}: {
  blocks: CollectionBlock[];
  photos: Photo[];
  layout?: MosaicLayout;
  selectedKey: string | null;
  coverId: string | null;
  excluded: string[];
  onSelect: (key: string) => void;
  onPlace: (key: string, cell: MosaicCell) => void;
  onResize: (key: string, columns: number, rows: number) => void;
}) {
  const grid = useRef<HTMLUListElement>(null);
  const [resizing, setResizing] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ key: string; cell: MosaicCell } | null>(
    null,
  );
  // The click that ends a drag must not select the piece as well.
  const justDragged = useRef(false);
  const wide = layout === "desktop";
  const columns = wide ? MOSAIC_COLUMNS : MOBILE_MOSAIC_COLUMNS;
  // While a piece is dragged, the composition shows where everything would go.
  const shown = drag ? arrangePieces(blocks, drag.key, drag.cell) : blocks;
  const cells = wide ? placePieces(shown) : [];
  const height = wide ? mosaicRows(shown) : 0;
  // Photos are numbered among themselves in reading order, as the side panel counts them.
  const photoNumbers = new Map<string, number>();
  blocks
    .filter((block) => block.kind === "photo")
    .forEach((block, index) => photoNumbers.set(block.key, index + 1));

  // One cell plus its gap, measured from the laid-out grid so it follows any width.
  function pitch() {
    const element = grid.current;
    if (!element) return 1;
    const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
    return (element.clientWidth + gap) / columns || 1;
  }

  function startDrag(event: ReactPointerEvent<HTMLElement>, key: string) {
    if (!wide || event.button !== 0 || !grid.current) return;
    const index = blocks.findIndex((block) => block.key === key);
    const origin = cells[index];
    const { columns: width } = spanIn(blocks[index], "desktop");
    const step = pitch();
    const box = grid.current.getBoundingClientRect();
    // Which of the piece's cells the pointer holds, so the piece keeps under it.
    const grab = {
      column: Math.floor((event.clientX - box.left) / step) + 1 - origin.column,
      row: Math.floor((event.clientY - box.top) / step) + 1 - origin.row,
    };
    const start = { x: event.clientX, y: event.clientY };
    let target: MosaicCell | null = null;
    const move = (next: PointerEvent) => {
      if (
        !target &&
        Math.hypot(next.clientX - start.x, next.clientY - start.y) <
          DRAG_THRESHOLD
      )
        return;
      const now = grid.current?.getBoundingClientRect() ?? box;
      const cell = {
        column: Math.min(
          MOSAIC_COLUMNS - width + 1,
          Math.max(
            1,
            Math.floor((next.clientX - now.left) / step) + 1 - grab.column,
          ),
        ),
        row: Math.min(
          MOSAIC_MAX_START_ROW,
          Math.max(
            1,
            Math.floor((next.clientY - now.top) / step) + 1 - grab.row,
          ),
        ),
      };
      if (target && target.row === cell.row && target.column === cell.column)
        return;
      target = cell;
      setDrag({ key, cell });
    };
    const finish = (commit: boolean) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", drop);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", escape);
      setDrag(null);
      if (!target) return;
      justDragged.current = true;
      window.setTimeout(() => (justDragged.current = false), 0);
      if (commit) onPlace(key, target);
    };
    const drop = () => finish(true);
    const cancel = () => finish(false);
    const escape = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === "Escape") finish(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", drop);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", escape);
  }

  function nudge(event: ReactKeyboardEvent<HTMLElement>, key: string) {
    const step = KEY_STEPS[event.key];
    if (!wide || !step) return;
    event.preventDefault();
    const cell = cells[blocks.findIndex((block) => block.key === key)];
    const next = {
      row: Math.max(1, cell.row + step.row),
      column: Math.max(1, cell.column + step.column),
    };
    if (next.row !== cell.row || next.column !== cell.column)
      onPlace(key, next);
  }

  function startResize(
    event: ReactPointerEvent<HTMLElement>,
    block: CollectionBlock,
    axes: Resize,
  ) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const initial = spanIn(block, layout);
    const cell = pitch();
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
      onResize(block.key, size.columns, size.rows);
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
        data-dragging={drag ? "" : undefined}
        aria-label={
          wide ? "Collection composition" : "Collection composition on phones"
        }
      >
        {shown.map((block, index) => {
          const span = spanIn(block, layout);
          const photo =
            block.kind === "photo"
              ? photos.find((candidate) => candidate.getId() === block.photoId)
              : undefined;
          const photoNumber = photoNumbers.get(block.key) ?? 0;
          const hidden = isHiddenFromPublic(photo);
          const removed =
            block.kind === "photo" && excluded.includes(block.photoId);
          const title =
            block.kind === "photo"
              ? (photo?.getTitle() ?? "Unavailable photo")
              : "Text block";
          const caption = block.kind === "photo" ? block.caption?.trim() : "";
          const cell = wide ? cells[index] : undefined;
          const classes = [
            "studio-tile",
            "mosaic-piece",
            block.kind === "text" && "mosaic-piece--text studio-tile--text",
            caption && "mosaic-piece--captioned",
            selectedKey === block.key && "studio-tile--selected",
            drag?.key === block.key && "studio-tile--dragging",
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
              style={spanStyle(block, cell) as CSSProperties}
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
                title={
                  cell
                    ? `Row ${cell.row}, column ${cell.column}: drag it, or move it with the arrow keys`
                    : undefined
                }
                data-movable={wide || undefined}
                onPointerDown={(event) => startDrag(event, block.key)}
                onKeyDown={(event) => nudge(event, block.key)}
                onClick={() => {
                  if (justDragged.current) return;
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
                        <span
                          className="mosaic-photo"
                          style={
                            {
                              "--photo-ratio": photo.getAspectRatio(),
                            } as CSSProperties
                          }
                        >
                          <PhotoImage
                            photo={photo}
                            className="object-cover"
                            fallbackSizes="(max-width: 640px) 50vw, 25vw"
                            maxWidth={640}
                          />
                          {block.showTitle !== false && (
                            <span className="studio-tile__caption">
                              {title}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="studio-tile__missing">{title}</span>
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
                  startResize(event, block, { columns: true, rows: false })
                }
              />
              <span
                aria-hidden="true"
                className="studio-handle studio-handle--bottom"
                onPointerDown={(event) =>
                  startResize(event, block, { columns: false, rows: true })
                }
              />
              <span
                aria-hidden="true"
                className="studio-handle studio-handle--corner"
                onPointerDown={(event) =>
                  startResize(event, block, { columns: true, rows: true })
                }
              />
            </li>
          );
        })}
        {wide && (
          <li
            aria-hidden="true"
            className="studio-canvas__room"
            style={{ gridRow: height + ROOM_BELOW, gridColumn: 1 }}
          />
        )}
      </ul>
    </div>
  );
}
