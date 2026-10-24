"use client";
import { useId, useState, useRef } from "react";
import { CatalogCategory } from "@/src/domain/entities/Catalog";
import { GallerySettings } from "@/src/domain/entities/GallerySettings";
import { groupGalleryCategories } from "./galleryCategoryGroups";
export function GalleryFilters({
  categories,
  settings,
  selected,
  onSelect,
}: {
  categories: CatalogCategory[];
  settings: GallerySettings;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const id = useId();
  const hovered = useRef<string | null>(null);
  const groups = groupGalleryCategories(categories, settings.categories);
  return (
    <section
      className="gallery-filters"
      aria-label="Gallery filters"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(null);
          (
            event.currentTarget.querySelector(
              `[data-open="true"]`,
            ) as HTMLButtonElement | null
          )?.focus();
        }
      }}
    >
      <button
        className="gallery-filter-button"
        aria-pressed={!selected}
        onClick={() => {
          onSelect("");
          setOpen(null);
        }}
      >
        All photographs
      </button>
      {groups.map((group, index) => {
        const active = group.categories.find(
          (category) => category.id === selected,
        );
        return (
          <div
            className="gallery-filter-group"
            key={group.label}
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") {
                hovered.current = group.label;
                setOpen(group.label);
              }
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") {
                hovered.current = null;
                setOpen(null);
              }
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                setOpen(null);
            }}
          >
            <button
              className="gallery-filter-button"
              data-open={open === group.label}
              aria-expanded={open === group.label}
              aria-controls={`${id}-${index}`}
              onClick={() =>
                setOpen(
                  hovered.current === group.label
                    ? group.label
                    : open === group.label
                      ? null
                      : group.label,
                )
              }
            >
              {group.label}
              {active ? ` · ${active.name}` : ""}{" "}
              <span aria-hidden="true">⌄</span>
            </button>
            <div
              id={`${id}-${index}`}
              className="gallery-filter-menu"
              hidden={open !== group.label}
              role="group"
              aria-label={group.label}
            >
              {group.categories.map((category) => (
                <button
                  className="gallery-filter-option"
                  key={category.id}
                  aria-pressed={selected === category.id}
                  onClick={() => {
                    onSelect(category.id);
                    setOpen(null);
                  }}
                >
                  <span className="gallery-filter-check" aria-hidden="true">
                    {selected === category.id ? "✓" : ""}
                  </span>
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
