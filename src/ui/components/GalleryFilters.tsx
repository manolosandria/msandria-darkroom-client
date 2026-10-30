"use client";
import "./galleryFilters.css";
import {
  KeyboardEvent,
  ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { CatalogCategory } from "@/src/domain/entities/Catalog";
import { GallerySettings } from "@/src/domain/entities/GallerySettings";
import { galleryDepartments } from "./galleryCategoryGroups";

/**
 * The gallery's browse bar: search, one **Filters** button and a reset. The button
 * opens a single panel where every department is a column and the display options
 * close it, so nothing about how to filter competes with the photographs until asked
 * for. Any category of a department matches, and each department chosen narrows the
 * others.
 */
export function GalleryFilters({
  categories,
  settings,
  selected,
  onChange,
  search,
  count,
  display,
  anchor = "end",
}: {
  categories: CatalogCategory[];
  settings: Pick<GallerySettings, "departments" | "categories">;
  selected: string[];
  onChange: (ids: string[]) => void;
  /** The search field, which leads the bar. */
  search?: ReactNode;
  /** The photograph count, beside the chosen filters. */
  count?: ReactNode;
  /** How the photographs are shown, at the foot of the panel. */
  display?: ReactNode;
  /** The edge of the bar the panel lines up with; it grows towards the other. */
  anchor?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLElement>(null);
  const toggleButton = useRef<HTMLButtonElement>(null);
  const departments = galleryDepartments(categories, settings);
  const chosen = departments.flatMap((department) =>
    department.categories
      .filter((category) => selected.includes(category.id))
      .map((category) => ({ category, department: department.label })),
  );
  const toggle = (categoryId: string) =>
    onChange(
      selected.includes(categoryId)
        ? selected.filter((item) => item !== categoryId)
        : [...selected, categoryId],
    );
  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) toggleButton.current?.focus();
  };
  // A press anywhere outside the bar and its panel closes the panel.
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const options = (departmentId: string) =>
    Array.from(
      root.current?.querySelectorAll<HTMLButtonElement>(
        `[data-department="${CSS.escape(departmentId)}"] .gallery-browse__option`,
      ) ?? [],
    );
  const focusOption = (departmentId: string, index: number) => {
    const list = options(departmentId);
    list[Math.max(0, Math.min(index, list.length - 1))]?.focus();
  };
  const onOptionKey = (
    event: KeyboardEvent,
    departmentId: string,
    index: number,
  ) => {
    const column = departments.findIndex((item) => item.id === departmentId);
    const side = (step: number) => {
      const next = departments[column + step];
      if (!next) return;
      event.preventDefault();
      focusOption(next.id, index);
    };
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(departmentId, index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (index === 0 && column === 0) toggleButton.current?.focus();
      else if (index === 0) focusOption(departments[column - 1].id, 0);
      else focusOption(departmentId, index - 1);
    } else if (event.key === "ArrowRight") side(1);
    else if (event.key === "ArrowLeft") side(-1);
  };
  const panelId = `${id}-panel`;
  const hasPanel = departments.length > 0 || Boolean(display);
  return (
    <section
      ref={root}
      className="gallery-browse"
      aria-label="Gallery filters"
      data-open={open || undefined}
      data-anchor={anchor}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) close(true);
      }}
    >
      <div className="gallery-browse__bar">
        {search}
        {hasPanel && (
          <button
            ref={toggleButton}
            type="button"
            className="gallery-browse__toggle"
            aria-expanded={open}
            aria-controls={panelId}
            data-active={selected.length > 0 || undefined}
            onClick={() => setOpen(!open)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowDown" || !departments[0]) return;
              event.preventDefault();
              setOpen(true);
              requestAnimationFrame(() => focusOption(departments[0].id, 0));
            }}
          >
            <svg
              viewBox="0 0 20 20"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <path d="M3 5h14M6 10h8M8.5 15h3" />
            </svg>
            <span>Filters</span>
            {selected.length > 0 && (
              <span className="gallery-department__badge">
                {selected.length}
              </span>
            )}
            <svg
              className="gallery-department__caret"
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
        )}
        <button
          type="button"
          className="gallery-browse__reset"
          aria-label="Clear all filters"
          title="Clear all filters"
          disabled={selected.length === 0}
          onClick={() => {
            onChange([]);
            setOpen(false);
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
      {hasPanel && (
        <div
          id={panelId}
          className="gallery-browse__panel"
          hidden={!open}
          role="region"
          aria-label="Filters and view"
        >
          {departments.length > 0 && (
            <div className="gallery-browse__columns">
              {departments.map((department) => {
                const chosenHere = department.categories.filter((category) =>
                  selected.includes(category.id),
                ).length;
                return (
                  <div
                    key={department.id}
                    className="gallery-browse__column"
                    data-department={department.id}
                    data-current={chosenHere > 0 || undefined}
                    role="group"
                    aria-label={department.label}
                  >
                    <p className="gallery-browse__heading">
                      {department.label}
                      {chosenHere > 0 && <small>{chosenHere} chosen</small>}
                    </p>
                    <ul>
                      {department.categories.map((category, index) => (
                        <li key={category.id}>
                          <button
                            type="button"
                            className="gallery-browse__option"
                            aria-pressed={selected.includes(category.id)}
                            onClick={() => toggle(category.id)}
                            onKeyDown={(event) =>
                              onOptionKey(event, department.id, index)
                            }
                          >
                            <span
                              className="gallery-browse__check"
                              aria-hidden="true"
                            />
                            {category.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
          {display && (
            <div className="gallery-browse__view" role="group" aria-label="View">
              <p className="gallery-browse__heading">View</p>
              {display}
            </div>
          )}
          <div className="gallery-browse__footer">
            {departments.length > 0 && (
              <p>
                Any category within a department; every department chosen
                narrows the rest.
              </p>
            )}
            <button
              type="button"
              className="gallery-browse__done"
              onClick={() => close(true)}
            >
              Done
            </button>
          </div>
        </div>
      )}
      {(chosen.length > 0 || count) && (
        <div className="gallery-browse__meta">
          {chosen.length > 0 && (
            <ul className="gallery-browse__chips" aria-label="Active filters">
              {chosen.map(({ category, department }) => (
                <li key={category.id}>
                  <button
                    type="button"
                    aria-label={`Remove filter ${category.name}`}
                    onClick={() => toggle(category.id)}
                  >
                    <small>{department}</small>
                    {category.name}
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {count}
        </div>
      )}
    </section>
  );
}
