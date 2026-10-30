"use client";
import { useEffect, useState } from "react";
import { HomeBanner } from "@/src/domain/entities/HomeBanner";
import { Catalog } from "@/src/domain/entities/Catalog";
import { editCatalog } from "@/src/infrastructure/catalogServices";

type Slide = NonNullable<HomeBanner["slides"]>[number];

// Categories and collections a slide can link to. Loaded once per editor.
export function useSlideCatalog() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void editCatalog
      .load()
      .then((value) => {
        if (active) setCatalog(value);
      })
      .catch(() => {
        if (active)
          setError("Catalog unavailable. Category and collection links are off.");
      });
    return () => {
      active = false;
    };
  }, []);
  return { catalog, error };
}

const destinationKind = (href: string) =>
  href.startsWith("https:")
    ? "external"
    : href.startsWith("/collections")
      ? "collection"
      : href.includes("?category=")
        ? "category"
        : href === "/gallery"
          ? "gallery"
          : "photo";

/** Where a slide's title leads: the photo, Gallery, a category, a collection or HTTPS. */
export function SlideDestination({
  photoId,
  href,
  catalog,
  onChange,
  compact = false,
}: {
  photoId: string;
  href: string;
  catalog: Catalog | null;
  onChange: (href: string) => void;
  compact?: boolean;
}) {
  const kind = destinationKind(href);
  const query = new URLSearchParams(href.split("?")[1]);
  return (
    <div className={`slide-destination${compact ? " slide-destination--compact" : ""}`}>
      <label>
        Link destination
        <select
          value={kind}
          onChange={(e) =>
            onChange(
              (
                {
                  photo: `/photo/${photoId}`,
                  gallery: "/gallery",
                  category: catalog?.categories[0]
                    ? `/gallery?category=${encodeURIComponent(catalog.categories[0].id)}`
                    : "/gallery",
                  collection: catalog?.collections[0]
                    ? `/collections?collection=${encodeURIComponent(catalog.collections[0].id)}`
                    : "/collections",
                  external: "https://www.instagram.com/",
                } as Record<string, string>
              )[e.target.value],
            )
          }
        >
          <option value="photo">This photograph</option>
          <option value="gallery">Gallery</option>
          <option value="category" disabled={!catalog?.categories.length}>
            Gallery category
          </option>
          <option value="collection" disabled={!catalog?.collections.length}>
            Collection
          </option>
          <option value="external">External website (HTTPS)</option>
        </select>
      </label>
      {kind === "category" && (
        <label>
          Category
          <select
            value={query.get("category") ?? ""}
            onChange={(e) =>
              onChange(`/gallery?category=${encodeURIComponent(e.target.value)}`)
            }
          >
            {catalog?.categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {kind === "collection" && (
        <label>
          Collection
          <select
            value={query.get("collection") ?? ""}
            onChange={(e) =>
              onChange(
                `/collections?collection=${encodeURIComponent(e.target.value)}`,
              )
            }
          >
            {catalog?.collections.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {kind === "external" && (
        <label>
          HTTPS URL
          <input
            type="url"
            value={href}
            maxLength={2000}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      )}
    </div>
  );
}

export function BannerSlideLink({
  photoId,
  title,
  banner,
  onChange,
}: {
  photoId: string;
  title: string;
  banner: HomeBanner;
  onChange: (slides: NonNullable<HomeBanner["slides"]>) => void;
}) {
  const { catalog, error } = useSlideCatalog();
  const slide: Slide = banner.slides?.find(
    (item) => item.photoId === photoId,
  ) ?? {
    photoId,
    text: title,
    href: `/photo/${photoId}`,
  };
  // Slides are the carousel's order, so an edit keeps the slide where it is; a photo
  // that is not a slide yet joins at the end, up to eight.
  const update = (patch: Partial<Slide>) => {
    const slides = banner.slides ?? [];
    onChange(
      slides.some((item) => item.photoId === photoId)
        ? slides.map((item) =>
            item.photoId === photoId ? { ...slide, ...patch } : item,
          )
        : [...slides, { ...slide, ...patch }].slice(-8),
    );
  };
  return (
    <fieldset className="banner-slide-link">
      <legend>Slide title & link</legend>
      <label>
        Slide title
        <input
          maxLength={200}
          value={slide.text}
          onChange={(e) => update({ text: e.target.value })}
        />
      </label>
      <SlideDestination
        photoId={photoId}
        href={slide.href}
        catalog={catalog}
        onChange={(href) => update({ href })}
      />
      {error && <p role="alert">{error}</p>}
      <p>Destination: {slide.href}. Save banner to publish.</p>
    </fieldset>
  );
}
