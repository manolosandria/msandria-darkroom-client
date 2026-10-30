"use client";
import { useEffect, useState } from "react";
import { HomeBanner, SlideHeading } from "@/src/domain/entities/HomeBanner";
import { Photo } from "@/src/domain/entities/Photo";
import { getManagedPhotos } from "@/src/infrastructure/photoServices";
import { GetAllPhotos } from "@/src/application/use-cases/GetAllPhotos";
import { enabledPhotoViews } from "@/src/domain/photoPresentation";
import { PhotoImage } from "./PhotoImage";
import { useLiveSort } from "../hooks/useLiveSort";
import { SlideDestination, useSlideCatalog } from "./BannerSlideLink";

type Slides = NonNullable<HomeBanner["slides"]>;
const MAX_SLIDES = 8;
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

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
  general,
}: {
  slides: Slides;
  onChange: (slides: Slides) => void;
  disabled?: boolean;
  getPhotos?: Pick<GetAllPhotos, "execute">;
  /** The slide shown in the preview, marked among the cards. */
  activePhotoId?: string;
  /** Asks the preview to show a slide. */
  onFocusSlide?: (photoId: string) => void;
  /** The general title and its placement, which a slide's own title starts from. */
  general?: SlideHeading;
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

  // Reordering by pointer: the card follows the grip and the others make room as it
  // passes over them; it lands where it is dropped.
  const {
    order: sortOrder,
    dragging: sortDragging,
    attachList,
    attachItem,
    itemStyle,
    gripProps,
  } = useLiveSort({
    keys: slides.map((slide) => slide.photoId),
    onMove: moveTo,
    disabled,
  });
  const dragging = sortDragging;

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
        <span
          className="slide-studio__count"
          aria-label={`${slides.length} of ${MAX_SLIDES} slides`}
        >
          {slides.length}/{MAX_SLIDES}
        </span>
      </header>
      {catalogError && <p role="alert">{catalogError}</p>}
      {slides.length > 0 ? (
        <ol
          ref={attachList}
          className={`slide-studio__cards${dragging ? " is-sorting" : ""}`}
        >
          {sortOrder.map((photoId, index) => {
            const slide = slides.find((item) => item.photoId === photoId)!;
            const position = slides.indexOf(slide);
            const photo = photoOf(slide.photoId);
            const title = titleOf(slide.photoId);
            const hiddenFromHome =
              photo && enabledPhotoViews(photo, "home").length === 0;
            const isDragged = dragging === slide.photoId;
            return (
              <li
                key={slide.photoId}
                ref={attachItem(slide.photoId)}
                data-slide-card
                className={`slide-card${isDragged ? " is-dragged" : ""}${activePhotoId === slide.photoId ? " is-active" : ""}`}
                style={itemStyle(slide.photoId)}
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
                    {...gripProps(slide.photoId)}
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
                      onChange(slides.filter((_, other) => other !== position));
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
                    onChange={(e) => update(position, { text: e.target.value })}
                  />
                </label>
                <SlideDestination
                  compact
                  photoId={slide.photoId}
                  href={slide.href}
                  catalog={catalog}
                  onChange={(href) => update(position, { href })}
                />
                <details className="slide-heading">
                  <summary>
                    Own title
                    {slide.heading && (
                      <span className="slide-heading__on">on</span>
                    )}
                  </summary>
                  {slide.heading ? (
                    <SlideHeadingFields
                      heading={slide.heading}
                      general={general}
                      photoId={slide.photoId}
                      catalog={catalog}
                      disabled={disabled}
                      onChange={(heading) => update(position, { heading })}
                    />
                  ) : (
                    <p className="slide-heading__empty">
                      Shows the general title.{" "}
                      <button
                        type="button"
                        disabled={disabled || !general}
                        onClick={() => {
                          update(position, { heading: { ...general! } });
                          onFocusSlide?.(slide.photoId);
                        }}
                      >
                        Give it its own
                      </button>
                    </p>
                  )}
                </details>
                <div className="slide-card__order">
                  <button
                    type="button"
                    disabled={disabled || position === 0}
                    aria-label={`Move ${title} earlier`}
                    onClick={() => moveTo(position, position - 1)}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={disabled || position === slides.length - 1}
                    aria-label={`Move ${title} later`}
                    onClick={() => moveTo(position, position + 1)}
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
                  title={
                    full ? "Remove a slide first" : `Add ${photo.getTitle()}`
                  }
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

// The fields of a slide's own title; where it sits is set by dragging it in the preview.
function SlideHeadingFields({
  heading,
  general,
  photoId,
  catalog,
  disabled,
  onChange,
}: {
  heading: SlideHeading;
  general?: SlideHeading;
  photoId: string;
  catalog: Parameters<typeof SlideDestination>[0]["catalog"];
  disabled?: boolean;
  onChange: (heading: SlideHeading | undefined) => void;
}) {
  const set = (patch: Partial<SlideHeading>) =>
    onChange({ ...heading, ...patch });
  const text = (
    key: "eyebrow" | "title" | "accentText" | "linkText",
    label: string,
    maxLength: number,
  ) => (
    <label>
      {label}
      <input
        value={heading[key]}
        maxLength={maxLength}
        disabled={disabled}
        onChange={(event) => set({ [key]: event.target.value })}
      />
    </label>
  );
  return (
    <div className="slide-heading__fields">
      {text("eyebrow", "Eyebrow", 120)}
      {text("title", "Title", 200)}
      {text("accentText", "Accent text", 200)}
      {text("linkText", "Link text", 80)}
      <SlideDestination
        compact
        photoId={photoId}
        href={heading.href}
        catalog={catalog}
        onChange={(href) => set({ href })}
      />
      <label>
        Title size · {heading.fontSize}px
        <input
          type="range"
          min={24}
          max={96}
          value={heading.fontSize}
          disabled={disabled}
          onChange={(event) => set({ fontSize: Number(event.target.value) })}
        />
      </label>
      <p className="slide-heading__hint">
        Drag it in the preview to move it; its edge and corner resize it.
      </p>
      <div className="slide-heading__actions">
        <button
          type="button"
          disabled={disabled || !general}
          onClick={() =>
            set({
              position: general!.position,
              x: general!.x,
              y: general!.y,
              width: general!.width,
            })
          }
        >
          Same place as the general title
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(undefined)}
        >
          Use the general title
        </button>
      </div>
    </div>
  );
}
