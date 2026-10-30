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

  // Reordering by pointer: a thumbnail is dragged from anywhere on it, follows the
  // pointer while the others make room, and lands where it is dropped.
  const {
    order: sortOrder,
    dragging,
    attachList,
    attachItem,
    itemStyle,
    gripProps,
    takeDrop,
  } = useLiveSort({
    keys: slides.map((slide) => slide.photoId),
    onMove: moveTo,
    disabled,
  });
  // The slide in the detail is the one last picked in the strip, until the preview
  // shows another one; then it follows the preview.
  const [picked, setPicked] = useState<{ id: string; active?: string }>();
  const isSlide = (id?: string) =>
    Boolean(id && slides.some((slide) => slide.photoId === id));
  const preferred =
    picked && picked.active === activePhotoId ? picked.id : activePhotoId;
  const selectedId = isSlide(preferred)
    ? preferred
    : isSlide(picked?.id)
      ? picked!.id
      : slides[0]?.photoId;
  const pick = (photoId: string) => {
    setPicked({ id: photoId, active: activePhotoId });
    onFocusSlide?.(photoId);
  };
  const remove = (photoId: string) => {
    onChange(slides.filter((slide) => slide.photoId !== photoId));
    setAnnouncement(`${titleOf(photoId)} removed from Home.`);
  };
  const hiddenFromHome = (photoId: string) => {
    const photo = photoOf(photoId);
    return Boolean(photo && enabledPhotoViews(photo, "home").length === 0);
  };
  const position = slides.findIndex((slide) => slide.photoId === selectedId);
  const selected = slides[position];

  return (
    <section className="slide-studio" aria-label="Home slides">
      <header className="slide-studio__header">
        <div>
          <h3>Slides</h3>
          <p>
            {slides.length
              ? "Home shows these photographs, in this order. Drag a thumbnail to reorder; click it to edit."
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
        <>
          <ol
            ref={attachList}
            className={`slide-strip${dragging ? " is-sorting" : ""}`}
            aria-label="Slide order"
          >
            {sortOrder.map((photoId, index) => {
              const photo = photoOf(photoId);
              const title = titleOf(photoId);
              return (
                <li
                  key={photoId}
                  ref={attachItem(photoId)}
                  className={`slide-strip__item${dragging === photoId ? " is-dragged" : ""}${selectedId === photoId ? " is-selected" : ""}`}
                  style={itemStyle(photoId)}
                >
                  <button
                    type="button"
                    className="slide-strip__thumb"
                    disabled={disabled}
                    aria-pressed={selectedId === photoId}
                    aria-label={`Slide ${index + 1} of ${slides.length}: ${title}`}
                    title="Click to edit · drag or arrow keys to reorder"
                    {...gripProps(photoId)}
                    onClick={() => {
                      if (takeDrop()) return;
                      pick(photoId);
                    }}
                  >
                    {photo ? (
                      <PhotoImage
                        photo={photo}
                        crop={photo.getHighlights().landscape}
                        className="object-cover"
                        maxWidth={320}
                        fallbackSizes="132px"
                      />
                    ) : (
                      <span className="slide-strip__initial" aria-hidden="true">
                        {title.slice(0, 1)}
                      </span>
                    )}
                    <span className="slide-strip__number" aria-hidden="true">
                      {index + 1}
                    </span>
                    {hiddenFromHome(photoId) && (
                      <span
                        className="slide-strip__warn"
                        aria-hidden="true"
                        title="Not enabled for Home"
                      >
                        !
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="slide-strip__remove"
                    disabled={disabled}
                    aria-label={`Remove ${title} from Home`}
                    title="Remove from Home"
                    onClick={() => remove(photoId)}
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                </li>
              );
            })}
          </ol>
          {selected && (
            <SlideDetail
              key={selected.photoId}
              slide={selected}
              position={position}
              count={slides.length}
              title={titleOf(selected.photoId)}
              hiddenFromHome={hiddenFromHome(selected.photoId)}
              general={general}
              catalog={catalog}
              disabled={disabled}
              onChange={(patch) => update(position, patch)}
              onMove={(to) => moveTo(position, to)}
              onRemove={() => remove(selected.photoId)}
              onOwnTitle={() => onFocusSlide?.(selected.photoId)}
            />
          )}
        </>
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

// The chosen slide: its words, where it leads, its place in the order and whether it
// shows the general title or one of its own. It stays in place while the strip above
// is rearranged.
function SlideDetail({
  slide,
  position,
  count,
  title,
  hiddenFromHome,
  general,
  catalog,
  disabled,
  onChange,
  onMove,
  onRemove,
  onOwnTitle,
}: {
  slide: Slides[number];
  position: number;
  count: number;
  title: string;
  hiddenFromHome: boolean;
  general?: SlideHeading;
  catalog: Parameters<typeof SlideDestination>[0]["catalog"];
  disabled?: boolean;
  onChange: (patch: Partial<Slides[number]>) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
  onOwnTitle: () => void;
}) {
  return (
    <section
      className="slide-detail"
      aria-label={`Slide ${position + 1}: ${title}`}
    >
      <header className="slide-detail__bar">
        <h4>
          <span className="slide-detail__position">
            Slide {position + 1} of {count}
          </span>
          {title}
        </h4>
        <div className="slide-detail__tools">
          <button
            type="button"
            disabled={disabled || position === 0}
            aria-label={`Move ${title} earlier`}
            title="Move earlier"
            onClick={() => onMove(position - 1)}
          >
            ←
          </button>
          <button
            type="button"
            disabled={disabled || position === count - 1}
            aria-label={`Move ${title} later`}
            title="Move later"
            onClick={() => onMove(position + 1)}
          >
            →
          </button>
          <button
            type="button"
            className="slide-detail__remove"
            disabled={disabled}
            onClick={onRemove}
          >
            Remove
          </button>
        </div>
      </header>
      {hiddenFromHome && (
        <p className="slide-detail__warning">
          Not enabled for Home: allow a framing for Home in Photos, or it is
          skipped.
        </p>
      )}
      <div className="slide-detail__fields">
        <label>
          Slide title
          <input
            maxLength={200}
            disabled={disabled}
            value={slide.text}
            aria-label={`Title for ${title}`}
            onChange={(e) => onChange({ text: e.target.value })}
          />
        </label>
        <SlideDestination
          compact
          photoId={slide.photoId}
          href={slide.href}
          catalog={catalog}
          onChange={(href) => onChange({ href })}
        />
      </div>
      <fieldset className="slide-heading" disabled={disabled}>
        <legend>Welcome title on this slide</legend>
        <div className="slide-heading__switch">
          <button
            type="button"
            aria-pressed={!slide.heading}
            onClick={() => onChange({ heading: undefined })}
          >
            General title
          </button>
          <button
            type="button"
            aria-pressed={Boolean(slide.heading)}
            disabled={!slide.heading && !general}
            onClick={() => {
              if (slide.heading) return;
              onChange({ heading: { ...general! } });
              onOwnTitle();
            }}
          >
            Own title
          </button>
        </div>
        {slide.heading ? (
          <SlideHeadingFields
            heading={slide.heading}
            general={general}
            photoId={slide.photoId}
            catalog={catalog}
            disabled={disabled}
            onChange={(heading) => onChange({ heading })}
          />
        ) : (
          <p className="slide-heading__empty">
            This slide shows the general Welcome title. Choose Own title to give
            it words, a link and a place of its own.
          </p>
        )}
      </fieldset>
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
  onChange: (heading: SlideHeading) => void;
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
      </div>
    </div>
  );
}
