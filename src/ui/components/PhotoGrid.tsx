import { PhotoImage } from './PhotoImage';
import type { CSSProperties } from 'react';
import { Photo } from '../../domain/entities/Photo';

interface PhotoGridProps {
  photos: Photo[];
  className?: string;
}

// Justified rows: every tile in a row shares the same height and takes a width
// proportional to its photo, so photos keep their shape and each row fills the
// page. The arrangement lives in CSS (.photo-grid in globals.css), which makes it
// follow the window size without measuring anything in JavaScript.
export function PhotoGrid({ photos, className = '' }: PhotoGridProps) {
  return (
    <ul className={`photo-grid ${className}`}>
      {photos.map((photo) => {
        const ratio = photo.getAspectRatio();
        return (
          <li
            key={photo.getId()}
            className="photo-grid__tile"
            style={{ '--ratio': ratio } as CSSProperties}
          >
            <PhotoImage
              photo={photo}
              className="object-cover"
              // Native auto-sizes uses the laid-out tile. The fallback is bounded
              // by the maximum row height, even on wide desktop/TV screens.
              fallbackSizes={`(max-width: 639px) calc(100vw - 2rem), min(${(ratio * 33).toFixed(1)}vw, ${(ratio * 33).toFixed(1)}rem)`}
            />
            <span className="photo-grid__caption">{photo.getTitle()}</span>
          </li>
        );
      })}
    </ul>
  );
}
