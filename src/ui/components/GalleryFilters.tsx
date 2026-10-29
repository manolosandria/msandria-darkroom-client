"use client";
import { useId, useState, useRef } from "react";
import { CatalogCategory } from "@/src/domain/entities/Catalog";
import { GallerySettings } from "@/src/domain/entities/GallerySettings";
import { groupGalleryCategories } from "./galleryCategoryGroups";

// Several categories can be chosen: one of each group must match, any within a group.
export function GalleryFilters({
  categories,
  settings,
  selected,
  onChange,
}: {
  categories: CatalogCategory[];
  settings: GallerySettings;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const id = useId();
  const hovered = useRef<string | null>(null);
  const groups = groupGalleryCategories(categories, settings.categories);
  const chosen = categories.filter((category) => selected.includes(category.id));
  const toggle = (categoryId: string) =>
    onChange(
      selected.includes(categoryId)
        ? selected.filter((item) => item !== categoryId)
        : [...selected, categoryId],
    );
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
      <div className="gallery-filters__row">
        {groups.map((group, index) => {
          const count = group.categories.filter((category) =>
            selected.includes(category.id),
          ).length;
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
                data-active={count > 0 || undefined}
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
                {count > 0 && (
                  <span className="gallery-filter-badge">{count}</span>
                )}
                <svg
                  className="gallery-filter-caret"
                  viewBox="0 0 12 12"
                  width="10"
                  height="10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden="true"
                >
                  <path d="M2 4l4 4 4-4" />
                </svg>
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
                    aria-pressed={selected.includes(category.id)}
                    onClick={() => toggle(category.id)}
                  >
                    <span className="gallery-filter-check" aria-hidden="true">
                      {selected.includes(category.id) ? "✓" : ""}
                    </span>
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <button
          className="gallery-filter-reset"
          aria-label="Clear all filters"
          title="Clear all filters"
          disabled={selected.length === 0}
          onClick={() => {
            onChange([]);
            setOpen(null);
          }}
        >
          <svg
            viewBox="0 0 20 20"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <path d="M4 10a6 6 0 1 0 2-4.5" />
            <path d="M4 3v3.5h3.5" />
          </svg>
        </button>
      </div>
      {chosen.length > 0 && (
        <ul className="gallery-filter-chips" aria-label="Active filters">
          {chosen.map((category) => (
            <li key={category.id}>
              <button
                aria-label={`Remove filter ${category.name}`}
                onClick={() => toggle(category.id)}
              >
                {category.name} <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
