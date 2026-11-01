"use client";
import { useEffect, useState } from "react";
import { HomeBanner } from "@/src/domain/entities/HomeBanner";
import { Catalog } from "@/src/domain/entities/Catalog";
import { editCatalog } from "@/src/infrastructure/catalogServices";
import { ChoiceMenu } from "./ChoiceMenu";

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
          setError(
            "Catalog unavailable. Category and collection links are off.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  return { catalog, error };
}

const line = (d: string) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
);
// A small drawing for each kind of destination, on the menu and its button.
const destinationIcons = {
  photo: line("M3 5h14v10H3zM3 13l4-4 3 3 2-2 5 5"),
  gallery: line("M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z"),
  category: line("M3 10V3h7l7 7-7 7zM7 7h.01"),
  collection: line("M5 6h10v11H5zM7 3h6M6 4.5h8"),
  external: line("M11 3h6v6M17 3l-8 8M14 12v5H3V6h5"),
};

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
    <div
      className={`slide-destination${compact ? " slide-destination--compact" : ""}`}
    >
      <label>
        Link destination
        <ChoiceMenu
          value={kind}
          onChange={(next) =>
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
              )[next],
            )
          }
          options={[
            {
              value: "photo",
              label: "This photograph",
              icon: destinationIcons.photo,
            },
            {
              value: "gallery",
              label: "Gallery",
              icon: destinationIcons.gallery,
            },
            {
              value: "category",
              label: "Gallery category",
              icon: destinationIcons.category,
              disabled: !catalog?.categories.length,
            },
            {
              value: "collection",
              label: "Collection",
              icon: destinationIcons.collection,
              disabled: !catalog?.collections.length,
            },
            {
              value: "external",
              label: "External website",
              description: "An HTTPS address",
              icon: destinationIcons.external,
            },
          ]}
        />
      </label>
      {kind === "category" && (
        <label>
          Category
          <ChoiceMenu
            value={query.get("category") ?? ""}
            onChange={(next) =>
              onChange(`/gallery?category=${encodeURIComponent(next)}`)
            }
            options={(catalog?.categories ?? []).map((item) => ({
              value: item.id,
              label: item.name,
            }))}
          />
        </label>
      )}
      {kind === "collection" && (
        <label>
          Collection
          <ChoiceMenu
            value={query.get("collection") ?? ""}
            onChange={(next) =>
              onChange(`/collections?collection=${encodeURIComponent(next)}`)
            }
            options={(catalog?.collections ?? []).map((item) => ({
              value: item.id,
              label: item.title,
            }))}
          />
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
