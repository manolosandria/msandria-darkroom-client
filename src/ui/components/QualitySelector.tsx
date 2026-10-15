"use client";
import {
  PHOTO_QUALITIES,
  PhotoQuality,
} from "@/src/domain/entities/PhotoQuality";

const LABELS: Record<PhotoQuality, string> = {
  saver: "Data saver",
  standard: "Standard",
  max: "Maximum",
};

interface QualitySelectorProps {
  quality: PhotoQuality;
  onChange: (quality: PhotoQuality) => void;
}

// Pinned to a corner of the photo's area so it stays within reach between photos.
export function QualitySelector({ quality, onChange }: QualitySelectorProps) {
  return (
    <div
      role="group"
      aria-label="Image quality"
      className="absolute bottom-4 right-4 z-20 flex gap-1 rounded-full bg-black/70 p-1 text-sm text-white backdrop-blur"
    >
      {PHOTO_QUALITIES.map((level) => (
        <button
          key={level}
          type="button"
          aria-pressed={level === quality}
          onClick={() => onChange(level)}
          className={`rounded-full px-3 py-1 ${level === quality ? "bg-white text-black" : "hover:bg-white/20"}`}
        >
          {LABELS[level]}
        </button>
      ))}
    </div>
  );
}
