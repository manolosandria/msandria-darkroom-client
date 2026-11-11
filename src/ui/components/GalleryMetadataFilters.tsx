"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  MetadataRange,
  MetadataRangeKey,
  METADATA_RANGE_KEYS,
  PhotoFacets,
  PhotoMetadataFilters,
  PhotoTone,
  rangeStops,
} from "@/src/domain/entities/PhotoMetadataFilters";
import { formatCamera, formatExposure } from "@/src/ui/photoDetails";

// Up to one decimal, without a trailing ".0": 2.8, 50, 4.5.
const short = (value: number) => String(Math.round(value * 10) / 10);

export const METADATA_RANGE_LABELS: Record<MetadataRangeKey, string> = {
  focalLength: "Focal length",
  exposureTime: "Shutter speed",
  aperture: "Aperture",
  iso: "ISO",
};

const FORMATS: Record<MetadataRangeKey, (value: number) => string> = {
  focalLength: (value) => `${short(value)} mm`,
  exposureTime: formatExposure,
  aperture: (value) => `f/${short(value)}`,
  iso: (value) => `ISO ${Math.round(value)}`,
};

export const TONE_LABELS: Record<PhotoTone, string> = {
  color: "Color",
  monochrome: "Black & white",
};

/** A camera's name from its `make|model` value, as the viewer writes it. */
export function cameraName(value: string) {
  const [make, ...model] = value.split("|");
  return formatCamera(make || null, model.join("|") || null) || value;
}

export function formatRange(key: MetadataRangeKey, range: MetadataRange) {
  const format = FORMATS[key];
  if (range.min !== undefined && range.max !== undefined)
    return range.min === range.max
      ? format(range.min)
      : `${format(range.min)} – ${format(range.max)}`;
  if (range.min !== undefined) return `≥ ${format(range.min)}`;
  if (range.max !== undefined) return `≤ ${format(range.max)}`;
  return "Any";
}

export type MetadataChip = {
  key: string;
  department: string;
  label: string;
  /** The filters without this choice. */
  without: PhotoMetadataFilters;
};

/** Every metadata choice as a removable chip, in the panel's order. */
export function metadataChips(filters: PhotoMetadataFilters): MetadataChip[] {
  const chips: MetadataChip[] = [];
  if (filters.tone)
    chips.push({
      key: "tone",
      department: "Tone",
      label: TONE_LABELS[filters.tone],
      without: { ...filters, tone: undefined },
    });
  for (const camera of filters.cameras)
    chips.push({
      key: `camera:${camera}`,
      department: "Camera",
      label: cameraName(camera),
      without: {
        ...filters,
        cameras: filters.cameras.filter((item) => item !== camera),
      },
    });
  for (const lens of filters.lenses)
    chips.push({
      key: `lens:${lens}`,
      department: "Lens",
      label: lens,
      without: {
        ...filters,
        lenses: filters.lenses.filter((item) => item !== lens),
      },
    });
  for (const key of METADATA_RANGE_KEYS)
    if (filters[key].min !== undefined || filters[key].max !== undefined)
      chips.push({
        key,
        department: METADATA_RANGE_LABELS[key],
        label: formatRange(key, filters[key]),
        without: { ...filters, [key]: {} },
      });
  return chips;
}

/** Whether the facets offer anything to choose at all. */
export function hasMetadataFacets(facets: PhotoFacets | null) {
  return Boolean(
    facets &&
      (facets.cameras.length ||
        facets.lenses.length ||
        facets.tonality.color + facets.tonality.monochrome > 0 ||
        METADATA_RANGE_KEYS.some((key) => {
          const range = facets[key];
          return range && range.max > range.min;
        })),
  );
}

/**
 * Gallery's department of how photographs were taken: colour or black and white, the
 * cameras and lenses found among the public photographs, and a range for focal length,
 * shutter speed, aperture and ISO. Choices made here travel with the categories; a
 * photograph without the data a choice asks about is left out only while it applies.
 */
export function GalleryMetadataFilters({
  facets,
  value,
  onChange,
}: {
  facets: PhotoFacets;
  value: PhotoMetadataFilters;
  onChange: (filters: PhotoMetadataFilters) => void;
}) {
  const id = useId();
  const chosen = metadataChips(value).length;
  const toggle = (list: "cameras" | "lenses", item: string) =>
    onChange({
      ...value,
      [list]: value[list].includes(item)
        ? value[list].filter((entry) => entry !== item)
        : [...value[list], item],
    });
  const tones = facets.tonality.color + facets.tonality.monochrome > 0;
  const ranges = METADATA_RANGE_KEYS.flatMap((key) => {
    const range = facets[key];
    return range && range.max > range.min ? [{ key, range }] : [];
  });
  return (
    <div
      className="gallery-browse__column gallery-metadata"
      data-department="metadata"
      data-current={chosen > 0 || undefined}
      role="group"
      aria-label="Camera and exposure"
    >
      <p className="gallery-browse__heading">
        Camera &amp; exposure
        {chosen > 0 && <small>{chosen} chosen</small>}
      </p>
      {tones && (
        <div
          className="gallery-metadata__section"
          role="radiogroup"
          aria-labelledby={`${id}-tone`}
        >
          <p id={`${id}-tone`} className="gallery-metadata__label">
            Tone
          </p>
          <div className="gallery-metadata__tones">
            {([undefined, "color", "monochrome"] as const).map((tone) => (
              <button
                key={tone ?? "any"}
                type="button"
                role="radio"
                aria-checked={value.tone === tone}
                className="gallery-metadata__tone"
                onClick={() => onChange({ ...value, tone })}
              >
                {tone ? TONE_LABELS[tone] : "Any"}
              </button>
            ))}
          </div>
        </div>
      )}
      {(
        [
          ["cameras", "Camera", facets.cameras.map((item) => item.value)],
          ["lenses", "Lens", facets.lenses.map((item) => item.value)],
        ] as const
      ).map(
        ([list, label, options]) =>
          options.length > 0 && (
            <div
              key={list}
              className="gallery-metadata__section"
              role="group"
              aria-label={label}
            >
              <p className="gallery-metadata__label" aria-hidden="true">
                {label}
              </p>
              <ul>
                {options.map((option) => (
                  <li key={option}>
                    <button
                      type="button"
                      className="gallery-browse__option"
                      aria-pressed={value[list].includes(option)}
                      onClick={() => toggle(list, option)}
                    >
                      <span
                        className="gallery-browse__check"
                        aria-hidden="true"
                      />
                      {list === "cameras" ? cameraName(option) : option}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ),
      )}
      {ranges.map(({ key, range }) => (
        <RangeFilter
          key={key}
          label={METADATA_RANGE_LABELS[key]}
          rangeKey={key}
          stops={rangeStops(key, range)}
          value={value[key]}
          onChange={(next) => onChange({ ...value, [key]: next })}
        />
      ))}
    </div>
  );
}

// The stop nearest a value, so a range from the URL lands on the slider.
function nearest(stops: number[], target: number) {
  let best = 0;
  stops.forEach((stop, index) => {
    if (Math.abs(stop - target) < Math.abs(stops[best] - target)) best = index;
  });
  return best;
}

/**
 * A range as two sliders over the usual stops. Either end at its limit leaves that
 * end open, so a full range is no filter and keeps photographs without the data. The
 * choice is committed a moment after the sliders stop, not on every step.
 */
function RangeFilter({
  label,
  rangeKey,
  stops,
  value,
  onChange,
}: {
  label: string;
  rangeKey: MetadataRangeKey;
  stops: number[];
  value: MetadataRange;
  onChange: (range: MetadataRange) => void;
}) {
  const id = useId();
  const last = stops.length - 1;
  const fromValue = (range: MetadataRange) => ({
    low: range.min === undefined ? 0 : nearest(stops, range.min),
    high: range.max === undefined ? last : nearest(stops, range.max),
  });
  const [draft, setDraft] = useState(() => fromValue(value));
  const pending = useRef(false);
  // A change from outside (the reset, a chip) moves the sliders back.
  const outside = `${value.min}|${value.max}`;
  const [seen, setSeen] = useState(outside);
  if (outside !== seen) {
    setSeen(outside);
    setDraft(fromValue(value));
  }
  const changeRef = useRef(onChange);
  useEffect(() => {
    changeRef.current = onChange;
  });
  useEffect(() => {
    if (!pending.current) return;
    const timer = setTimeout(() => {
      pending.current = false;
      changeRef.current({
        ...(draft.low > 0 ? { min: stops[draft.low] } : {}),
        ...(draft.high < last ? { max: stops[draft.high] } : {}),
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [draft, stops, last]);
  const move = (end: "low" | "high", index: number) => {
    pending.current = true;
    setDraft((previous) =>
      end === "low"
        ? { low: Math.min(index, previous.high), high: previous.high }
        : { low: previous.low, high: Math.max(index, previous.low) },
    );
  };
  const shown = formatRange(rangeKey, {
    ...(draft.low > 0 ? { min: stops[draft.low] } : {}),
    ...(draft.high < last ? { max: stops[draft.high] } : {}),
  });
  const format = FORMATS[rangeKey];
  return (
    <div
      className="gallery-metadata__section gallery-metadata__range"
      role="group"
      aria-labelledby={`${id}-label`}
    >
      <p className="gallery-metadata__label">
        <span id={`${id}-label`}>{label}</span>
        <output aria-live="polite">{shown}</output>
      </p>
      <label>
        <span>From</span>
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={draft.low}
          aria-valuetext={format(stops[draft.low])}
          onChange={(event) => move("low", Number(event.target.value))}
        />
      </label>
      <label>
        <span>To</span>
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={draft.high}
          aria-valuetext={format(stops[draft.high])}
          onChange={(event) => move("high", Number(event.target.value))}
        />
      </label>
    </div>
  );
}
