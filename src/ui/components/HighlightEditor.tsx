"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import {
  centeredHighlight,
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
  const drag = useRef<{ pointer: number; dx: number; dy: number } | null>(null);
  const crop = value[kind];
  const ratio = width / height;
  const update = (patch: Partial<NonNullable<typeof crop>>) => {
    if (crop) onChange({ ...value, [kind]: { ...crop, ...patch } });
  };

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
            aria-pressed={kind === key}
            onClick={() => setKind(key)}
          >
            {LABELS[key]}
            {value[key] ? " ✓" : ""}
          </button>
        ))}
      </div>
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
            <span>{LABELS[kind]}</span>
          </div>
        )}
      </div>
      {crop ? (
        <>
          <p className="upload-muted">
            Drag the frame to place it. Use the sliders for size and precise
            positioning.
          </p>
          <div className="highlight-controls">
            <label>
              Crop size
              <input
                type="range"
                min="10"
                max="100"
                value={Math.round(Math.max(crop.width, crop.height) * 100)}
                onChange={(event) => {
                  const resized = centeredHighlight(
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
              delete next[kind];
              onChange(next);
            }}
          >
            Remove {kind} highlight
          </button>
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
        {KINDS.filter((key) => value[key]).map((key) => {
          const c = value[key]!;
          return (
            <figure key={key}>
              <div
                style={{ aspectRatio: HIGHLIGHT_RATIOS[key] }}
              >
                <Image
                  src={src}
                  alt={`${key} thumbnail preview`}
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
              <figcaption>{LABELS[key]}</figcaption>
            </figure>
          );
        })}
      </div>
    </fieldset>
  );
}
