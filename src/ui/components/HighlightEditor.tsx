"use client";

import Image from "next/image";
import { ResolutionBadge } from "./ResolutionBadge";
import {
  cleanPresentation,
  photoViews,
  galleryViewRules,
  viewAspect,
  updateGalleryRule,
} from "@/src/domain/photoPresentation";
import "./highlightPresentation.css";
import "./highlightEditor.css";
import { useRef, useState } from "react";
import {
  centeredHighlight,
  Highlight,
  MAX_CUSTOM_HIGHLIGHTS,
  HIGHLIGHT_RATIOS,
  HighlightKind,
  PhotoHighlights,
} from "@/src/domain/entities/PhotoHighlights";

const KINDS: HighlightKind[] = ["square", "landscape", "portrait"];
const LABELS = {
  square: "Square · 1:1",
  landscape: "Landscape · 3:2",
  portrait: "Portrait · 2:3",
};
const clamp = (n: number, max: number) => Math.max(0, Math.min(max, n));
const MIN_SIZE = 0.02;

/** "square", "landscape", "portrait" or "custom:<id>". */
type HighlightKey = HighlightKind | `custom:${string}`;
type Shape = HighlightKind | "free";
type Handle = "nw" | "ne" | "sw" | "se" | "n" | "e" | "s" | "w";
type Gesture =
  | { mode: "move"; pointer: number; dx: number; dy: number }
  | { mode: "draw"; pointer: number; ax: number; ay: number }
  | { mode: "edge"; pointer: number; handle: "n" | "e" | "s" | "w" };

const customKey = (id: string): HighlightKey => `custom:${id}`;

function cropOf(value: PhotoHighlights, key: HighlightKey | null) {
  if (!key) return undefined;
  if (key.startsWith("custom:"))
    return value.custom?.find((item) => customKey(item.id) === key)?.crop;
  return value[key as HighlightKind];
}

// The rectangle from a fixed anchor to the pointer, kept inside the photo. A locked shape
// keeps its proportion in image pixels: `relative` is that proportion in stage fractions.
function rectangle(
  ax: number,
  ay: number,
  px: number,
  py: number,
  relative: number | null,
): Highlight {
  const right = px >= ax;
  const down = py >= ay;
  const maxWidth = right ? 1 - ax : ax;
  const maxHeight = down ? 1 - ay : ay;
  let width = Math.min(Math.abs(px - ax), maxWidth);
  let height = Math.min(Math.abs(py - ay), maxHeight);
  if (relative) {
    width = Math.min(
      Math.max(width, height * relative),
      maxWidth,
      maxHeight * relative,
    );
    height = width / relative;
  }
  return {
    x: right ? ax : ax - width,
    y: down ? ay : ay - height,
    width,
    height,
  };
}

function ShapeIcon({ shape }: { shape: Shape }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      {shape === "square" ? (
        <rect x="5" y="5" width="14" height="14" rx="1" />
      ) : shape === "landscape" ? (
        <rect x="2.5" y="7" width="19" height="12.5" rx="1" />
      ) : shape === "portrait" ? (
        <rect x="6.5" y="2.5" width="11" height="19" rx="1" />
      ) : (
        <rect x="3" y="5" width="18" height="14" rx="1" strokeDasharray="3 2" />
      )}
    </svg>
  );
}

function Icon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}
const ICONS = {
  plus: "M12 5v14M5 12h14",
  accept: "M5 12.5l4.5 4.5L19 7",
  cancel: "M6 6l12 12M18 6L6 18",
  revert: "M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5",
  duplicate: "M8 8h11v11H8zM5 16V5h11",
  remove: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13",
};

export function HighlightEditor({
  src,
  width,
  height,
  value,
  onChange: commit,
  onActiveChange,
  disabled = false,
}: {
  src: string;
  width: number;
  height: number;
  value: PhotoHighlights;
  onChange: (value: PhotoHighlights) => void;
  /** Told which highlight is selected, so a larger view elsewhere can follow it. */
  onActiveChange?: (key: string | null) => void;
  disabled?: boolean;
}) {
  const onChange = (next: PhotoHighlights) => commit(cleanPresentation(next));
  const ratio = width / height;
  const existing: HighlightKey[] = [
    ...KINDS.filter((kind) => value[kind]),
    ...(value.custom ?? []).map((item) => customKey(item.id)),
  ];
  const [chosen, setChosen] = useState<HighlightKey | null>(
    () => existing[0] ?? null,
  );
  const active = chosen && cropOf(value, chosen) ? chosen : null;
  // What each highlight looked like when the editor opened or it was accepted.
  const [snapshots, setSnapshots] = useState<Record<string, Highlight>>(() =>
    Object.fromEntries(
      existing.map((key) => [key, cropOf(value, key)!] as const),
    ),
  );
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState<{
    shape: Shape;
    crop: Highlight | null;
  } | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const custom = active?.startsWith("custom:")
    ? value.custom?.find((item) => customKey(item.id) === active)
    : undefined;
  const crop = draft ? draft.crop : cropOf(value, active);
  const shape: Shape | null = draft
    ? draft.shape
    : custom
      ? "free"
      : (active as HighlightKind | null);
  const relative =
    shape && shape !== "free" ? HIGHLIGHT_RATIOS[shape] / ratio : null;

  function select(key: HighlightKey | null) {
    setChosen(key);
    onActiveChange?.(key);
  }
  function update(next: Highlight) {
    if (draft) {
      setDraft({ ...draft, crop: next });
      return;
    }
    if (!active) return;
    if (custom)
      onChange({
        ...value,
        custom: value.custom!.map((item) =>
          item.id === custom.id ? { ...item, crop: next } : item,
        ),
      });
    else onChange({ ...value, [active]: next });
  }
  function patch(part: Partial<Highlight>) {
    if (crop) update({ ...crop, ...part });
  }
  function startDrawing(next: Shape) {
    setPicking(false);
    setDraft({ shape: next, crop: null });
  }
  function accept() {
    if (!draft?.crop) return;
    let key: HighlightKey;
    if (draft.shape === "free") {
      const items = value.custom ?? [];
      const id = crypto.randomUUID();
      key = customKey(id);
      onChange({
        ...value,
        custom: [
          ...items,
          { id, name: `Detail ${items.length + 1}`, crop: draft.crop },
        ],
      });
    } else {
      key = draft.shape;
      onChange({ ...value, [draft.shape]: draft.crop });
    }
    setSnapshots((previous) => ({ ...previous, [key]: draft.crop! }));
    setDraft(null);
    select(key);
  }
  function addCustom(source: Highlight) {
    const items = value.custom ?? [];
    if (items.length >= MAX_CUSTOM_HIGHLIGHTS) return;
    const id = crypto.randomUUID();
    onChange({
      ...value,
      custom: [
        ...items,
        { id, name: `Detail ${items.length + 1}`, crop: { ...source } },
      ],
    });
    setSnapshots((previous) => ({
      ...previous,
      [customKey(id)]: { ...source },
    }));
    select(customKey(id));
  }
  function remove() {
    if (!active) return;
    const next = { ...value };
    if (custom) {
      const remaining = (value.custom ?? []).filter(
        (item) => item.id !== custom.id,
      );
      if (remaining.length) next.custom = remaining;
      else delete next.custom;
    } else delete next[active as HighlightKind];
    onChange(next);
    select(null);
  }
  const point = (
    event: React.PointerEvent<HTMLElement>,
    stage: HTMLElement,
  ) => {
    const bounds = stage.getBoundingClientRect();
    return {
      x: clamp((event.clientX - bounds.left) / bounds.width, 1),
      y: clamp((event.clientY - bounds.top) / bounds.height, 1),
    };
  };
  const snapshot = active ? snapshots[active] : undefined;
  const changed =
    !!snapshot &&
    JSON.stringify(snapshot) !== JSON.stringify(cropOf(value, active));
  const strip = existing.map((key) => {
    const item = key.startsWith("custom:")
      ? value.custom!.find((entry) => customKey(entry.id) === key)!
      : null;
    const c = cropOf(value, key)!;
    return {
      key,
      label: item ? item.name : LABELS[key as HighlightKind],
      alt: `${item ? item.name : key} thumbnail preview`,
      crop: c,
      aspect: (c.width * width) / (c.height * height),
      shape: (item ? "free" : key) as Shape,
    };
  });
  const customCount = value.custom?.length ?? 0;
  return (
    <>
      <ResolutionBadge
        width={width * (crop?.width ?? 1)}
        height={height * (crop?.height ?? 1)}
      />
      <fieldset className="highlight-editor" disabled={disabled}>
        <legend>
          Highlights{" "}
          <span className="upload-muted">/ optional thumbnail crops</span>
        </legend>
        <div className="highlight-bar">
          <div className="highlight-strip" aria-label="Highlights">
            {strip.map((item) => (
              <button
                type="button"
                key={item.key}
                className="highlight-thumb"
                aria-pressed={!draft && active === item.key}
                aria-label={item.label}
                title={item.label}
                onClick={() => {
                  setDraft(null);
                  select(item.key);
                }}
              >
                <span
                  className="highlight-thumb__image"
                  style={{ aspectRatio: item.aspect }}
                >
                  <Image
                    src={src}
                    alt={item.alt}
                    unoptimized
                    width={width}
                    height={height}
                    style={{
                      position: "absolute",
                      maxWidth: "none",
                      width: `${100 / item.crop.width}%`,
                      height: `${100 / item.crop.height}%`,
                      left: `${(-item.crop.x / item.crop.width) * 100}%`,
                      top: `${(-item.crop.y / item.crop.height) * 100}%`,
                    }}
                  />
                </span>
                <span className="highlight-thumb__label">
                  <ShapeIcon shape={item.shape} />
                  {item.label}
                </span>
              </button>
            ))}
            {strip.length === 0 && (
              <p className="upload-muted highlight-strip__empty">
                No highlights yet. Press + and draw one on the photo.
              </p>
            )}
          </div>
          <button
            type="button"
            className="highlight-add"
            aria-label="New highlight"
            title="New highlight"
            aria-expanded={picking}
            onClick={() => setPicking(!picking)}
          >
            <Icon path={ICONS.plus} />
          </button>
        </div>
        {picking && (
          <div
            className="highlight-shapes"
            role="group"
            aria-label="Shape to draw"
          >
            {([...KINDS, "free"] as Shape[]).map((option) => (
              <button
                type="button"
                key={option}
                aria-label={
                  option === "free"
                    ? "Draw custom highlight"
                    : `Draw ${option} highlight`
                }
                disabled={
                  option === "free" && customCount >= MAX_CUSTOM_HIGHLIGHTS
                }
                onClick={() => startDrawing(option)}
              >
                <ShapeIcon shape={option} />
                <span>
                  {option === "free"
                    ? "Free"
                    : LABELS[option].replace(" · ", " ")}
                  {option !== "free" && value[option] ? " ✓" : ""}
                </span>
              </button>
            ))}
          </div>
        )}
        <div
          className="highlight-stage"
          data-drawing={draft ? "" : undefined}
          style={{ aspectRatio: ratio, width: `min(100%, ${460 * ratio}px)` }}
          onPointerDown={(event) => {
            if (disabled) return;
            const target = event.target as HTMLElement;
            const handle = target.dataset.handle as Handle | undefined;
            const stage = event.currentTarget;
            const { x, y } = point(event, stage);
            event.preventDefault();
            stage.setPointerCapture?.(event.pointerId);
            if (handle && crop) {
              if (handle.length === 1) {
                gesture.current = {
                  mode: "edge",
                  pointer: event.pointerId,
                  handle: handle as "n" | "e" | "s" | "w",
                };
                return;
              }
              // A corner resizes from the opposite one, which stays put.
              gesture.current = {
                mode: "draw",
                pointer: event.pointerId,
                ax: handle.includes("w") ? crop.x + crop.width : crop.x,
                ay: handle.includes("n") ? crop.y + crop.height : crop.y,
              };
              return;
            }
            const inside =
              !!crop &&
              x >= crop.x &&
              x <= crop.x + crop.width &&
              y >= crop.y &&
              y <= crop.y + crop.height;
            if (draft && !inside) {
              // Drawing starts where the pointer goes down.
              gesture.current = {
                mode: "draw",
                pointer: event.pointerId,
                ax: x,
                ay: y,
              };
              setDraft({ ...draft, crop: { x, y, width: 0, height: 0 } });
              return;
            }
            if (!crop) return;
            gesture.current = {
              mode: "move",
              pointer: event.pointerId,
              dx: inside ? x - crop.x : crop.width / 2,
              dy: inside ? y - crop.y : crop.height / 2,
            };
            const g = gesture.current;
            update({
              ...crop,
              x: clamp(x - g.dx, 1 - crop.width),
              y: clamp(y - g.dy, 1 - crop.height),
            });
          }}
          onPointerMove={(event) => {
            const g = gesture.current;
            if (!g || g.pointer !== event.pointerId || !crop || disabled)
              return;
            const { x, y } = point(event, event.currentTarget);
            if (g.mode === "move")
              update({
                ...crop,
                x: clamp(x - g.dx, 1 - crop.width),
                y: clamp(y - g.dy, 1 - crop.height),
              });
            else if (g.mode === "draw")
              update(rectangle(g.ax, g.ay, x, y, relative));
            else {
              const right = crop.x + crop.width;
              const bottom = crop.y + crop.height;
              if (g.handle === "e")
                update({ ...crop, width: Math.max(MIN_SIZE, x - crop.x) });
              else if (g.handle === "s")
                update({ ...crop, height: Math.max(MIN_SIZE, y - crop.y) });
              else if (g.handle === "w") {
                const left = Math.min(x, right - MIN_SIZE);
                update({ ...crop, x: left, width: right - left });
              } else {
                const top = Math.min(y, bottom - MIN_SIZE);
                update({ ...crop, y: top, height: bottom - top });
              }
            }
          }}
          onPointerUp={() => {
            gesture.current = null;
            // A click without a drag leaves nothing worth keeping.
            if (
              draft?.crop &&
              (draft.crop.width < MIN_SIZE || draft.crop.height < MIN_SIZE)
            )
              setDraft({ ...draft, crop: null });
          }}
          onPointerCancel={() => {
            gesture.current = null;
          }}
        >
          <Image
            src={src}
            alt="Highlight selection"
            fill
            unoptimized
            draggable={false}
            sizes="600px"
          />
          {crop && crop.width > 0 && (
            <div
              className={`highlight-selection${draft ? " highlight-selection--draft" : ""}`}
              style={{
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.width * 100}%`,
                height: `${crop.height * 100}%`,
              }}
            >
              <span>
                {draft
                  ? "New highlight"
                  : (custom?.name ?? LABELS[active as HighlightKind])}
              </span>
              {(["nw", "ne", "sw", "se"] as const).map((handle) => (
                <i
                  key={handle}
                  className={`highlight-handle highlight-handle--${handle}`}
                  data-handle={handle}
                />
              ))}
              {shape === "free" &&
                (["n", "e", "s", "w"] as const).map((handle) => (
                  <i
                    key={handle}
                    className={`highlight-handle highlight-handle--${handle}`}
                    data-handle={handle}
                  />
                ))}
            </div>
          )}
          {draft && !draft.crop && (
            <p className="highlight-stage__hint">
              Drag on the photo to draw{" "}
              {draft.shape === "free" ? "a free shape" : `a ${draft.shape}`}
            </p>
          )}
        </div>
        {draft ? (
          <div className="highlight-confirm">
            <span>
              {draft.crop
                ? "Move it or pull a corner, then accept."
                : "Draw the new highlight."}
            </span>
            <button
              type="button"
              className="highlight-confirm__accept"
              aria-label="Accept highlight"
              title="Accept"
              disabled={!draft.crop}
              onClick={accept}
            >
              <Icon path={ICONS.accept} />
            </button>
            <button
              type="button"
              className="highlight-confirm__cancel"
              aria-label="Cancel highlight"
              title="Cancel"
              onClick={() => setDraft(null)}
            >
              <Icon path={ICONS.cancel} />
            </button>
          </div>
        ) : (
          active &&
          crop && (
            <div className="highlight-tools">
              {custom && (
                <label className="highlight-tools__name">
                  <span className="sr-only">Highlight name</span>
                  <input
                    aria-label="Highlight name"
                    value={custom.name}
                    maxLength={80}
                    required
                    onChange={(event) =>
                      onChange({
                        ...value,
                        custom: value.custom!.map((item) =>
                          item.id === custom.id
                            ? { ...item, name: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                </label>
              )}
              <span className="highlight-tools__size">
                {Math.round(crop.width * width)} ×{" "}
                {Math.round(crop.height * height)} px
              </span>
              <button
                type="button"
                aria-label="Revert highlight"
                title="Revert to how it was"
                disabled={!changed}
                onClick={() => snapshot && update(snapshot)}
              >
                <Icon path={ICONS.revert} />
              </button>
              <button
                type="button"
                aria-label="Duplicate as custom highlight"
                title="Duplicate as custom highlight"
                disabled={customCount >= MAX_CUSTOM_HIGHLIGHTS}
                onClick={() => addCustom(crop)}
              >
                <Icon path={ICONS.duplicate} />
              </button>
              <button
                type="button"
                className="highlight-tools__remove"
                aria-label={`Remove ${custom ? "custom" : active} highlight`}
                title="Remove highlight"
                onClick={remove}
              >
                <Icon path={ICONS.remove} />
              </button>
            </div>
          )
        )}
        {!draft && active && crop && (
          <details className="highlight-precise">
            <summary>Precise size and position</summary>
            {custom && (
              <div className="highlight-controls">
                {(["width", "height"] as const).map((axis) => (
                  <label key={axis}>
                    {axis === "width" ? "Crop width (px)" : "Crop height (px)"}
                    <input
                      type="number"
                      min={1}
                      max={axis === "width" ? width : height}
                      value={Math.round(
                        crop[axis] * (axis === "width" ? width : height),
                      )}
                      onChange={(event) => {
                        const pixels = event.currentTarget.valueAsNumber;
                        if (!Number.isFinite(pixels) || pixels < 1) return;
                        const dimension = Math.min(
                          1,
                          pixels / (axis === "width" ? width : height),
                        );
                        const position = axis === "width" ? "x" : "y";
                        patch({
                          [axis]: dimension,
                          [position]: clamp(
                            crop[position] + (crop[axis] - dimension) / 2,
                            1 - dimension,
                          ),
                        });
                      }}
                    />
                  </label>
                ))}
              </div>
            )}
            <div className="highlight-controls">
              <label>
                Crop size
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={Math.round(Math.max(crop.width, crop.height) * 100)}
                  onChange={(event) => {
                    const resized = custom
                      ? {
                          width:
                            ((crop.width / Math.max(crop.width, crop.height)) *
                              Number(event.target.value)) /
                            100,
                          height:
                            ((crop.height / Math.max(crop.width, crop.height)) *
                              Number(event.target.value)) /
                            100,
                        }
                      : centeredHighlight(
                          active as HighlightKind,
                          ratio,
                          Number(event.target.value) / 100,
                        );
                    update({
                      width: resized.width,
                      height: resized.height,
                      x: clamp(
                        crop.x + (crop.width - resized.width) / 2,
                        1 - resized.width,
                      ),
                      y: clamp(
                        crop.y + (crop.height - resized.height) / 2,
                        1 - resized.height,
                      ),
                    });
                  }}
                />
              </label>
              <label>
                Horizontal position
                <input
                  type="range"
                  min="0"
                  max="1000"
                  value={Math.round((crop.x / (1 - crop.width || 1)) * 1000)}
                  onChange={(event) =>
                    patch({
                      x: (Number(event.target.value) / 1000) * (1 - crop.width),
                    })
                  }
                />
              </label>
              <label>
                Vertical position
                <input
                  type="range"
                  min="0"
                  max="1000"
                  value={Math.round((crop.y / (1 - crop.height || 1)) * 1000)}
                  onChange={(event) =>
                    patch({
                      y:
                        (Number(event.target.value) / 1000) * (1 - crop.height),
                    })
                  }
                />
              </label>
            </div>
          </details>
        )}
        <section
          className="highlight-eligibility"
          aria-label="Random presentation choices"
        >
          <h3>Where can this image appear?</h3>
          <p>
            Enable each original or crop for Gallery and Home. Leave a column
            empty to exclude this photo there. Save the photo to apply.
          </p>
          <div className="highlight-eligibility__grid">
            {photoViews(value, ratio).map((view) => (
              <article key={view.id}>
                <div
                  className="highlight-eligibility__preview"
                  style={{ aspectRatio: view.ratio }}
                >
                  <Image
                    src={src}
                    alt={`${view.name} presentation preview`}
                    unoptimized
                    width={width}
                    height={height}
                    style={
                      view.crop
                        ? {
                            position: "absolute",
                            maxWidth: "none",
                            width: `${100 / view.crop.width}%`,
                            height: `${100 / view.crop.height}%`,
                            left: `${(-100 * view.crop.x) / view.crop.width}%`,
                            top: `${(-100 * view.crop.y) / view.crop.height}%`,
                          }
                        : {
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                          }
                    }
                  />
                </div>
                <strong>{view.name}</strong>
                {(["gallery", "home"] as const).map((target) => (
                  <label key={target}>
                    <input
                      type="checkbox"
                      aria-label={`${view.name} in ${target === "gallery" ? "Gallery" : "Home"}`}
                      checked={(
                        value.presentation?.[target] ?? ["original"]
                      ).includes(view.id)}
                      onChange={(event) => {
                        if (target === "gallery") {
                          onChange(
                            updateGalleryRule(
                              value,
                              view.id,
                              event.target.checked,
                              ratio,
                            ),
                          );
                          return;
                        }
                        const presentation = value.presentation ?? {
                          gallery: ["original"],
                          home: ["original"],
                        };
                        const current = presentation[target];
                        onChange({
                          ...value,
                          presentation: {
                            ...presentation,
                            [target]: event.target.checked
                              ? [...current, view.id]
                              : current.filter((id) => id !== view.id),
                          },
                        });
                      }}
                    />{" "}
                    {target === "gallery" ? "Gallery" : "Home"}
                  </label>
                ))}
                <details className="highlight-distribution-matrix">
                  <summary>Distribution & aspect eligibility</summary>
                  <p>
                    This view is {viewAspect(view.ratio)}. Add a separate
                    highlight to offer another aspect ratio.
                  </p>
                  <table>
                    <caption>Eligible view aspects for {view.name}</caption>
                    <thead>
                      <tr>
                        <th>Layout</th>
                        {["Portrait", "Square", "Landscape"].map((label) => (
                          <th key={label}>{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ["uniform", "Squares"],
                          ["random", "Random emphasis"],
                          ["justified", "Natural proportions"],
                        ] as const
                      ).map(([layout, label]) => (
                        <tr key={layout}>
                          <th>{label}</th>
                          {["portrait", "square", "landscape"].map((aspect) => (
                            <td key={aspect}>
                              <input
                                type="checkbox"
                                aria-label={`${view.name} in ${label} ${aspect}`}
                                disabled={viewAspect(view.ratio) !== aspect}
                                checked={galleryViewRules(value, ratio)
                                  .find(
                                    (rule) =>
                                      rule.layout === layout &&
                                      rule.aspect === aspect,
                                  )!
                                  .views.includes(view.id)}
                                onChange={(event) =>
                                  onChange(
                                    updateGalleryRule(
                                      value,
                                      view.id,
                                      event.target.checked,
                                      ratio,
                                      layout,
                                      aspect,
                                    ),
                                  )
                                }
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </article>
            ))}
          </div>
        </section>
      </fieldset>
    </>
  );
}
