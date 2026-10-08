'use client';
import { useCallback } from "react";
import { GetAllPhotos } from "@/src/application/use-cases/GetAllPhotos";
import { getAllPhotos as defaultGetAllPhotos } from "@/src/infrastructure/photoServices";
import { usePhotoFetch } from "@/src/ui/hooks/usePhotoFetch";
import { PhotoFetchStatus } from "./PhotoFetchStatus";
import { PhotoGrid } from "./PhotoGrid";

interface GalleryProps {
  getAllPhotos?: Pick<GetAllPhotos, "execute">;
}

export default function Gallery({ getAllPhotos = defaultGetAllPhotos }: GalleryProps) {
  const fetchAllPhotos = useCallback(() => getAllPhotos.execute(), [getAllPhotos]);
  const { data: photos, loading, error, retry } = usePhotoFetch(fetchAllPhotos, "No photos found");

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="mx-auto w-full max-w-[120rem]">
        <h1 className="text-4xl font-bold">Galería</h1>

        <div className="mt-8">
          <PhotoFetchStatus loading={loading} error={error} onRetry={retry} />
          {photos && <PhotoGrid photos={photos} />}
        </div>
      </div>
    </main>
  );
}
