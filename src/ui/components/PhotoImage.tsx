import { Photo } from "@/src/domain/entities/Photo";

interface PhotoImageProps {
  photo: Photo;
  fallbackSizes: string;
  className?: string;
  /** Widest rendition offered, for thumbnails that must never pull a large file. */
  maxWidth?: number;
}

// Cloudinary already optimizes these files. Native srcset keeps every descriptor
// equal to its actual rendition width, including nonstandard source dimensions.
export function PhotoImage({ photo, fallbackSizes, className = "", maxWidth }: PhotoImageProps) {
  const all = photo.getRenditions();
  const capped = maxWidth ? all.filter(({ width }) => width <= maxWidth) : all;
  // A cap below the smallest rendition still needs one candidate.
  const renditions = capped.length ? capped : all.slice(0, 1);
  return (
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
      className={`absolute inset-0 h-full w-full ${className}`}
    />
  );
}
