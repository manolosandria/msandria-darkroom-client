"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { ResolutionBadge } from "./ResolutionBadge";
import {
  cleanPresentation,
  photoViews,
  galleryViewRules,
  viewAspect,
  updateGalleryRule,
  offerInGalleryGrid,
  swapViewReferences,
} from "@/src/domain/photoPresentation";
import "./highlightPresentation.css";
import "./highlightEditor.css";
import { useRef, useState } from "react";
import {
  centeredHighlight,
  CustomHighlight,
  Highlight,
  MAX_CUSTOM_HIGHLIGHTS,
  HIGHLIGHT_RATIOS,
  HighlightKind,
  PhotoHighlights,
  refitHighlight,
} from "@/src/domain/entities/PhotoHighlights";

const KINDS: HighlightKind[] = ["square", "landscape", "portrait"];
const NAMES: Record<HighlightKind, string> = {
  square: "Square",
  landscape: "Landscape",
  portrait: "Portrait",
};
const PROPORTIONS: Record<HighlightKind, string> = {
  square: "1:1",
  landscape: "3:2",
  portrait: "2:3",
};
const clamp = (n: number, max: number) => Math.max(0, Math.min(max, n));
const MIN_SIZE = 0.02;

/** "square", "landscape", "portrait" or "custom:<id>". */
type HighlightKey = HighlightKind | `custom:${string}`;
type Shape = HighlightKind | "free";
/** One size at a time: the photograph itself, each fixed shape, or free crops. */
type Tab = "original" | Shape;
type Handle = "nw" | "ne" | "sw" | "se" | "n" | "e" | "s" | "w";
type Gesture =
  | { mode: "move"; pointer: number; dx: number; dy: number }
  | { mode: "draw"; pointer: number; ax: number; ay: number }
  | { mode: "edge"; pointer: number; handle: "n" | "e" | "s" | "w" };

const TABS: Tab[] = ["original", ...KINDS, "free"];
const customKey = (id: string): HighlightKey => `custom:${id}`;
const isKind = (key: string): key is HighlightKind =>
  (KINDS as string[]).includes(key);

function customOf(value: PhotoHighlights, key: string | null) {
  return key?.startsWith("custom:")
    ? value.custom?.find((item) => customKey(item.id) === key)
    : undefined;
}
function cropOf(value: PhotoHighlights, key: string | null) {
  if (!key) return undefined;
  if (isKind(key)) return value[key];
  return customOf(value, key)?.crop;
}
/** The size tab a highlight belongs to. */
function shapeOf(value: PhotoHighlights, key: string): Shape {
  if (isKind(key)) return key;
  return customOf(value, key)?.shape ?? "free";
}
/** Every highlight of one size, the main one of a fixed shape first. */
function keysOf(value: PhotoHighlights, shape: Shape): HighlightKey[] {
  return [
    ...(shape !== "free" && value[shape] ? [shape] : []),
    ...(value.custom ?? [])
      .filter((item) => (item.shape ?? "free") === shape)
      .map((item) => customKey(item.id)),
  ];
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

function ShapeIcon({ shape }: { shape: Tab }) {
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
      ) : shape === "original" ? (
        <>
          <rect x="3" y="5" width="18" height="14" rx="1.5" />
          <path d="M3 16l5-5 4 4 3-3 6 6" />
        </>
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
  star: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z",
};

// The crop of a view laid over a box of its own proportion.
function cropStyle(crop: Highlight) {
  return {
    position: "absolute" as const,
    maxWidth: "none",
    width: `${100 / crop.width}%`,
    height: `${100 / crop.height}%`,
    left: `${(-100 * crop.x) / crop.width}%`,
    top: `${(-100 * crop.y) / crop.height}%`,
  };
}

export function HighlightEditor({
  src,
  width,
  height,
  value,
  onChange: commit,
  onActiveChange,
  activeKey,
  disabled = false,
  stageContainer,
}: {
  src: string;
  width: number;
  height: number;
  value: PhotoHighlights;
  onChange: (value: PhotoHighlights) => void;
  /** Told which highlight is selected, so a larger view elsewhere can follow it. */
  onActiveChange?: (key: string | null) => void;
  /** A highlight chosen elsewhere, followed here. Pass back what `onActiveChange`
   *  reports, with `null` (the whole photo) as "original". */
  activeKey?: string;
  disabled?: boolean;
  /** Places the drawing surface on a shared photo preview; controls stay here. */
  stageContainer?: HTMLElement | null;
}) {
  const onChange = (next: PhotoHighlights) => commit(cleanPresentation(next));
  const ratio = width / height;
  const existing: HighlightKey[] = [
    ...KINDS.filter((kind) => value[kind]),
    ...(value.custom ?? []).map((item) => customKey(item.id)),
  ];
  const [chosen, setChosen] = useState<string | null>(() =>
    activeKey === undefined ? (existing[0] ?? null) : activeKey,
  );
  const [tab, setTab] = useState<Tab>(() => {
    const start = activeKey === undefined ? (existing[0] ?? null) : activeKey;
    if (start === "original") return "original";
    return start && cropOf(value, start) ? shapeOf(value, start) : "square";
  });
  const active =
    tab !== "original" && chosen && cropOf(value, chosen) ? chosen : null;
  // What each highlight looked like when the editor opened or it was accepted.
  const [snapshots, setSnapshots] = useState<Record<string, Highlight>>(() =>
    Object.fromEntries(
      existing.map((key) => [key, cropOf(value, key)!] as const),
    ),
  );
  const [draft, setDraft] = useState<{
    shape: Shape;
    crop: Highlight | null;
  } | null>(null);
  // Follows a choice made outside, such as the chips over the Photos stage.
  const [followed, setFollowed] = useState(activeKey);
  if (activeKey !== followed) {
    setFollowed(activeKey);
    setDraft(null);
    if (activeKey === "original") {
      setChosen(null);
      setTab("original");
    } else if (activeKey && cropOf(value, activeKey)) {
      setChosen(activeKey);
      setTab(shapeOf(value, activeKey));
    }
  }
  const gesture = useRef<Gesture | null>(null);
  const custom = customOf(value, active);
  const crop = draft ? draft.crop : cropOf(value, active);
  const shape: Shape | null = draft
    ? draft.shape
    : active
      ? shapeOf(value, active)
      : null;
  const relative =
    shape && shape !== "free" ? HIGHLIGHT_RATIOS[shape] / ratio : null;
  const customCount = value.custom?.length ?? 0;

  function select(key: string | null) {
    setChosen(key);
    // What the parent will pass back is this editor's own choice, not a new one.
    if (activeKey !== undefined) setFollowed(key ?? "original");
    onActiveChange?.(key);
  }
  function openTab(next: Tab) {
    if (draft) {
      // While drawing, the sizes stay on offer: another one reshapes the drawing.
      if (next === "original" || next === draft.shape) return;
      setTab(next);
      setDraft({
        shape: next,
        crop:
          draft.crop && next !== "free"
            ? refitHighlight(draft.crop, next, ratio)
            : draft.crop,
      });
      return;
    }
    setTab(next);
    if (next === "original") {
      select(null);
      return;
    }
    const keys = keysOf(value, next);
    select(
      chosen && keys.includes(chosen as HighlightKey)
        ? chosen
        : (keys[0] ?? null),
    );
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
  // The name a new crop of `next` starts with: "Square 2", "Detail 3"…
  function nameFor(next: Shape) {
    const taken = new Set((value.custom ?? []).map((item) => item.name));
    const base = next === "free" ? "Detail" : NAMES[next];
    let n = next === "free" ? 1 : 2;
    while (taken.has(`${base} ${n}`)) n++;
    return `${base} ${n}`;
  }
  // Adds a crop of `next`: the main one of its shape if there is none yet, otherwise
  // a named one. A fixed shape joins Gallery's Grid and Random in its proportion.
  function add(next: Shape, area: Highlight) {
    let key: HighlightKey;
    let result: PhotoHighlights;
    if (next !== "free" && !value[next]) {
      key = next;
      result = { ...value, [next]: area };
    } else {
      const id = crypto.randomUUID();
      key = customKey(id);
      const item: CustomHighlight = { id, name: nameFor(next), crop: area };
      if (next !== "free") item.shape = next;
      result = { ...value, custom: [...(value.custom ?? []), item] };
    }
    if (next !== "free") result = offerInGalleryGrid(result, key, ratio);
    onChange(result);
    setSnapshots((previous) => ({ ...previous, [key]: { ...area } }));
    setTab(next);
    select(key);
  }
  function canAdd(next: Shape) {
    return (
      (next !== "free" && !value[next]) || customCount < MAX_CUSTOM_HIGHLIGHTS
    );
  }
  function accept() {
    if (!draft?.crop) return;
    add(draft.shape, draft.crop);
    setDraft(null);
  }
  // A named crop of a fixed shape becomes the main one, which thumbnails use; the
  // previous main one keeps its place as a named crop. Gallery and Home follow.
  function makeMain() {
    if (!custom?.shape) return;
    const kind = custom.shape;
    const key = customKey(custom.id);
    const previous = value[kind];
    let next: PhotoHighlights = {
      ...value,
      [kind]: custom.crop,
      custom: previous
        ? value.custom!.map((item) =>
            item.id === custom.id ? { ...item, crop: previous } : item,
          )
        : value.custom!.filter((item) => item.id !== custom.id),
    };
    if (!next.custom?.length) delete next.custom;
    next = swapViewReferences(next, kind, key);
    onChange(next);
    setSnapshots((all) => ({ ...all, [kind]: all[key], [key]: all[kind] }));
    select(kind);
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
    const left = keysOf(next, tab as Shape);
    select(left[0] ?? null);
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
  const views = photoViews(value, ratio);
  const enabled = (target: "gallery" | "home", id: string) =>
    (value.presentation?.[target] ?? ["original"]).includes(id);
  const strip =
    tab === "original"
      ? []
      : keysOf(value, tab).map((key) => {
          const item = customOf(value, key);
          const c = cropOf(value, key)!;
          return {
            key,
            main: !item,
            label: item ? item.name : `${NAMES[key as HighlightKind]} (main)`,
            alt: `${item ? item.name : key} thumbnail preview`,
            crop: c,
            aspect: (c.width * width) / (c.height * height),
          };
        });
  const view =
    tab === "original"
      ? views[0]
      : active && !draft
        ? views.find((item) => item.id === active)
        : undefined;
  const label = (next: Tab) =>
    next === "original"
      ? "Original"
      : next === "free"
        ? "Free"
        : `${NAMES[next]} · ${PROPORTIONS[next]}`;
  const stage = (
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
              ? `New ${label(draft.shape).toLowerCase()}`
              : (custom?.name ?? NAMES[active as HighlightKind])}
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
  );
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
        <div className="highlight-sizes" role="tablist" aria-label="Sizes">
          {TABS.map((option) => {
            const count =
              option === "original" ? null : keysOf(value, option).length;
            const selected = draft ? draft.shape === option : tab === option;
            return (
              <button
                type="button"
                role="tab"
                key={option}
                aria-selected={selected}
                aria-label={`${label(option)} highlights`}
                title={
                  draft && option !== "original"
                    ? `Draw it as ${label(option)}`
                    : label(option)
                }
                disabled={!!draft && option === "original"}
                onClick={() => openTab(option)}
              >
                <ShapeIcon shape={option} />
                <span>{label(option)}</span>
                {count ? (
                  <b className="highlight-sizes__count">{count}</b>
                ) : null}
              </button>
            );
          })}
        </div>
        {tab !== "original" && (
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
                    style={
                      {
                        aspectRatio: item.aspect,
                        "--thumb-ratio": item.aspect,
                      } as React.CSSProperties
                    }
                  >
                    <Image
                      src={src}
                      alt={item.alt}
                      unoptimized
                      width={width}
                      height={height}
                      style={cropStyle(item.crop)}
                    />
                  </span>
                  <span className="highlight-thumb__label">
                    {item.main ? (
                      <>
                        <Icon path={ICONS.star} />
                        Main
                      </>
                    ) : (
                      item.label
                    )}
                  </span>
                  <span className="highlight-thumb__uses" aria-hidden="true">
                    {enabled("gallery", item.key) && <i>Gallery</i>}
                    {enabled("home", item.key) && <i>Home</i>}
                  </span>
                </button>
              ))}
              {strip.length === 0 && !draft && (
                <p className="upload-muted highlight-strip__empty">
                  No {tab === "free" ? "free" : NAMES[tab].toLowerCase()}{" "}
                  highlights yet. Press + and draw one on the photo.
                </p>
              )}
            </div>
            <button
              type="button"
              className="highlight-add"
              aria-label={`New ${tab === "free" ? "free" : tab} highlight`}
              title={`New ${label(tab).toLowerCase()} highlight`}
              aria-pressed={!!draft}
              disabled={!!draft || !canAdd(tab)}
              onClick={() => setDraft({ shape: tab, crop: null })}
            >
              <Icon path={ICONS.plus} />
            </button>
          </div>
        )}
        {stageContainer ? createPortal(stage, stageContainer) : stage}
        {draft ? (
          <div className="highlight-confirm">
            <span>
              {draft.crop
                ? "Move it or pull a corner, then accept. Another size above reshapes it."
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
              onClick={() => {
                setDraft(null);
                // Back to what was chosen in this size, if it is still here.
                if (
                  !chosen ||
                  !keysOf(value, tab as Shape).includes(chosen as HighlightKey)
                )
                  select(keysOf(value, tab as Shape)[0] ?? null);
              }}
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
              {custom?.shape && (
                <button
                  type="button"
                  aria-label="Make main highlight"
                  title={`Make it the main ${custom.shape}, the one thumbnails use`}
                  onClick={makeMain}
                >
                  <Icon path={ICONS.star} />
                </button>
              )}
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
                aria-label="Duplicate highlight"
                title="Duplicate"
                disabled={customCount >= MAX_CUSTOM_HIGHLIGHTS}
                onClick={() => add(shape!, { ...crop })}
              >
                <Icon path={ICONS.duplicate} />
              </button>
              <button
                type="button"
                className="highlight-tools__remove"
                aria-label={`Remove ${custom ? custom.name : active} highlight`}
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
            {shape === "free" && (
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
                    const resized =
                      shape === "free"
                        ? {
                            width:
                              ((crop.width /
                                Math.max(crop.width, crop.height)) *
                                Number(event.target.value)) /
                              100,
                            height:
                              ((crop.height /
                                Math.max(crop.width, crop.height)) *
                                Number(event.target.value)) /
                              100,
                          }
                        : centeredHighlight(
                            shape as HighlightKind,
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
        {view && (
          <section
            className="highlight-eligibility"
            aria-label="Random presentation choices"
          >
            <h3>Where can {view.name} appear?</h3>
            <p>
              Gallery and Home choose at random among the views enabled here.
              Turn off every view of a page to leave this photo out of it. Save
              the photo to apply.
            </p>
            <article className="highlight-eligibility__view">
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
                      ? cropStyle(view.crop)
                      : {
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                        }
                  }
                />
              </div>
              <div className="highlight-eligibility__choices">
                {(["gallery", "home"] as const).map((target) => (
                  <label key={target}>
                    <input
                      type="checkbox"
                      aria-label={`${view.name} in ${target === "gallery" ? "Gallery" : "Home"}`}
                      checked={enabled(target, view.id)}
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
              </div>
            </article>
            <details className="highlight-distribution-matrix">
              <summary>Gallery layouts and proportions</summary>
              <p>
                This view is {viewAspect(view.ratio)}. Add a highlight of
                another size to offer another proportion.
              </p>
              <table>
                <caption>Eligible view aspects for {view.name}</caption>
                <thead>
                  <tr>
                    <th>Layout</th>
                    {["Portrait", "Square", "Landscape"].map((name) => (
                      <th key={name}>{name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["random", "Random"],
                      ["uniform", "Grid"],
                      ["justified", "Original"],
                    ] as const
                  ).map(([layout, name]) => (
                    <tr key={layout}>
                      <th>{name}</th>
                      {["portrait", "square", "landscape"].map((aspect) => (
                        <td key={aspect}>
                          <input
                            type="checkbox"
                            aria-label={`${view.name} in ${name} ${aspect}`}
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
          </section>
        )}
      </fieldset>
    </>
  );
}
