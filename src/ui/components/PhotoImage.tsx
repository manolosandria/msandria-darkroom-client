"use client";

import { Highlight } from "@/src/domain/entities/PhotoHighlights";
import { Photo } from "@/src/domain/entities/Photo";
import { useImageFallback } from "@/src/ui/hooks/useImageFallback";

interface PhotoImageProps {
  photo: Photo;
  fallbackSizes: string;
  className?: string;
  /** Widest rendition offered, for thumbnails that must never pull a large file. */
  maxWidth?: number;
  crop?: Highlight;
}

// The image host already optimizes these files. Native srcset keeps every descriptor
// equal to its actual rendition width, including nonstandard source dimensions.
// If the image fails to load, the whole srcset switches once to the other host.
export function PhotoImage({
  photo,
  fallbackSizes,
  className = "",
  maxWidth,
  crop,
}: PhotoImageProps) {
  const { useFallback, onError } = useImageFallback(photo);
  const all = photo.getRenditions(useFallback);
  const capped = maxWidth ? all.filter(({ width }) => width <= maxWidth) : all;
  // A cap below the smallest rendition still needs one candidate.
  const renditions = capped.length ? capped : all.slice(0, 1);
  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- Use API rendition URLs and widths verbatim, without the Next image loader.
    <img
      src={renditions[0].url}
      srcSet={renditions.map(({ url, width }) => `${url} ${width}w`).join(", ")}
      sizes={`auto, ${fallbackSizes}`}
      alt={photo.getTitle()}
      width={photo.getWidth()}
      height={photo.getHeight()}
      loading="lazy"
      decoding="async"
      onError={onError}
      style={
        crop
          ? {
              objectFit: "fill",
              position: "absolute",
              maxWidth: "none",
              width: `${100 / crop.width}%`,
              height: `${100 / crop.height}%`,
              left: `${(-100 * crop.x) / crop.width}%`,
              top: `${(-100 * crop.y) / crop.height}%`,
            }
          : undefined
      }
      className={`absolute inset-0 h-full w-full ${className}`}
    />
  );
  if (!crop) return image;
  const ratio = (photo.getAspectRatio() * crop.width) / crop.height;
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ containerType: "size" }}
    >
      <div
        style={{
          position: "absolute",
          width: `max(100cqw, ${ratio * 100}cqh)`,
          height: `max(100cqh, ${100 / ratio}cqw)`,
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        {image}
      </div>
    </div>
  );
}
