import Image from 'next/image';
import { Photo } from '../../domain/entities/Photo';

interface PhotoCardProps {
  photo: Photo;
  className?: string;
}

export function PhotoCard({ photo, className = '' }: PhotoCardProps) {
  return (
    <div className={`max-w-2xl ${className}`}>
      <h2 className="text-xl mb-4">{photo.getTitle()}</h2>
      <div className="relative w-full aspect-[4/3]">
        {/* The loader picks one of the renditions sent by the API, so Next.js
            never downloads or re-encodes the original file. */}
        <Image
          loader={({ width }) => photo.urlForWidth(width)}
          src={photo.getId()}
          alt={photo.getTitle()}
          fill
          className="rounded-lg shadow-lg object-cover"
          sizes="(max-width: 42rem) 100vw, 42rem"
          loading="eager"
        />
      </div>
      <p className="text-sm text-gray-600 mt-2">Photo ID: {photo.getId()}</p>
    </div>
  );
}
