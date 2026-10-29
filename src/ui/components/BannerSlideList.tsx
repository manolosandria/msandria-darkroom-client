"use client";
import { useEffect, useState } from "react";
import { HomeBanner } from "@/src/domain/entities/HomeBanner";
import { Photo } from "@/src/domain/entities/Photo";
import { getManagedPhotos } from "@/src/infrastructure/photoServices";
import { GetAllPhotos } from "@/src/application/use-cases/GetAllPhotos";

type Slides = NonNullable<HomeBanner["slides"]>;
const MAX_SLIDES = 8;

// The photographs Home shows, in order. With none, Home picks eligible photos at random.
// Only public photos are offered: visitors cannot see the others.
export function BannerSlideList({
  slides,
  onChange,
  disabled,
  getPhotos = getManagedPhotos,
}: {
  slides: Slides;
  onChange: (slides: Slides) => void;
  disabled?: boolean;
  getPhotos?: Pick<GetAllPhotos, "execute">;
}) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [error, setError] = useState("");
  const [choice, setChoice] = useState("");
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
  const titleOf = (id: string) =>
    photos?.find((photo) => photo.getId() === id)?.getTitle() ?? id;
  const available = (photos ?? []).filter(
    (photo) =>
      photo.getClassification().visibility === "PUBLIC" &&
      !slides.some((slide) => slide.photoId === photo.getId()),
  );
  const move = (index: number, step: number) => {
    const next = [...slides];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    onChange(next);
  };
  const add = () => {
    const photo = available.find((item) => item.getId() === choice);
    if (!photo || slides.length >= MAX_SLIDES) return;
    onChange([
      ...slides,
      {
        photoId: photo.getId(),
        text: photo.getTitle(),
        href: `/photo/${encodeURIComponent(photo.getId())}`,
      },
    ]);
    setChoice("");
  };
  return (
    <div className="banner-slide-list">
      <p>
        {slides.length
          ? "Home shows these photographs, in this order."
          : "No slides yet: Home shows up to eight eligible photographs at random."}
      </p>
      {slides.length > 0 && (
        <ol>
          {slides.map((slide, index) => (
            <li key={slide.photoId}>
              <span>{titleOf(slide.photoId)}</span>
              <button
                type="button"
                disabled={disabled || index === 0}
                aria-label={`Move ${titleOf(slide.photoId)} earlier`}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={disabled || index === slides.length - 1}
                aria-label={`Move ${titleOf(slide.photoId)} later`}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${titleOf(slide.photoId)} from Home`}
                onClick={() =>
                  onChange(slides.filter((_, other) => other !== index))
                }
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
      )}
      {error && <p role="alert">{error}</p>}
      {slides.length < MAX_SLIDES && (
        <div className="banner-slide-list__add">
          <label>
            Add photograph
            <select
              disabled={disabled || !photos}
              value={choice}
              onChange={(event) => setChoice(event.target.value)}
            >
              <option value="">
                {photos ? "Choose a public photograph" : "Loading…"}
              </option>
              {available.map((photo) => (
                <option key={photo.getId()} value={photo.getId()}>
                  {photo.getTitle()}
                </option>
              ))}
            </select>
          </label>
          <button type="button" disabled={disabled || !choice} onClick={add}>
            Add to Home
          </button>
        </div>
      )}
    </div>
  );
}
