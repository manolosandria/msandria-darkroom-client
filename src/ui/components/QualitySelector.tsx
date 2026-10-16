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

// How many blocks a side each icon has: the same little scene, sharper at each level.
const ICON_GRID: Record<PhotoQuality, number> = {
  saver: 3,
  standard: 6,
  max: 12,
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
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors ${level === quality ? "bg-white text-black" : "hover:bg-white/20"}`}
        >
          <PixelIcon blocks={ICON_GRID[level]} />
          {LABELS[level]}
        </button>
      ))}
    </div>
  );
}

// A sun over a hill, averaged over each block the way a downscaled photo is: coarse
// blocks for the data saver, finer ones as the quality rises.
const SAMPLES = 6;

function scene(x: number, y: number): number {
  if (Math.hypot(x - 8, y - 3.8) < 2.4) return 1;
  if (y > 8.6 - 2.4 * Math.cos((x - 3.5) / 3.2)) return 0.95;
  return 0.12 + (y / 12) * 0.35;
}

function PixelIcon({ blocks }: { blocks: number }) {
  const size = 12 / blocks;
  const cells = [];
  for (let row = 0; row < blocks; row++) {
    for (let column = 0; column < blocks; column++) {
      let total = 0;
      for (let i = 0; i < SAMPLES; i++)
        for (let j = 0; j < SAMPLES; j++)
          total += scene((column + (i + 0.5) / SAMPLES) * size, (row + (j + 0.5) / SAMPLES) * size);
      const shade = Math.round((total / SAMPLES ** 2) * 20) / 20;
      cells.push(
        <rect
          key={`${row}-${column}`}
          x={column * size}
          y={row * size}
          width={size}
          height={size}
          fill="currentColor"
          fillOpacity={shade}
        />,
      );
    }
  }
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      data-blocks={blocks}
      className="h-3.5 w-3.5 shrink-0 rounded-[2px]"
      shapeRendering="crispEdges"
    >
      {cells}
    </svg>
  );
}
