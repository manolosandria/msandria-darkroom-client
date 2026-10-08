'use client';

import { useCallback } from 'react';
import { GetAllPhotos } from '@/src/application/use-cases/GetAllPhotos';
import { getAllPhotos as defaultGetAllPhotos } from '@/src/infrastructure/photoServices';
import { usePhotoFetch } from '@/src/ui/hooks/usePhotoFetch';
import { PhotoCard } from '@/src/ui/components/PhotoCard';
import { PhotoFetchStatus } from '@/src/ui/components/PhotoFetchStatus';

interface HomePageProps {
  getAllPhotos?: Pick<GetAllPhotos, "execute">;
}

export default function HomePage({ getAllPhotos = defaultGetAllPhotos }: HomePageProps) {
  // The API lists the newest photo first; it is featured until collections exist.
  const fetchFeaturedPhoto = useCallback(
    async () => (await getAllPhotos.execute())?.[0] ?? null,
    [getAllPhotos],
  );
  const { data: photo, loading, error, retry } = usePhotoFetch(fetchFeaturedPhoto, 'Photo not found');

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="w-full max-w-4xl">
        <h1 className="text-4xl font-bold">Y arrancó...</h1>
        <p className="mt-4 text-lg text-gray-200">
          Finalmente el sitio empieza a agarrar forma. Todavía queda mucho por hacer, pero ya se puede ver.
        </p>

        <div className="mt-8">
          <PhotoFetchStatus loading={loading} error={error} onRetry={retry} />
          {photo && <PhotoCard photo={photo} />}
        </div>
      </div>
    </main>
  );
}
