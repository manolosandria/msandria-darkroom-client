"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  BorderInsets,
  BorderTrim,
  MIN_TRIM_FRACTION,
  insetsToTrim,
  trimToInsets,
} from "@/src/domain/borderTrim";
import { findBorder } from "@/src/ui/borderTrimImage";
import "./borderTrimFields.css";

type Side = keyof BorderInsets;

const SIDES: { side: Side; label: string }[] = [
  { side: "top", label: "Top" },
  { side: "right", label: "Right" },
  { side: "bottom", label: "Bottom" },
  { side: "left", label: "Left" },
];

const NO_TRIM: BorderTrim = { x: 0, y: 0, width: 1, height: 1 };

/**
 * Removes a border that came baked into the file. Switching it on looks for a border of
 * one colour on each side; each side can then be set by hand, in pixels of the original,
 * or by dragging the edges of the kept area. `null` keeps the file whole. The API cuts
 * the file itself; nothing here changes what is sent but the numbers.
 */
export function BorderTrimFields({
  src,
  width,
  height,
  value,
  onChange,
  disabled = false,
}: {
  /** The original local image, before any trim. */
  src: string;
  width: number;
  height: number;
  value: BorderTrim | null;
  onChange: (trim: BorderTrim | null) => void;
  disabled?: boolean;
}) {
  const [note, setNote] = useState("");
  const [detecting, setDetecting] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const insets = value ? trimToInsets(value, width, height) : null;

  const detect = async () => {
    setDetecting(true);
    setNote("Looking for a border…");
    try {
      const found = await findBorder(src);
      onChange(found ?? NO_TRIM);
      if (!found) {
        setNote("No border of one colour was found. Set the sides by hand.");
      } else {
        const sides = trimToInsets(found, width, height);
        setNote(
          `Border found: ${SIDES.map(({ side, label }) => `${label.toLowerCase()} ${sides[side]} px`).join(", ")}. Adjust it if needed.`,
        );
      }
    } catch {
      onChange(NO_TRIM);
      setNote("The image could not be read here. Set the sides by hand.");
    } finally {
      setDetecting(false);
    }
  };

  // A side never grows past what keeps the API's minimum of the photo.
  const setSide = (side: Side, pixels: number) => {
    if (!insets) return;
    const along = side === "top" || side === "bottom" ? height : width;
    const opposite = { top: "bottom", bottom: "top", left: "right", right: "left" }[
      side
    ] as Side;
    const ceiling = Math.floor(along * (1 - MIN_TRIM_FRACTION)) - insets[opposite];
    const next = {
      ...insets,
      [side]: Math.max(0, Math.min(Math.round(pixels) || 0, ceiling)),
    };
    const trim = insetsToTrim(next, width, height);
    if (trim) onChange(trim);
  };

  const drag = (side: Side) => (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (disabled || !stage.current) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture?.(event.pointerId);
    const bounds = stage.current.getBoundingClientRect();
    const move = (moveEvent: PointerEvent) => {
      const fraction =
        side === "top"
          ? (moveEvent.clientY - bounds.top) / bounds.height
          : side === "bottom"
            ? (bounds.bottom - moveEvent.clientY) / bounds.height
            : side === "left"
              ? (moveEvent.clientX - bounds.left) / bounds.width
              : (bounds.right - moveEvent.clientX) / bounds.width;
      setSide(side, fraction * (side === "top" || side === "bottom" ? height : width));
    };
    const stop = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  };

  const kept = value ?? NO_TRIM;
  const percent = (fraction: number) => `${(fraction * 100).toFixed(3)}%`;

  return (
    <fieldset className="border-trim" disabled={disabled}>
      <legend>Border in the file</legend>
      <label className="border-trim__toggle">
        <input
          type="checkbox"
          checked={value !== null}
          disabled={detecting}
          onChange={(event) => {
            if (event.target.checked) void detect();
            else {
              setNote("");
              onChange(null);
            }
          }}
        />
        Remove border
      </label>
      {value && insets && (
        <>
          <div
            className="border-trim__stage"
            ref={stage}
            style={{ aspectRatio: `${width} / ${height}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- A local object URL of the file being uploaded. */}
            <img src={src} alt="" />
            <div
              className="border-trim__kept"
              data-testid="border-trim-kept"
              style={{
                left: percent(kept.x),
                top: percent(kept.y),
                width: percent(kept.width),
                height: percent(kept.height),
              }}
            >
              {SIDES.map(({ side, label }) => (
                <span
                  key={side}
                  className={`border-trim__handle border-trim__handle--${side}`}
                  aria-hidden="true"
                  title={`Drag the ${label.toLowerCase()} edge`}
                  onPointerDown={drag(side)}
                />
              ))}
            </div>
          </div>
          <div className="border-trim__sides">
            {SIDES.map(({ side, label }) => (
              <label key={side}>
                {label}
                <span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={insets[side]}
                    aria-label={`${label} border in pixels`}
                    onChange={(event) => setSide(side, Number(event.target.value))}
                  />
                  px
                </span>
              </label>
            ))}
          </div>
          <div className="border-trim__footer">
            <span>
              Keeps {Math.round(kept.width * width)} ×{" "}
              {Math.round(kept.height * height)} px of {width} × {height}.
            </span>
            <button type="button" onClick={() => void detect()} disabled={detecting}>
              Detect again
            </button>
          </div>
        </>
      )}
      <p className="border-trim__note" role="status">
        {note}
      </p>
    </fieldset>
  );
}

/**
 * The same control for a file that has no preview of its own yet, such as a replacement
 * chosen in Photos: it reads the file locally to measure it before offering the trim.
 */
export function FileBorderTrim({
  file,
  value,
  onChange,
  disabled = false,
}: {
  file: File;
  value: BorderTrim | null;
  onChange: (trim: BorderTrim | null) => void;
  disabled?: boolean;
}) {
  const [src] = useState(() => URL.createObjectURL(file));
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => () => URL.revokeObjectURL(src), [src]);
  if (!size)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Measures a local object URL; never shown.
      <img
        src={src}
        alt=""
        hidden
        onLoad={(event) =>
          setSize({
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
          })
        }
      />
    );
  return (
    <BorderTrimFields
      src={src}
      width={size.width}
      height={size.height}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
