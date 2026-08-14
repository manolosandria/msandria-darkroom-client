'use client';

import { useCallback } from 'react';
import { GetPhotoById } from '@/src/application/use-cases/GetPhotoById';
import { getPhotoById as defaultGetPhotoById } from '@/src/infrastructure/photoServices';
import { usePhotoFetch } from '@/src/ui/hooks/usePhotoFetch';
import { PhotoCard } from '@/src/ui/components/PhotoCard';
import { PhotoFetchStatus } from '@/src/ui/components/PhotoFetchStatus';

const FEATURED_PHOTO_ID = 'Atardecer_heavy_zordwm';

interface HomePageProps {
  getPhotoById?: Pick<GetPhotoById, "execute">;
}

export default function HomePage({ getPhotoById = defaultGetPhotoById }: HomePageProps) {
  const fetchFeaturedPhoto = useCallback(
    () => getPhotoById.execute(FEATURED_PHOTO_ID),
    [getPhotoById],
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
