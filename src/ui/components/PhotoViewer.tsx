"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { PhotoTitlePosition } from "@/src/domain/entities/PhotoTitlePosition";
import { GetAllPhotos } from "@/src/application/use-cases/GetAllPhotos";
import { GetPhotoById } from "@/src/application/use-cases/GetPhotoById";
import {
  getPhotoNeighbors,
  getPhotoById as defaultGetPhotoById,
} from "@/src/infrastructure/photoServices";
import { usePhotoFetch } from "@/src/ui/hooks/usePhotoFetch";
import { usePhotoQuality } from "@/src/ui/hooks/usePhotoQuality";
import { useImageFallback } from "@/src/ui/hooks/useImageFallback";
import { Photo } from "@/src/domain/entities/Photo";
import { PhotoQuality } from "@/src/domain/entities/PhotoQuality";
import { framedLayout } from "@/src/ui/framedLayout";
import { hasSeenViewerHint, markViewerHintSeen } from "@/src/ui/viewerHint";
import {
  isViewerPanelOpen,
  setViewerPanelOpen,
  subscribeViewerPanel,
} from "@/src/ui/viewerPanelState";
import { PhotoFetchStatus } from "./PhotoFetchStatus";
import { PhotoInfoPanel } from "./PhotoInfoPanel";
import { ViewerVariants } from "./ViewerVariants";
import { QualitySelector } from "./QualitySelector";

interface PhotoViewerProps {
  photoId: string;
  getPhoto?: Pick<GetPhotoById, "execute">;
  getAllPhotos?: Pick<GetAllPhotos, "execute">;
}

const SWIPE_DISTANCE = 50;

// The photo at the chosen quality; if it fails to load, the same width from the other
// image host.
function ViewerImage({ photo, quality }: { photo: Photo; quality: PhotoQuality }) {
  const { useFallback, onError } = useImageFallback(photo);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- API rendition URLs are used verbatim.
    <img
      src={photo.urlForQuality(quality, useFallback)}
      alt={photo.getTitle()}
      width={photo.getWidth()}
      height={photo.getHeight()}
      draggable={false}
      onError={onError}
      className="block h-auto w-full"
    />
  );
}
// A hand resting on the mouse jitters; only a deliberate move brings the controls back.
const REVEAL_DISTANCE = 8;

const photoHref = (id: string) => `/photo/${encodeURIComponent(id)}`;

const TITLE_CORNER_CLASS: Record<PhotoTitlePosition, string> = {
  BOTTOM_LEFT: "photo-viewer__title--bottom-left",
  BOTTOM_RIGHT: "photo-viewer__title--bottom-right",
  TOP_LEFT: "photo-viewer__title--top-left",
  TOP_RIGHT: "photo-viewer__title--top-right",
};

// One photo, large, in its frame. The detail response carries the renditions up to
// 2560 px; the listing, already fetched by the gallery, only supplies the order so the
// edges know which photo comes before and after.
//
// The title and controls float over the photo. A left click hides them and moving the
// mouse brings them back; on a touch screen each tap toggles them.
export default function PhotoViewer({
  photoId,
  getPhoto = defaultGetPhotoById,
  getAllPhotos,
}: PhotoViewerProps) {
  const router = useRouter();
  const [quality, setQuality] = usePhotoQuality();
  const [controlsVisible, setControlsVisible] = useState(true);
  const panelOpen = useSyncExternalStore(
    subscribeViewerPanel,
    isViewerPanelOpen,
    () => false,
  );
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const lastPointerType = useRef("mouse");
  const hiddenAt = useRef<{ x: number; y: number } | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  // Tells a first-time visitor, once, that the controls can be hidden. Read after
  // mounting, since the server cannot know what this browser has seen.
  useEffect(() => {
    if (hasSeenViewerHint()) return;
    markViewerHintSeen();
    const touch = window.matchMedia?.("(hover: none)").matches ?? false;
    queueMicrotask(() =>
      setHint(
        touch
          ? "Tap the photo to hide or show the controls"
          : "Click the photo to hide the controls; move the mouse to bring them back",
      ),
    );
  }, []);

  const fetchPhoto = useCallback(
    () => getPhoto.execute(photoId),
    [getPhoto, photoId],
  );
  const fetchAll = useCallback(() => (getAllPhotos ?? getPhotoNeighbors(photoId)).execute(), [getAllPhotos, photoId]);
  const {
    data: photo,
    loading,
    error,
    retry,
  } = usePhotoFetch(fetchPhoto, "Photo not found");
  const { data: all } = usePhotoFetch(fetchAll, "No photos found");

  const index = all ? all.findIndex((entry) => entry.getId() === photoId) : -1;
  const previousId = all && index > 0 ? all[index - 1].getId() : null;
  const nextId =
    all && index >= 0 && index < all.length - 1 ? all[index + 1].getId() : null;

  const go = useCallback(
    (id: string | null) => {
      if (id) router.push(photoHref(id));
    },
    [router],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") go(previousId);
      else if (event.key === "ArrowRight") go(nextId);
      // Escape closes the panel first, and only then leaves the photo.
      else if (event.key === "Escape") {
        if (panelOpen) setViewerPanelOpen(false);
        else router.push("/gallery");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, previousId, nextId, router, panelOpen]);

  const show = () => {
    hiddenAt.current = null;
    setControlsVisible(true);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === "touch" || controlsVisible) return;
    const from = hiddenAt.current;
    if (
      from &&
      Math.hypot(event.clientX - from.x, event.clientY - from.y) <
        REVEAL_DISTANCE
    )
      return;
    show();
  };

  const onPointerDown = (event: PointerEvent) => {
    lastPointerType.current = event.pointerType || "mouse";
    // Scrolling or selecting text in the panel is not a swipe.
    if (insidePanel(event.target)) {
      swipeStart.current = null;
      return;
    }
    swipeStart.current = { x: event.clientX, y: event.clientY };
    swiped.current = false;
  };

  const onPointerUp = (event: PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy)) return;
    swiped.current = true;
    go(dx > 0 ? previousId : nextId);
  };

  // Clicks on the edges, the back arrow, the buttons or the panel do their own job.
  const onClick = (event: MouseEvent) => {
    if (
      (event.target as Element).closest("a, button") ||
      insidePanel(event.target)
    )
      return;
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    if (lastPointerType.current === "touch") {
      setControlsVisible((visible) => !visible);
      return;
    }
    hiddenAt.current = { x: event.clientX, y: event.clientY };
    setControlsVisible(false);
    setHint(null);
  };

  const frame = photo?.getFrame() ?? null;
  const layout = photo ? framedLayout(photo.getAspectRatio(), frame) : null;
  const fade = `transition-opacity duration-300 ${controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"}`;

  return (
    <main
      data-controls={controlsVisible ? "visible" : "hidden"}
      className={`flex h-dvh flex-col overflow-hidden bg-neutral-950 text-neutral-100 md:flex-row ${controlsVisible ? "" : "cursor-none"}`}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onClick={onClick}
      onFocusCapture={show}
    >
      {/* The photo's own area. It shrinks to make room for the panel, and the photo fits
          inside it (container units), so the panel never covers the photo or its frame. */}
      <div className="photo-viewer__stage touch-pan-y select-none">
        <PhotoFetchStatus loading={loading} error={error} onRetry={retry} />

        {photo && layout && (
          <figure
            className="relative m-0"
            style={{
              width: `min(100cqw - 2rem, calc((100cqh - 2rem) / ${layout.heightPerWidth}))`,
            }}
          >
            <div
              data-testid="photo-frame"
              style={{
                background: frame?.color,
                padding: `${layout.paddingY}% ${layout.paddingX}%`,
              }}
            >
              <ViewerImage photo={photo} quality={quality} />
            </div>
            <figcaption
              data-position={photo.getTitlePosition()}
              className={`photo-viewer__title ${TITLE_CORNER_CLASS[photo.getTitlePosition()]} ${fade}`}
            >
              {photo.getTitle()}
            </figcaption>
          </figure>
        )}

        <Link
          href="/gallery"
          aria-label="Back to gallery"
          // The panel follows the visitor between photos, not back into the gallery.
          onClick={() => setViewerPanelOpen(false)}
          className={`photo-viewer__control absolute left-4 top-4 z-20 ${fade}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
            <path
              d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>

        <button
          type="button"
          aria-label={
            panelOpen ? "Hide photo information" : "Show photo information"
          }
          aria-expanded={panelOpen}
          onClick={() => setViewerPanelOpen(!panelOpen)}
          className={`photo-viewer__control absolute right-4 top-4 z-20 ${fade}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
            <circle
              cx="12"
              cy="12"
              r="9"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M12 11v6M12 7.5v.01"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {previousId && (
          <Link
            href={photoHref(previousId)}
            rel="prev"
            aria-label="Previous photo"
            className="photo-viewer__edge left-0 justify-start"
          >
            <EdgeArrow direction="left" className={fade} />
          </Link>
        )}
        {nextId && (
          <Link
            href={photoHref(nextId)}
            rel="next"
            aria-label="Next photo"
            className="photo-viewer__edge right-0 justify-end"
          >
            <EdgeArrow direction="right" className={fade} />
          </Link>
        )}

        {hint && (
          <p
            role="status"
            className="photo-viewer__hint"
            onAnimationEnd={() => setHint(null)}
          >
            {hint}
          </p>
        )}

        <div className={fade}>
          {all && <ViewerVariants photoId={photoId} photos={all} />}
          <QualitySelector quality={quality} onChange={setQuality} />
        </div>
      </div>

      {/* Beside the photo on wide screens and below it on phones. It stays put when the
          controls hide: it is not over the photo, and hiding it would resize the photo. */}
      {panelOpen &&
        (photo ? (
          <PhotoInfoPanel
            photo={photo}
            onClose={() => setViewerPanelOpen(false)}
          />
        ) : (
          // Holds the panel's place while the next photo loads, so nothing jumps.
          <aside
            aria-label="Photo information"
            aria-busy="true"
            className="photo-viewer__panel"
          />
        ))}
    </main>
  );
}

function EdgeArrow({
  direction,
  className,
}: {
  direction: "left" | "right";
  className: string;
}) {
  return (
    <span className={`photo-viewer__control mx-3 ${className}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
        <path
          d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function insidePanel(target: EventTarget) {
  return (
    target instanceof Element && target.closest("[data-viewer-panel]") !== null
  );
}
