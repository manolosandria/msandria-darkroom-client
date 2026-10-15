"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, type PointerEvent } from "react";
import { GetAllPhotos } from "@/src/application/use-cases/GetAllPhotos";
import { GetPhotoById } from "@/src/application/use-cases/GetPhotoById";
import {
  getAllPhotos as defaultGetAllPhotos,
  getPhotoById as defaultGetPhotoById,
} from "@/src/infrastructure/photoServices";
import { usePhotoFetch } from "@/src/ui/hooks/usePhotoFetch";
import { usePhotoQuality } from "@/src/ui/hooks/usePhotoQuality";
import { framedLayout } from "@/src/ui/framedLayout";
import { PhotoFetchStatus } from "./PhotoFetchStatus";
import { QualitySelector } from "./QualitySelector";

interface PhotoViewerProps {
  photoId: string;
  getPhoto?: Pick<GetPhotoById, "execute">;
  getAllPhotos?: Pick<GetAllPhotos, "execute">;
}

const SWIPE_DISTANCE = 50;

// One photo, large, in its frame. The detail response carries the renditions up to
// 2560 px; the listing, already fetched by the gallery, only supplies the order so the
// arrows know which photo comes before and after.
export default function PhotoViewer({
  photoId,
  getPhoto = defaultGetPhotoById,
  getAllPhotos = defaultGetAllPhotos,
}: PhotoViewerProps) {
  const router = useRouter();
  const [quality, setQuality] = usePhotoQuality();
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const fetchPhoto = useCallback(() => getPhoto.execute(photoId), [getPhoto, photoId]);
  const fetchAll = useCallback(() => getAllPhotos.execute(), [getAllPhotos]);
  const { data: photo, loading, error, retry } = usePhotoFetch(fetchPhoto, "Photo not found");
  const { data: all } = usePhotoFetch(fetchAll, "No photos found");

  const index = all ? all.findIndex((entry) => entry.getId() === photoId) : -1;
  const previousId = all && index > 0 ? all[index - 1].getId() : null;
  const nextId = all && index >= 0 && index < all.length - 1 ? all[index + 1].getId() : null;

  const go = useCallback(
    (id: string | null) => {
      if (id) router.push(`/photo/${encodeURIComponent(id)}`);
    },
    [router],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") go(previousId);
      else if (event.key === "ArrowRight") go(nextId);
      else if (event.key === "Escape") router.push("/gallery");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, previousId, nextId, router]);

  const onPointerDown = (event: PointerEvent) => {
    swipeStart.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy)) return;
    go(dx > 0 ? previousId : nextId);
  };

  const frame = photo?.getFrame() ?? null;
  const layout = photo ? framedLayout(photo.getAspectRatio(), frame) : null;

  return (
    <main className="flex min-h-screen flex-col items-center bg-neutral-950 px-4 py-4 text-neutral-100">
      <nav className="flex w-full max-w-[120rem] items-center justify-between pb-4">
        <Link href="/gallery" className="underline">Gallery</Link>
        <span className="flex gap-6">
          {previousId ? <Link href={`/photo/${encodeURIComponent(previousId)}`} rel="prev">Previous</Link> : null}
          {nextId ? <Link href={`/photo/${encodeURIComponent(nextId)}`} rel="next">Next</Link> : null}
        </span>
      </nav>

      <PhotoFetchStatus loading={loading} error={error} onRetry={retry} />

      {photo && layout && (
        <figure
          className="touch-pan-y select-none"
          style={{ width: `min(100%, calc((100dvh - 9rem) / ${layout.heightPerWidth}))` }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          <div
            data-testid="photo-frame"
            style={{
              background: frame?.color,
              padding: `${layout.paddingY}% ${layout.paddingX}%`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- API rendition URLs are used verbatim. */}
            <img
              src={photo.urlForQuality(quality)}
              alt={photo.getTitle()}
              width={photo.getWidth()}
              height={photo.getHeight()}
              draggable={false}
              className="block h-auto w-full"
            />
          </div>
          <figcaption className="pt-3 text-center text-sm">{photo.getTitle()}</figcaption>
        </figure>
      )}

      <QualitySelector quality={quality} onChange={setQuality} />
    </main>
  );
}
