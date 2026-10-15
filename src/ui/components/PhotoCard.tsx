import { PhotoImage } from './PhotoImage';
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
        <PhotoImage
          photo={photo}
          className="rounded-lg shadow-lg object-cover"
          fallbackSizes="(max-width: 42rem) 100vw, 42rem"
        />
      </div>
      <p className="text-sm text-gray-600 mt-2">Photo ID: {photo.getId()}</p>
    </div>
  );
}
