
'use client';

import { useEffect, useState } from 'react';
import { GetPhotoById } from '@/src/application/use-cases/GetPhotoById';
import { CloudinaryPhotoRepository } from '@/src/infrastructure/CloudinaryPhotoRepository';
import { Photo } from '@/src/domain/entities/Photo';
import { PhotoCard } from '@/src/ui/components/PhotoCard';
import { LoadingSpinner } from '@/src/ui/components/LoadingSpinner';
import { ErrorMessage } from '@/src/ui/components/ErrorMessage';

const photoRepository = new CloudinaryPhotoRepository();
const getPhotoById = new GetPhotoById(photoRepository);

export default function Home() {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testPhotoId = "Atardecer_heavy_zordwm";

  const fetchPhoto = async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedPhoto = await getPhotoById.execute(testPhotoId);
      if(fetchedPhoto === null) {
        setError('Photo not found');
        return;
      }
      setPhoto(fetchedPhoto);
    } catch (err) {
      setError('Failed to fetch photo');
      console.error('Error fetching photo:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhoto();
  }, []);

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Photo Gallery Test</h1>
      
      {loading && <LoadingSpinner message="Loading photo..." />}
      
      {error && (
        <ErrorMessage 
          message={error} 
          onRetry={fetchPhoto}
          className="mb-6"
        />
      )}
      
      {photo && <PhotoCard photo={photo} />}
    </main>
  );
}
