"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { GetAllPhotos } from "@/src/application/use-cases/GetAllPhotos";
import { getAllPhotos as defaultGetAllPhotos } from "@/src/infrastructure/photoServices";
import { usePhotoFetch } from "@/src/ui/hooks/usePhotoFetch";
import { PhotoImage } from "./PhotoImage";
import { PhotoFetchStatus } from "./PhotoFetchStatus";
import { Photo } from "@/src/domain/entities/Photo";
import { framedLayout } from "@/src/ui/framedLayout";
import "./homeCarousel.css";
export default function HomePage({
  getAllPhotos = defaultGetAllPhotos,
}: {
  getAllPhotos?: Pick<GetAllPhotos, "execute">;
}) {
  const fetchPhotos = useCallback(async () => {
    const photos = await getAllPhotos.execute();
    return photos?.length ? photos.slice(0, 8) : null;
  }, [getAllPhotos]);
  const {
    data: photos,
    loading,
    error,
    retry,
  } = usePhotoFetch(fetchPhotos, "Photo not found");
  const [index, setIndex] = useState(0);
  const selected = photos ? index % photos.length : 0;
  const photo = photos?.[selected];
  const move = (step: number) => {
    if (photos) setIndex((selected + step + photos.length) % photos.length);
  };
  return (
    <main className="home-gallery">
      <header className="home-gallery__intro">
        <p>MANOLO SANDRIA / PHOTOGRAPHY</p>
        <h1>
          A moment.
          <br />
          <em>Another way of seeing.</em>
        </h1>
        <Link href="/gallery">
          Explore the gallery <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <section
        className="home-carousel"
        aria-label="Featured photographs"
        aria-roledescription="carousel"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            move(event.key === "ArrowLeft" ? -1 : 1);
          }
        }}
      >
        <PhotoFetchStatus loading={loading} error={error} onRetry={retry} />
        {photo && (
          <>
            <Link
              key={photo.getId()}
              className="home-carousel__image"
              href={`/photo/${encodeURIComponent(photo.getId())}`}
            >
              <FramedSlide photo={photo} />
              <span className="home-carousel__caption">
                {photo.getTitle()} <span aria-hidden="true">↗</span>
              </span>
            </Link>
            <div className="home-carousel__controls">
              <span aria-live="polite">
                {String(selected + 1).padStart(2, "0")} /{" "}
                {String(photos!.length).padStart(2, "0")}
              </span>
              <div className="home-carousel__dots">
                {photos!.map((item, i) => (
                  <button
                    key={item.getId()}
                    aria-label={`Show photograph ${i + 1}`}
                    aria-pressed={i === selected}
                    onClick={() => setIndex(i)}
                  />
                ))}
              </div>
              <button
                aria-label="Previous photograph"
                disabled={photos!.length < 2}
                onClick={() => move(-1)}
              >
                ←
              </button>
              <button
                aria-label="Next photograph"
                disabled={photos!.length < 2}
                onClick={() => move(1)}
              >
                →
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

// The photo inside its own frame, as large as the slide allows. The slide is a size
// container, so the framed box fits whichever of its width or height runs out first.
function FramedSlide({ photo }: { photo: Photo }) {
  const frame = photo.getFrame();
  const layout = framedLayout(photo.getAspectRatio(), frame);
  return (
    <div className="home-carousel__stage">
      <div
        data-testid="carousel-frame"
        className="home-carousel__frame"
        style={{
          background: frame?.color,
          padding: `${layout.paddingY}% ${layout.paddingX}%`,
          width: `min(100cqw, 100cqh / ${layout.heightPerWidth})`,
        }}
      >
        <div
          className="home-carousel__photo"
          style={{ aspectRatio: `${photo.getWidth()} / ${photo.getHeight()}` }}
        >
          <PhotoImage
            photo={photo}
            fallbackSizes="(max-width: 800px) 100vw, 70vw"
          />
        </div>
      </div>
    </div>
  );
}
