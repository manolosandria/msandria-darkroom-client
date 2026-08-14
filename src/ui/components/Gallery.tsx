'use client';
import { useCallback } from "react";
import { GetAllPhotos } from "@/src/application/use-cases/GetAllPhotos";
import { getAllPhotos as defaultGetAllPhotos } from "@/src/infrastructure/photoServices";
import { usePhotoFetch } from "@/src/ui/hooks/usePhotoFetch";
import { PhotoFetchStatus } from "./PhotoFetchStatus";
import { PhotoCard } from "./PhotoCard";

interface GalleryProps {
  getAllPhotos?: Pick<GetAllPhotos, "execute">;
}

export default function Gallery({ getAllPhotos = defaultGetAllPhotos }: GalleryProps) {
  const fetchAllPhotos = useCallback(() => getAllPhotos.execute(), [getAllPhotos]);
  const { data: photos, loading, error, retry } = usePhotoFetch(fetchAllPhotos, "No photos found");

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="w-full max-w-4xl">
        <h1 className="text-4xl font-bold">Galería</h1>
        <p className="mt-4 text-lg text-gray-200">
          Finalmente el sitio empieza a agarrar forma. Todavía queda mucho por hacer, pero ya se puede ver.
        </p>

        <div className="mt-8">
          <PhotoFetchStatus loading={loading} error={error} onRetry={retry} />
          {photos && photos.map((photo) => (
            <PhotoCard key={photo.getId()} photo={photo} />
          ))}
        </div>
      </div>
    </main>
  );
}
