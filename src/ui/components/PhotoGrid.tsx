import Image from 'next/image';
import type { CSSProperties } from 'react';
import { Photo } from '../../domain/entities/Photo';

interface PhotoGridProps {
  photos: Photo[];
  className?: string;
}

// The first tiles are usually on screen when the page opens: load them right away.
const EAGER_TILES = 4;

// Justified rows: every tile in a row shares the same height and takes a width
// proportional to its photo, so photos keep their shape and each row fills the
// page. The arrangement lives in CSS (.photo-grid in globals.css), which makes it
// follow the window size without measuring anything in JavaScript.
export function PhotoGrid({ photos, className = '' }: PhotoGridProps) {
  return (
    <ul className={`photo-grid ${className}`}>
      {photos.map((photo, index) => {
        const ratio = photo.getAspectRatio();
        return (
          <li
            key={photo.getId()}
            className="photo-grid__tile"
            style={{ '--ratio': ratio } as CSSProperties}
          >
            <Image
              loader={({ width }) => photo.urlForWidth(width)}
              src={photo.getId()}
              alt={photo.getTitle()}
              fill
              className="object-cover"
              // A tile is `ratio` times the row height wide. Rows are 22vw tall
              // and can stretch about 1.5 times to fill the width: 33vw covers it.
              sizes={`(max-width: 639px) 100vw, ${(ratio * 33).toFixed(1)}vw`}
              loading={index < EAGER_TILES ? 'eager' : 'lazy'}
            />
            <span className="photo-grid__caption">{photo.getTitle()}</span>
          </li>
        );
      })}
    </ul>
  );
}
