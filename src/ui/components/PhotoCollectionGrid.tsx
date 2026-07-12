import { PhotoCollection } from '../../domain/entities/PhotoCollection';
import { PhotoCard } from './PhotoCard';

interface PhotoCollectionGridProps {
  collection: PhotoCollection;
  className?: string;
}

export function PhotoCollectionGrid({ collection, className = '' }: PhotoCollectionGridProps) {
  const photos = collection.getPhotos();

  if (photos.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-gray-500">No photos in this collection</p>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <h1 className="text-2xl font-bold mb-6">{collection.getTitle()}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {photos.map((photo) => (
          <PhotoCard 
            key={photo.getId()} 
            photo={photo}
            className="w-full"
          />
        ))}
      </div>
    </div>
  );
}