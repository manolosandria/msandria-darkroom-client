"use client";
import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { getPhotoById as defaultGetPhotoById } from "@/src/infrastructure/photoServices";
import { GetPhotoById } from "@/src/application/use-cases/GetPhotoById";
import { rememberViewerSequence } from "@/src/ui/viewerSequence";
import { ArrangeTarget, BannerHandle, useBannerArrange } from "./BannerArrange";
import { ResolutionBadge } from "./ResolutionBadge";
import { useWelcomePlacement } from "./welcomePlacement";
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
  defaultWelcomePanel,
  HomeBanner,
  WelcomePlacement,
} from "@/src/domain/entities/HomeBanner";
import { manageHomeBanner } from "@/src/infrastructure/homeBannerServices";
export default function HomePage({
  getAllPhotos = defaultGetAllPhotos,
  getPhotoById = defaultGetPhotoById,
  banner: previewBanner,
  onEditPhoto,
  editedPhoto,
  onArrange,
  focusSlide,
  onActiveChange,
  onPlaceWelcome,
}: {
  getAllPhotos?: Pick<GetAllPhotos, "execute">;
  getPhotoById?: Pick<GetPhotoById, "execute">;
  banner?: HomeBanner;
  editedPhoto?: Photo | null;
  onEditPhoto?: (photo: Photo) => void;
  /** Curator only: drag handles rearrange Welcome and Photographs. */
  onArrange?: (target: ArrangeTarget) => void;
  /** Curator only: each new request shows that slide. */
  focusSlide?: { photoId: string };
  /** Curator only: told which slide is showing. */
  onActiveChange?: (photoId: string) => void;
  /**
   * Curator only: the Welcome panel over the photograph was moved or resized. The
   * photo id names the slide whose own title it is; without it, the general one.
   */
  onPlaceWelcome?: (placement: WelcomePlacement, photoId?: string) => void;
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
  // Slides chosen in Curator decide the carousel, in their order. Without any, or when
  // none of them can be shown, Home draws eligible photos at random.
  const slideIds = (banner.slides ?? [])
    .map((slide) => slide.photoId)
    .join("|");
  const [details, setDetails] = useState<Record<string, Photo>>({});
  const fetchPhotos = useCallback(async () => {
    if (slideIds) {
      const curated = (
        await Promise.all(
          slideIds
            .split("|")
            .map((id) => getPhotoById.execute(id).catch(() => null)),
        )
      ).filter((photo): photo is Photo => !!photo);
      // These are already the detail responses the active slide needs.
      setDetails((previous) => ({
        ...previous,
        ...Object.fromEntries(curated.map((photo) => [photo.getId(), photo])),
      }));
      if (curated.some((photo) => enabledPhotoViews(photo, "home").length))
        return curated;
    }
    const photos = await getAllPhotos.execute();
    const eligible =
      photos?.filter((photo) => enabledPhotoViews(photo, "home").length > 0) ??
      [];
    for (let i = eligible.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
    }
    return eligible.length ? eligible.slice(0, 8) : null;
  }, [getAllPhotos, getPhotoById, slideIds]);
  const {
    data: loadedPhotos,
    loading,
    error,
    retry,
  } = usePhotoFetch(fetchPhotos, "Photo not found");
  const photos = loadedPhotos
    ?.map((item) =>
      editedPhoto?.getId() === item.getId()
        ? editedPhoto
        : (details[item.getId()] ?? item),
    )
    .filter((item) => enabledPhotoViews(item, "home").length > 0);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const [index, setIndex] = useState(0);
  const selected = photos?.length ? index % photos.length : 0;
  const listed = photos?.[selected];
  const listedId = listed?.getId();
  // Each slide's detail is fetched once and kept, so going back to it costs nothing.
  const hasDetail = !!listedId && !!details[listedId];
  useEffect(() => {
    let active = true;
    if (listedId && !hasDetail)
      void getPhotoById
        .execute(listedId)
        .then((value) => {
          if (active && value)
            setDetails((previous) => ({ ...previous, [listedId]: value }));
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [listedId, hasDetail, getPhotoById]);
  const photo = listed;
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
  const destination =
    slide?.href ?? `/photo/${encodeURIComponent(photo?.getId() ?? "")}`;
  const general = { ...defaultWelcomePanel, ...banner.welcome };
  // A slide's own title replaces the general one, text, link and placement alike.
  const heading = slide?.heading;
  const welcome = heading
    ? {
        ...general,
        position: heading.position,
        x: heading.x,
        y: heading.y,
        width: heading.width,
      }
    : general;
  const free =
    banner.layout === "text-overlay" &&
    welcome.x !== undefined &&
    welcome.y !== undefined;
  const words = heading ?? {
    eyebrow: banner.eyebrow,
    title: banner.title,
    accentText: banner.accentText,
    linkText: banner.linkText,
    href: "/gallery",
    fontSize: banner.fontSize,
  };
  const stage = useRef<HTMLElement>(null);
  const placement = useWelcomePlacement({
    stage,
    current: {
      width: welcome.width,
      fontSize: words.fontSize,
      ...(free && { x: welcome.x, y: welcome.y }),
    },
    onPlace:
      onPlaceWelcome &&
      ((value) => onPlaceWelcome(value, heading ? slide!.photoId : undefined)),
  });
  const arrange = useBannerArrange({
    stage,
    layout: banner.layout,
    position: welcome.position,
    onArrange,
  });
  // A focus request is answered once its slide is in the carousel, adjusting the index
  // during render rather than in an effect.
  const [answered, setAnswered] = useState<typeof focusSlide>();
  if (focusSlide && focusSlide !== answered) {
    const at =
      photos?.findIndex((item) => item.getId() === focusSlide.photoId) ?? -1;
    if (at >= 0) {
      setAnswered(focusSlide);
      setIndex(at);
    }
  }
  useEffect(() => {
    if (listedId) onActiveChange?.(listedId);
  }, [listedId, onActiveChange]);

  const move = (step: number) => {
    if (photos?.length)
      setIndex((selected + step + photos.length) % photos.length);
  };
  return (
    <div className="home-banner-scope">
      <main
        ref={stage}
        className={`home-gallery home-gallery--${banner.layout} home-gallery--${banner.shape} home-gallery--${banner.imageMode ?? "highlight"} home-gallery--nav-${banner.navigation ?? "dots"} home-gallery--controls-${banner.controlsPosition ?? "below"} home-gallery--welcome-${free ? "free" : welcome.position} home-gallery--panel-${welcome.panel}${onArrange ? " home-gallery--editing" : ""}${arrange.dragging ? " is-arranging" : ""}`}
        style={
          {
            "--banner-height": `${banner.bannerHeight ?? 620}px`,
            "--banner-background": banner.backgroundColor,
            "--banner-text": banner.textColor,
            "--banner-accent": banner.accentColor,
            "--banner-surface": banner.surfaceColor,
            "--banner-font":
              bannerFonts.find((font) => font.id === banner.font)?.family ??
              bannerFonts[0].family,
            "--banner-font-size": `${words.fontSize / 16}rem`,
            "--banner-align": banner.textAlign,
            "--welcome-width": `${welcome.width}%`,
            "--welcome-panel": welcome.panelColor,
            "--welcome-text": welcome.textColor,
            "--welcome-alpha": `${banner.overlayOpacity ?? 45}%`,
            "--welcome-radius": `${welcome.radius}px`,
            ...(free && {
              "--welcome-x": `${welcome.x}%`,
              "--welcome-y": `${welcome.y}%`,
            }),
          } as CSSProperties
        }
      >
        <header
          className="home-gallery__intro"
          data-own={heading ? true : undefined}
          {...(onPlaceWelcome && banner.layout === "text-overlay"
            ? placement.panel
            : {})}
        >
          {onArrange && (
            <BannerHandle block="text" props={arrange.handle("text")} />
          )}
          <p>{words.eyebrow}</p>
          <h1>
            {words.title}
            <br />
            <em>{words.accentText}</em>
          </h1>
          {words.linkText && (
            <Link
              href={words.href}
              onClick={(event) => {
                if (onPlaceWelcome) event.preventDefault();
              }}
            >
              {words.linkText} <span aria-hidden="true">↗</span>
            </Link>
          )}
          {onPlaceWelcome && banner.layout === "text-overlay" && (
            <>
              <span
                className="welcome-resize welcome-resize--edge"
                aria-hidden="true"
                {...placement.edge}
              />
              <span
                className="welcome-resize welcome-resize--corner"
                aria-hidden="true"
                {...placement.corner}
              />
            </>
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
          {onArrange && (
            <BannerHandle block="photo" props={arrange.handle("photo")} />
          )}
          <PhotoFetchStatus loading={loading} error={error} onRetry={retry} />
          {!loading && loadedPhotos && photos?.length === 0 && (
            <p>No enabled photographs for Home.</p>
          )}
          {photo && (
            <>
              {/* A click on the photo only selects the carousel, for the arrow keys; the
                  title is what opens the slide's destination. In Curator the photo
                  opens its banner settings instead. */}
              <div
                key={photo.getId()}
                draggable={false}
                className="home-carousel__image"
                onClick={() => onEditPhoto?.(photo)}
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
                  <Link
                    draggable={false}
                    href={destination}
                    onClick={(event) => {
                      if (onEditPhoto) {
                        event.preventDefault();
                        onEditPhoto(photo);
                      } else if (destination.startsWith("/photo/"))
                        rememberViewerSequence(
                          photos!.map((item) => [item.getId()]),
                        );
                    }}
                  >
                    {slide?.text ?? photo.getTitle()}{" "}
                    <span aria-hidden="true">↗</span>
                  </Link>
                </span>
              </div>
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
        {arrange.dropMap}
        {onArrange && (
          <p className="sr-only" aria-live="polite">
            {arrange.announcement}
          </p>
        )}
      </main>
      {arrange.ghost}
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
        // A small chip in the corner, so the composition stays in view; the
        // full report opens under the pointer or keyboard focus.
        <span
          className="banner-quality"
          tabIndex={0}
          data-warning={report.includes("Upscaling") || undefined}
        >
          <span className="banner-quality__chip" aria-hidden="true">
            {Math.round(pixels.width)} × {Math.round(pixels.height)}
          </span>
          <span className="banner-quality__detail">
            {report}
            <ResolutionBadge width={pixels.width} height={pixels.height} />
          </span>
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
