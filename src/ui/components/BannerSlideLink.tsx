"use client";
import { useEffect, useState } from "react";
import { HomeBanner } from "@/src/domain/entities/HomeBanner";
import { Catalog } from "@/src/domain/entities/Catalog";
import { editCatalog } from "@/src/infrastructure/catalogServices";
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
          setError("Catalog unavailable. Retry by reopening photo settings.");
      });
    return () => {
      active = false;
    };
  }, []);
  const slide = banner.slides?.find((item) => item.photoId === photoId) ?? {
    photoId,
    text: title,
    href: `/photo/${photoId}`,
  };
  const kind = slide.href.startsWith("https:")
    ? "external"
    : slide.href.startsWith("/collections")
      ? "collection"
      : slide.href.includes("?category=")
        ? "category"
        : slide.href === "/gallery"
          ? "gallery"
          : "photo";
  // Slides are the carousel's order, so an edit keeps the slide where it is; a photo
  // that is not a slide yet joins at the end, up to eight.
  const update = (patch: Partial<typeof slide>) => {
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
      <legend>Slide text & destination</legend>
      <label>
        Caption text
        <input
          maxLength={200}
          value={slide.text}
          onChange={(e) => update({ text: e.target.value })}
        />
      </label>
      <label>
        Link destination
        <select
          value={kind}
          onChange={(e) =>
            update({
              href: (
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
            })
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
      {error && <p role="alert">{error}</p>}
      {kind === "category" && (
        <label>
          Category
          <select
            value={
              new URLSearchParams(slide.href.split("?")[1]).get("category") ??
              ""
            }
            onChange={(e) =>
              update({
                href: `/gallery?category=${encodeURIComponent(e.target.value)}`,
              })
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
            value={
              new URLSearchParams(slide.href.split("?")[1]).get("collection") ??
              ""
            }
            onChange={(e) =>
              update({
                href: `/collections?collection=${encodeURIComponent(e.target.value)}`,
              })
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
            value={slide.href}
            maxLength={2000}
            onChange={(e) => update({ href: e.target.value })}
          />
        </label>
      )}
      <p>Destination: {slide.href}. Save banner to publish.</p>
    </fieldset>
  );
}
