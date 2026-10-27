"use client";
import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { getPhotoById } from "@/src/infrastructure/photoServices";
import { BannerDragHandle } from "./BannerDragHandle";
import { ResolutionBadge } from "./ResolutionBadge";
import Link from "next/link";
import { GetAllPhotos } from "@/src/application/use-cases/GetAllPhotos";
import { getHomePhotos as defaultGetAllPhotos } from "@/src/infrastructure/photoServices";
import { usePhotoFetch } from "@/src/ui/hooks/usePhotoFetch";
import {
  enabledPhotoViews,
  choosePhotoView,
  PhotoView,
} from "@/src/domain/photoPresentation";
import { PhotoImage } from "./PhotoImage";
import { PhotoFetchStatus } from "./PhotoFetchStatus";
import { Photo } from "@/src/domain/entities/Photo";
import { framedLayout } from "@/src/ui/framedLayout";
import "./homeCarousel.css";
import { bannerFonts } from "../bannerPresets";
import { HighlightKind } from "@/src/domain/entities/PhotoHighlights";
import {
  defaultHomeBanner,
  HomeBanner,
} from "@/src/domain/entities/HomeBanner";
import { manageHomeBanner } from "@/src/infrastructure/homeBannerServices";
export default function HomePage({
  getAllPhotos = defaultGetAllPhotos,
  banner: previewBanner,
  onEditPhoto,
  editedPhoto,
  onLayoutChange,
}: {
  getAllPhotos?: Pick<GetAllPhotos, "execute">;
  banner?: HomeBanner;
  editedPhoto?: Photo | null;
  onEditPhoto?: (photo: Photo) => void;
  onLayoutChange?: (layout: string) => void;
}) {
  const [savedBanner, setSavedBanner] = useState<HomeBanner>(defaultHomeBanner);
  useEffect(() => {
    if (previewBanner) return;
    let active = true;
    void manageHomeBanner
      .get()
      .then((value) => {
        if (active) setSavedBanner(value);
      })
      .catch(() => {
        /* Keep the original design if settings are unavailable. */
      });
    return () => {
      active = false;
    };
  }, [previewBanner]);
  const banner = previewBanner ?? savedBanner;
  const fetchPhotos = useCallback(async () => {
    const photos = await getAllPhotos.execute();
    const eligible =
      photos?.filter((photo) => enabledPhotoViews(photo, "home").length > 0) ??
      [];
    for (let i = eligible.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
    }
    return eligible.length ? eligible.slice(0, 8) : null;
  }, [getAllPhotos]);
  const {
    data: loadedPhotos,
    loading,
    error,
    retry,
  } = usePhotoFetch(fetchPhotos, "Photo not found");
  const [detail, setDetail] = useState<Photo | null>(null);
  const photos = loadedPhotos
    ?.map((item) =>
      editedPhoto?.getId() === item.getId()
        ? editedPhoto
        : detail?.getId() === item.getId()
          ? detail
          : item,
    )
    .filter((item) => enabledPhotoViews(item, "home").length > 0);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const [index, setIndex] = useState(0);
  const selected = photos?.length ? index % photos.length : 0;
  const listed = photos?.[selected];
  const listedId = listed?.getId();
  useEffect(() => {
    let active = true;
    if (listedId)
      void getPhotoById
        .execute(listedId)
        .then((value) => {
          if (active) setDetail(value ?? null);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [listedId]);
  const photo =
    editedPhoto?.getId() === listed?.getId()
      ? editedPhoto
      : detail?.getId() === listed?.getId()
        ? detail
        : listed;
  const view = photo
    ? choosePhotoView(
        photo,
        "home",
        photos!.map((item) => item.getId()).join("|"),
      )
    : undefined;
  const selection = banner.photoCrops?.find(
    (item) => item.photoId === photo?.getId(),
  );
  const slide = banner.slides?.find((item) => item.photoId === photo?.getId());
  const start = useRef<{ x: number; y: number; block: string } | null>(null);
  const arrange = (block: string) => ({
    draggable: !!onLayoutChange,
    onDragStart: (event: React.DragEvent) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", block);
      start.current = { x: event.clientX, y: event.clientY, block };
    },
    onDragEnd: (event: React.DragEvent) => {
      const value = start.current;
      start.current = null;
      if (!value || !onLayoutChange) return;
      const x = event.clientX - value.x,
        y = event.clientY - value.y;
      if (Math.max(Math.abs(x), Math.abs(y)) < 25) return;
      const side =
        Math.abs(x) > Math.abs(y)
          ? x < 0
            ? "left"
            : "right"
          : y < 0
            ? "top"
            : "bottom";
      const inverse: Record<string, string> = {
        left: "right",
        right: "left",
        top: "bottom",
        bottom: "top",
      };
      onLayoutChange(`text-${block === "text" ? side : inverse[side]}`);
    },
  });

  const move = (step: number) => {
    if (photos?.length)
      setIndex((selected + step + photos.length) % photos.length);
  };
  return (
    <div className="home-banner-scope">
      <main
        onDragOver={(event) => {
          if (onLayoutChange) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }
        }}
        onDrop={(event) => event.preventDefault()}
        className={`home-gallery home-gallery--${banner.layout} home-gallery--${banner.shape} home-gallery--${banner.imageMode ?? "highlight"} home-gallery--nav-${banner.navigation ?? "dots"} home-gallery--controls-${banner.controlsPosition ?? "below"}`}
        style={
          {
            "--banner-height": `${banner.bannerHeight ?? 620}px`,
            "--banner-overlay-opacity": (banner.overlayOpacity ?? 45) / 100,
            "--banner-background": banner.backgroundColor,
            "--banner-text": banner.textColor,
            "--banner-accent": banner.accentColor,
            "--banner-surface": banner.surfaceColor,
            "--banner-font":
              bannerFonts.find((font) => font.id === banner.font)?.family ??
              bannerFonts[0].family,
            "--banner-font-size": `${banner.fontSize / 16}rem`,
            "--banner-align": banner.textAlign,
          } as CSSProperties
        }
      >
        <header className="home-gallery__intro" {...arrange("text")}>
          {onLayoutChange && (
            <BannerDragHandle block="text" onChange={onLayoutChange} />
          )}
          <p>{banner.eyebrow}</p>
          <h1>
            {banner.title}
            <br />
            <em>{banner.accentText}</em>
          </h1>
          {banner.linkText && (
            <Link href="/gallery">
              {banner.linkText} <span aria-hidden="true">↗</span>
            </Link>
          )}
        </header>
        <section
          className="home-carousel"

          tabIndex={0}
          onPointerDown={(event) => {
            if (
              event.pointerType === "mouse" &&
              event.button === 0 &&
              !(event.target as HTMLElement).closest(
                "button,.banner-live-handle",
              )
            ) {
              swipe.current = { x: event.clientX, y: event.clientY };
            }
          }}
          onPointerUp={(event) => {
            if (event.pointerType !== "mouse" || !swipe.current) return;
            const origin = swipe.current;
            swipe.current = null;
            const dx = event.clientX - origin.x,
              dy = event.clientY - origin.y;
            if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
              suppressClick.current = true;
              move(dx < 0 ? 1 : -1);
            }
          }}
          onPointerCancel={() => {
            swipe.current = null;
          }}
          aria-label="Featured photographs"
          aria-roledescription="carousel"
          onTouchStart={(event) => {
            suppressClick.current = false;
            swipe.current =
              event.touches.length === 1
                ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
                : null;
          }}
          onTouchMove={(event) => {
            const start = swipe.current;
            if (!start || event.touches.length !== 1) {
              swipe.current = null;
              return;
            }
            const dx = event.touches[0].clientX - start.x;
            const dy = event.touches[0].clientY - start.y;
            if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3)
              suppressClick.current = true;
          }}
          onTouchEnd={(event) => {
            const start = swipe.current;
            swipe.current = null;
            if (!start || !event.changedTouches.length) return;
            const dx = event.changedTouches[0].clientX - start.x;
            const dy = event.changedTouches[0].clientY - start.y;
            if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
              suppressClick.current = true;
              move(dx < 0 ? 1 : -1);
            }
          }}
          onTouchCancel={() => {
            swipe.current = null;
            suppressClick.current = false;
          }}
          onClickCapture={(event) => {
            if (suppressClick.current) {
              event.preventDefault();
              event.stopPropagation();
              suppressClick.current = false;
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              move(event.key === "ArrowLeft" ? -1 : 1);
            }
          }}
        >
          {onLayoutChange && (
            <BannerDragHandle block="photo" onChange={onLayoutChange} />
          )}
          <PhotoFetchStatus loading={loading} error={error} onRetry={retry} />
          {!loading && loadedPhotos && photos?.length === 0 && (
            <p>No enabled photographs for Home.</p>
          )}
          {photo && (
            <>
              <Link
                key={photo.getId()}
                draggable={false}
                className="home-carousel__image"
                onClick={(event) => {
                  if (onEditPhoto) {
                    event.preventDefault();
                    onEditPhoto(photo);
                  }
                }}
                href={
                  slide?.href ?? `/photo/${encodeURIComponent(photo.getId())}`
                }
              >
                {banner.imageMode === "framed" ? (
                  <FramedSlide photo={photo} view={view!} />
                ) : (
                  <>
                    <CroppedSlide
                      photo={photo}
                      cropName={resolveHomeCrop(
                        photo,
                        selection?.desktop,
                        banner.imageMode === "fill"
                          ? "full"
                          : (banner.desktopCrop ?? "landscape"),
                        view!,
                      )}
                      device="desktop"
                      quality={!!onEditPhoto}
                    />
                    <CroppedSlide
                      photo={photo}
                      cropName={resolveHomeCrop(
                        photo,
                        selection?.mobile,
                        banner.imageMode === "fill"
                          ? "full"
                          : (banner.mobileCrop ?? "portrait"),
                        view!,
                      )}
                      device="mobile"
                      quality={!!onEditPhoto}
                    />
                  </>
                )}
                <span className="home-carousel__caption">
                  {slide?.text ?? photo.getTitle()}{" "}
                  <span aria-hidden="true">↗</span>
                </span>
              </Link>
              <div className="home-carousel__controls">
                <span aria-live="polite">
                  {String(selected + 1).padStart(2, "0")} /{" "}
                  {String(photos!.length).padStart(2, "0")}
                </span>
                {banner.navigation === "progress" && (
                  <progress
                    className="home-carousel__progress"
                    aria-label="Slide progress"
                    value={selected + 1}
                    max={photos!.length}
                  />
                )}
                <div className="home-carousel__dots">
                  {photos!.map((item, i) => (
                    <button
                      key={item.getId()}
                      aria-label={`Show photograph ${i + 1}`}
                      aria-pressed={i === selected}
                      onClick={() => setIndex(i)}
                    >
                      {banner.navigation === "thumbnails" && (
                        <span className="home-carousel__thumb">
                          <PhotoImage
                            photo={item}
                            maxWidth={320}
                            fallbackSizes="48px"
                          />
                        </span>
                      )}
                    </button>
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
    </div>
  );
}

// An explicit per-photo banner selection is a curated choice. Automatic/global
// choices use Home's approved views, independently of Gallery's layout matrix.
function resolveHomeCrop(
  photo: Photo,
  explicit: string | undefined,
  preferred: string,
  fallback: PhotoView,
) {
  if (explicit) return explicit;
  const allowed = enabledPhotoViews(photo, "home");
  const id = preferred === "full" ? "original" : preferred;
  if (allowed.some((view) => view.id === id)) return preferred;
  return fallback.id === "original" ? "full" : fallback.id;
}

// The photo inside its own frame, as large as the slide allows. The slide is a size
// container, so the framed box fits whichever of its width or height runs out first.
function FramedSlide({ photo, view }: { photo: Photo; view: PhotoView }) {
  const frame = photo.getFrame();
  const layout = framedLayout(view.ratio, frame);
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
          style={{ aspectRatio: view.ratio }}
        >
          <PhotoImage
            photo={photo}
            crop={view.crop}
            fallbackSizes="(max-width: 800px) 100vw, 70vw"
          />
        </div>
      </div>
    </div>
  );
}

export function CroppedSlide({
  photo,
  cropName,
  device,
  quality = false,
}: {
  photo: Photo;
  cropName: string;
  device: "desktop" | "mobile";
  quality?: boolean;
}) {
  const crop = (cropName.startsWith("custom:")
    ? photo
        .getHighlights()
        .custom?.find((item) => item.id === cropName.slice(7))?.crop
    : photo.getHighlights()[cropName as HighlightKind]) ?? {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  };
  const node = useRef<HTMLDivElement>(null);
  const [report, setReport] = useState("");
  const [pixels, setPixels] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!quality || !node.current) return;
    const host = node.current;
    const update = () => {
      if (!host.clientWidth) return;
      const image = host.querySelector("img");
      const width =
        photo.getRenditions().find((item) => item.url === image?.currentSrc)
          ?.width ?? 0;
      const w = width * crop.width,
        h = (width / photo.getAspectRatio()) * crop.height;
      const scale =
        Math.max(host.clientWidth / w, host.clientHeight / h) *
        (window.devicePixelRatio || 1);
      setPixels({ width: w, height: h });
      setReport(
        `${width || "…"} px source · crop ${Math.round(w)} × ${Math.round(h)} px · ${scale > 1 ? "⚠ Upscaling" : "Sufficient for this display"}`,
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(host);
    host.addEventListener("load", update, true);
    update();
    return () => {
      observer.disconnect();
      host.removeEventListener("load", update, true);
    };
  }, [photo, crop.width, crop.height, quality]);
  const aspect = (photo.getAspectRatio() * crop.width) / crop.height;
  return (
    <div
      className={`home-carousel__crop home-carousel__crop--${device}`}
      ref={node}
      data-testid={`banner-crop-${device}`}
      style={{ "--crop-aspect": aspect } as CSSProperties}
    >
      {quality && (
        <span className="banner-quality">
          {report}
          <ResolutionBadge width={pixels.width} height={pixels.height} />
        </span>
      )}
      <div className="home-carousel__crop-window">
        <div
          className="home-carousel__crop-source"
          style={{
            width: `${100 / crop.width}%`,
            height: `${100 / crop.height}%`,
            left: `${(-100 * crop.x) / crop.width}%`,
            top: `${(-100 * crop.y) / crop.height}%`,
          }}
        >
          <PhotoImage photo={photo} fallbackSizes="100vw" />
        </div>
      </div>
    </div>
  );
}
