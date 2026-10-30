"use client";
import { KeyboardEvent, PointerEvent, useEffect, useRef, useState } from "react";
import { HomeBanner } from "@/src/domain/entities/HomeBanner";
import { Photo } from "@/src/domain/entities/Photo";
import { getManagedPhotos } from "@/src/infrastructure/photoServices";
import { GetAllPhotos } from "@/src/application/use-cases/GetAllPhotos";
import { enabledPhotoViews } from "@/src/domain/photoPresentation";
import { PhotoImage } from "./PhotoImage";
import { SlideDestination, useSlideCatalog } from "./BannerSlideLink";

type Slides = NonNullable<HomeBanner["slides"]>;
const MAX_SLIDES = 8;
const fold = (text: string) =>
  text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// The photographs Home shows, in order, managed like a collection: thumbnails to add,
// cards to drag into order, and a title and link per slide. With none, Home picks
// eligible photos at random. Only public photos are offered: visitors cannot see the
// others.
export function BannerSlideList({
  slides,
  onChange,
  disabled,
  getPhotos = getManagedPhotos,
  activePhotoId,
  onFocusSlide,
}: {
  slides: Slides;
  onChange: (slides: Slides) => void;
  disabled?: boolean;
  getPhotos?: Pick<GetAllPhotos, "execute">;
  /** The slide shown in the preview, marked among the cards. */
  activePhotoId?: string;
  /** Asks the preview to show a slide. */
  onFocusSlide?: (photoId: string) => void;
}) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const { catalog, error: catalogError } = useSlideCatalog();
  useEffect(() => {
    let active = true;
    void getPhotos
      .execute()
      .then((value) => {
        if (active) setPhotos(value ?? []);
      })
      .catch(() => {
        if (active) setError("Photographs could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [getPhotos]);
  const photoOf = (id: string) => photos?.find((photo) => photo.getId() === id);
  const titleOf = (id: string) => photoOf(id)?.getTitle() ?? id;
  const full = slides.length >= MAX_SLIDES;
  const available = (photos ?? []).filter(
    (photo) =>
      photo.getClassification().visibility === "PUBLIC" &&
      !slides.some((slide) => slide.photoId === photo.getId()) &&
      fold(photo.getTitle()).includes(fold(search.trim())),
  );
  const moveTo = (from: number, to: number) => {
    if (from === to || to < 0 || to >= slides.length) return;
    const next = [...slides];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
    setAnnouncement(
      `${titleOf(item.photoId)} moved to position ${to + 1} of ${slides.length}.`,
    );
  };
  const add = (photo: Photo) => {
    if (full || disabled) return;
    onChange([
      ...slides,
      {
        photoId: photo.getId(),
        text: photo.getTitle(),
        href: `/photo/${encodeURIComponent(photo.getId())}`,
      },
    ]);
    setAnnouncement(`${photo.getTitle()} added to Home.`);
    onFocusSlide?.(photo.getId());
  };
  const update = (index: number, patch: Partial<Slides[number]>) =>
    onChange(
      slides.map((slide, other) =>
        other === index ? { ...slide, ...patch } : slide,
      ),
    );

  // Reordering by pointer: the grip captures the pointer, the card follows it and the
  // nearest slot (by card centre) shows where it will land.
  const list = useRef<HTMLOListElement>(null);
  const drag = useRef<{ from: number; x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState<{
    from: number;
    to: number;
    dx: number;
    dy: number;
  } | null>(null);
  const slotAt = (x: number, y: number) => {
    const cards = Array.from(
      list.current?.querySelectorAll<HTMLElement>("[data-slide-card]") ?? [],
    );
    let best = 0,
      distance = Infinity;
    cards.forEach((card, index) => {
      const r = card.getBoundingClientRect();
      const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
      if (d < distance) {
        distance = d;
        best = index;
      }
    });
    return best;
  };
  const grip = (index: number) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (disabled || event.button !== 0) return;
      drag.current = { from: index, x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDragging({ from: index, to: index, dx: 0, dy: 0 });
    },
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      const start = drag.current;
      if (!start) return;
      setDragging({
        from: start.from,
        to: slotAt(event.clientX, event.clientY),
        dx: event.clientX - start.x,
        dy: event.clientY - start.y,
      });
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      const start = drag.current;
      drag.current = null;
      setDragging(null);
      if (start) moveTo(start.from, slotAt(event.clientX, event.clientY));
    },
    onPointerCancel: () => {
      drag.current = null;
      setDragging(null);
    },
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      const step = (
        { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 } as Record<
          string,
          number
        >
      )[event.key];
      if (step && !disabled) {
        event.preventDefault();
        moveTo(index, index + step);
      }
    },
  });

  return (
    <section className="slide-studio" aria-label="Home slides">
      <header className="slide-studio__header">
        <div>
          <h3>Slides</h3>
          <p>
            {slides.length
              ? "Home shows these photographs, in this order. Drag a card by its grip to reorder."
              : "No slides yet: Home shows up to eight eligible photographs at random."}
          </p>
        </div>
        <span className="slide-studio__count" aria-label={`${slides.length} of ${MAX_SLIDES} slides`}>
          {slides.length}/{MAX_SLIDES}
        </span>
      </header>
      {catalogError && <p role="alert">{catalogError}</p>}
      {slides.length > 0 ? (
        <ol
          ref={list}
          className={`slide-studio__cards${dragging ? " is-sorting" : ""}`}
        >
          {slides.map((slide, index) => {
            const photo = photoOf(slide.photoId);
            const title = titleOf(slide.photoId);
            const hiddenFromHome =
              photo && enabledPhotoViews(photo, "home").length === 0;
            const isDragged = dragging?.from === index;
            const isTarget =
              dragging && dragging.to === index && dragging.from !== index;
            return (
              <li
                key={slide.photoId}
                data-slide-card
                className={`slide-card${isDragged ? " is-dragged" : ""}${isTarget ? " is-target" : ""}${activePhotoId === slide.photoId ? " is-active" : ""}`}
                style={
                  isDragged
                    ? {
                        transform: `translate(${dragging.dx}px, ${dragging.dy}px) rotate(1.5deg)`,
                      }
                    : undefined
                }
              >
                <div className="slide-card__media">
                  <button
                    type="button"
                    className="slide-card__thumb"
                    aria-label={`Show ${title} in the preview`}
                    onClick={() => onFocusSlide?.(slide.photoId)}
                  >
                    {photo ? (
                      <PhotoImage
                        photo={photo}
                        crop={photo.getHighlights().landscape}
                        className="object-cover"
                        maxWidth={320}
                        fallbackSizes="220px"
                      />
                    ) : (
                      <span aria-hidden="true">{title.slice(0, 1)}</span>
                    )}
                  </button>
                  <span className="slide-card__number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    className="slide-card__grip"
                    disabled={disabled}
                    aria-label={`Reorder ${title}, position ${index + 1} of ${slides.length}`}
                    title="Drag to reorder · arrow keys move it"
                    {...grip(index)}
                  >
                    <span aria-hidden="true">⠿</span>
                  </button>
                  <button
                    type="button"
                    className="slide-card__remove"
                    disabled={disabled}
                    aria-label={`Remove ${title} from Home`}
                    title="Remove from Home"
                    onClick={() => {
                      onChange(slides.filter((_, other) => other !== index));
                      setAnnouncement(`${title} removed from Home.`);
                    }}
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                </div>
                {hiddenFromHome && (
                  <p className="slide-card__warning">
                    Not enabled for Home: allow a framing for Home in Photos, or
                    it is skipped.
                  </p>
                )}
                <label>
                  Slide title
                  <input
                    maxLength={200}
                    disabled={disabled}
                    value={slide.text}
                    aria-label={`Title for ${title}`}
                    onChange={(e) => update(index, { text: e.target.value })}
                  />
                </label>
                <SlideDestination
                  compact
                  photoId={slide.photoId}
                  href={slide.href}
                  catalog={catalog}
                  onChange={(href) => update(index, { href })}
                />
                <div className="slide-card__order">
                  <button
                    type="button"
                    disabled={disabled || index === 0}
                    aria-label={`Move ${title} earlier`}
                    onClick={() => moveTo(index, index - 1)}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={disabled || index === slides.length - 1}
                    aria-label={`Move ${title} later`}
                    onClick={() => moveTo(index, index + 1)}
                  >
                    →
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="slide-studio__empty">
          Pick photographs below to choose exactly what Home shows.
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="slide-studio__library">
        <div className="slide-studio__library-bar">
          <h4>{full ? "Eight slides chosen" : "Add photographs"}</h4>
          <label>
            <span className="sr-only">Search public photographs</span>
            <input
              type="search"
              placeholder="Search by title"
              value={search}
              disabled={!photos}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        {!photos ? (
          <p>{error ? "" : "Loading photographs…"}</p>
        ) : available.length ? (
          <ul className="slide-studio__strip">
            {available.map((photo) => (
              <li key={photo.getId()}>
                <button
                  type="button"
                  disabled={disabled || full}
                  aria-label={`Add ${photo.getTitle()} to Home`}
                  title={full ? "Remove a slide first" : `Add ${photo.getTitle()}`}
                  onClick={() => add(photo)}
                >
                  <span className="slide-studio__strip-thumb">
                    <PhotoImage
                      photo={photo}
                      crop={photo.getHighlights().square}
                      className="object-cover"
                      maxWidth={160}
                      fallbackSizes="96px"
                    />
                    <span className="slide-studio__plus" aria-hidden="true">
                      +
                    </span>
                  </span>
                  <span className="slide-studio__strip-title">
                    {photo.getTitle()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {search
              ? "No public photograph matches that title."
              : "Every public photograph is already a slide."}
          </p>
        )}
        <p className="slide-studio__note">
          Only public photographs are offered: visitors cannot see the others.
        </p>
      </div>
    </section>
  );
}
