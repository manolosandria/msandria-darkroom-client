"use client";

import Image from "next/image";
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

export function HighlightEditor({
  src,
  width,
  height,
  value,
  onChange,
  disabled = false,
}: {
  src: string;
  width: number;
  height: number;
  value: PhotoHighlights;
  onChange: (value: PhotoHighlights) => void;
  disabled?: boolean;
}) {
  const [kind, setKind] = useState<HighlightKind>("square");
  const [customId, setCustomId] = useState<string | null>(null);
  const custom = value.custom?.find((item) => item.id === customId);
  const drag = useRef<{ pointer: number; dx: number; dy: number } | null>(null);
  const crop = custom?.crop ?? value[kind];
  const label = custom?.name ?? LABELS[kind];
  const ratio = width / height;
  const update = (patch: Partial<NonNullable<typeof crop>>) => {
    if (!crop) return;
    const next = { ...crop, ...patch };
    if (custom)
      onChange({
        ...value,
        custom: value.custom!.map((item) =>
          item.id === custom.id ? { ...item, crop: next } : item,
        ),
      });
    else onChange({ ...value, [kind]: next });
  };

  function addCustom(source?: Highlight) {
    const items = value.custom ?? [];
    if (items.length >= MAX_CUSTOM_HIGHLIGHTS) return;
    const id = crypto.randomUUID();
    onChange({
      ...value,
      custom: [
        ...items,
        {
          id,
          name: `Detail ${items.length + 1}`,
          crop: source
            ? { ...source }
            : { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
        },
      ],
    });
    setCustomId(id);
  }
  const previews = [
    ...KINDS.flatMap((key) =>
      value[key]
        ? [
            {
              id: key,
              label: LABELS[key],
              alt: `${key} thumbnail preview`,
              crop: value[key]!,
              aspect: HIGHLIGHT_RATIOS[key],
            },
          ]
        : [],
    ),
    ...(value.custom ?? []).map((item) => ({
      id: item.id,
      label: item.name,
      alt: `${item.name} thumbnail preview`,
      crop: item.crop,
      aspect: (item.crop.width * width) / (item.crop.height * height),
    })),
  ];
  return (
    <fieldset className="highlight-editor" disabled={disabled}>
      <legend>
        Highlights{" "}
        <span className="upload-muted">/ optional thumbnail crops</span>
      </legend>
      <div className="highlight-tabs" aria-label="Highlight shape">
        {KINDS.map((key) => (
          <button
            type="button"
            key={key}
            aria-pressed={!custom && kind === key}
            onClick={() => {
              setKind(key);
              setCustomId(null);
              drag.current = null;
            }}
          >
            {LABELS[key]}
            {value[key] ? " ✓" : ""}
          </button>
        ))}
      </div>
      <div className="highlight-tabs" aria-label="Custom highlights">
        {(value.custom ?? []).map((item) => (
          <button
            type="button"
            key={item.id}
            aria-pressed={custom?.id === item.id}
            onClick={() => {
              setCustomId(item.id);
              drag.current = null;
            }}
          >
            {item.name}
          </button>
        ))}
        <button
          type="button"
          disabled={(value.custom?.length ?? 0) >= MAX_CUSTOM_HIGHLIGHTS}
          onClick={() => addCustom()}
        >
          Add custom highlight
        </button>
      </div>
      <p className="upload-muted">
        Keep the three main thumbnail shapes, plus up to {MAX_CUSTOM_HIGHLIGHTS}{" "}
        named details with independent dimensions.
      </p>
      {custom && (
        <label>
          Highlight name
          <input
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
      <div
        className="highlight-stage"
        style={{ aspectRatio: ratio, width: `min(100%, ${420 * ratio}px)` }}
        onPointerDown={(event) => {
          if (!crop || disabled) return;
          event.preventDefault();
          const bounds = event.currentTarget.getBoundingClientRect();
          const x = (event.clientX - bounds.left) / bounds.width;
          const y = (event.clientY - bounds.top) / bounds.height;
          const inside =
            x >= crop.x &&
            x <= crop.x + crop.width &&
            y >= crop.y &&
            y <= crop.y + crop.height;
          drag.current = {
            pointer: event.pointerId,
            dx: inside ? x - crop.x : crop.width / 2,
            dy: inside ? y - crop.y : crop.height / 2,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          update({
            x: clamp(x - drag.current.dx, 1 - crop.width),
            y: clamp(y - drag.current.dy, 1 - crop.height),
          });
        }}
        onPointerMove={(event) => {
          if (
            !drag.current ||
            drag.current.pointer !== event.pointerId ||
            !crop ||
            disabled
          )
            return;
          const bounds = event.currentTarget.getBoundingClientRect();
          update({
            x: clamp(
              (event.clientX - bounds.left) / bounds.width - drag.current.dx,
              1 - crop.width,
            ),
            y: clamp(
              (event.clientY - bounds.top) / bounds.height - drag.current.dy,
              1 - crop.height,
            ),
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
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
        {crop && (
          <div
            className="highlight-selection"
            style={{
              left: `${crop.x * 100}%`,
              top: `${crop.y * 100}%`,
              width: `${crop.width * 100}%`,
              height: `${crop.height * 100}%`,
            }}
          >
            <span>{label}</span>
          </div>
        )}
      </div>
      {crop ? (
        <>
          <p className="upload-muted">
            Drag the frame to place it. Use the sliders for size and precise
            positioning.
          </p>
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
                      update({
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
                        x: 0,
                        y: 0,
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
                        kind,
                        ratio,
                        Number(event.target.value) / 100,
                      );
                  update({
                    ...resized,
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
                  update({
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
                  update({
                    y: (Number(event.target.value) / 1000) * (1 - crop.height),
                  })
                }
              />
            </label>
          </div>
          <button
            type="button"
            className="upload-link"
            onClick={() => {
              const next = { ...value };
              if (custom) {
                const remaining = (value.custom ?? []).filter(
                  (item) => item.id !== custom.id,
                );
                if (remaining.length) next.custom = remaining;
                else delete next.custom;
                setCustomId(null);
              } else delete next[kind];
              onChange(next);
            }}
          >
            Remove {custom ? "custom" : kind} highlight
          </button>
          <button
            type="button"
            className="upload-link"
            disabled={(value.custom?.length ?? 0) >= MAX_CUSTOM_HIGHLIGHTS}
            onClick={() => addCustom(crop)}
          >
            Duplicate as custom highlight
          </button>
          <p className="upload-muted">
            {Math.round(crop.width * width)} ×{" "}
            {Math.round(crop.height * height)} px in this image. The selection
            scales with the stored photo.
          </p>
        </>
      ) : (
        <button
          type="button"
          className="upload-secondary"
          onClick={() =>
            onChange({ ...value, [kind]: centeredHighlight(kind, ratio) })
          }
        >
          Add {kind} highlight
        </button>
      )}
      <div className="highlight-previews">
        {previews.map((preview) => {
          const c = preview.crop;
          return (
            <figure key={preview.id}>
              <div
                style={{
                  aspectRatio: preview.aspect,
                  width: `min(100%, ${140 * preview.aspect}px)`,
                }}
              >
                <Image
                  src={src}
                  alt={preview.alt}
                  unoptimized
                  width={width}
                  height={height}
                  style={{
                    position: "absolute",
                    maxWidth: "none",
                    width: `${100 / c.width}%`,
                    height: `${100 / c.height}%`,
                    left: `${(-c.x / c.width) * 100}%`,
                    top: `${(-c.y / c.height) * 100}%`,
                  }}
                />
              </div>
              <figcaption>{preview.label}</figcaption>
            </figure>
          );
        })}
      </div>
    </fieldset>
  );
}
