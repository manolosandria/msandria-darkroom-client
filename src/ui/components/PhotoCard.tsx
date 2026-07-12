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
        <Image 
          src={photo.getUrl()} 
          alt={photo.getTitle()}
          fill
          className="rounded-lg shadow-lg object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority
        />
      </div>
      <p className="text-sm text-gray-600 mt-2">Photo ID: {photo.getId()}</p>
    </div>
  );
}