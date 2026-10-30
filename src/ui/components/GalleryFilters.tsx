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

const HOVER_OPEN_MS = 120;
const HOVER_CLOSE_MS = 250;

/**
 * The gallery's browse bar, laid out like the departments of a shop: search, one tab
 * per department and a reset share one bar; a tab opens a single panel under it where
 * every department is a column, so moving between them never leaves the panel. Any
 * category of a department matches, and each department chosen narrows the others.
 */
export function GalleryFilters({
  categories,
  settings,
  selected,
  onChange,
  search,
  display,
}: {
  categories: CatalogCategory[];
  settings: Pick<GallerySettings, "departments" | "categories">;
  selected: string[];
  onChange: (ids: string[]) => void;
  /** The search field, which leads the bar. */
  search?: ReactNode;
  /** Display options and the photograph count, at the end of the bar's second line. */
  display?: ReactNode;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const id = useId();
  const root = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hoverOpened = useRef({ department: "", at: 0 });
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
  const later = (action: () => void, delay: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(action, delay);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  // A press anywhere outside the bar and its panel closes the panel.
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const tabs = () =>
    Array.from(
      root.current?.querySelectorAll<HTMLButtonElement>(".gallery-department") ??
        [],
    );
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
  const onTabKey = (event: KeyboardEvent, departmentId: string) => {
    const all = tabs();
    const index = all.indexOf(event.currentTarget as HTMLButtonElement);
    const move = (to: number) => {
      event.preventDefault();
      const target = all[(to + all.length) % all.length];
      target?.focus();
      if (open) setOpen(target?.dataset.department ?? open);
    };
    if (event.key === "ArrowRight") move(index + 1);
    else if (event.key === "ArrowLeft") move(index - 1);
    else if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(departmentId);
      requestAnimationFrame(() => focusOption(departmentId, 0));
    }
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
      setOpen(next.id);
      focusOption(next.id, index);
    };
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(departmentId, index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (index === 0)
        tabs()
          .find((tab) => tab.dataset.department === departmentId)
          ?.focus();
      else focusOption(departmentId, index - 1);
    } else if (event.key === "ArrowRight") side(1);
    else if (event.key === "ArrowLeft") side(-1);
  };
  const panelId = `${id}-panel`;
  return (
    <section
      ref={root}
      className="gallery-browse"
      aria-label="Gallery filters"
      data-open={open ? true : undefined}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse" && open) clearTimeout(timer.current);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") later(() => setOpen(null), HOVER_CLOSE_MS);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          const current = open;
          setOpen(null);
          tabs()
            .find((tab) => tab.dataset.department === current)
            ?.focus();
        }
      }}
    >
      <div className="gallery-browse__bar">
        {search}
        {departments.length > 0 && (
          <div
            className="gallery-departments"
            role="toolbar"
            aria-label="Departments"
          >
            {departments.map((department) => {
              const count = department.categories.filter((category) =>
                selected.includes(category.id),
              ).length;
              return (
                <button
                  key={department.id}
                  type="button"
                  className="gallery-department"
                  data-department={department.id}
                  data-current={open === department.id || undefined}
                  data-active={count > 0 || undefined}
                  aria-expanded={open === department.id}
                  aria-controls={panelId}
                  onPointerEnter={(event) => {
                    if (event.pointerType !== "mouse") return;
                    later(() => {
                      hoverOpened.current = {
                        department: department.id,
                        at: Date.now(),
                      };
                      setOpen(department.id);
                    }, open ? 0 : HOVER_OPEN_MS);
                  }}
                  onClick={() => {
                    clearTimeout(timer.current);
                    const justHovered =
                      hoverOpened.current.department === department.id &&
                      Date.now() - hoverOpened.current.at < 600;
                    setOpen(
                      open === department.id && !justHovered
                        ? null
                        : department.id,
                    );
                  }}
                  onKeyDown={(event) => onTabKey(event, department.id)}
                >
                  <span>{department.label}</span>
                  {count > 0 && (
                    <span className="gallery-department__badge">{count}</span>
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
              );
            })}
          </div>
        )}
        <button
          type="button"
          className="gallery-browse__reset"
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
      <div
        id={panelId}
        className="gallery-browse__panel"
        hidden={!open}
        role="region"
        aria-label="Browse by department"
      >
        <div className="gallery-browse__columns">
          {departments.map((department) => {
            const count = department.categories.filter((category) =>
              selected.includes(category.id),
            ).length;
            return (
              <div
                key={department.id}
                className="gallery-browse__column"
                data-department={department.id}
                data-current={open === department.id || undefined}
                role="group"
                aria-label={department.label}
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse") setOpen(department.id);
                }}
              >
                <p className="gallery-browse__heading">
                  {department.label}
                  {count > 0 && <small>{count} chosen</small>}
                </p>
                <ul>
                  {department.categories.map((category, index) => (
                    <li key={category.id}>
                      <button
                        type="button"
                        className="gallery-browse__option"
                        aria-pressed={selected.includes(category.id)}
                        onClick={() => toggle(category.id)}
                        onFocus={() => setOpen(department.id)}
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
        <div className="gallery-browse__footer">
          <p>Any category within a department; every department chosen narrows the rest.</p>
          <button
            type="button"
            className="gallery-browse__done"
            onClick={() => {
              const current = open;
              setOpen(null);
              tabs()
                .find((tab) => tab.dataset.department === current)
                ?.focus();
            }}
          >
            Done
          </button>
        </div>
      </div>
      {(chosen.length > 0 || display) && (
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
          {display}
        </div>
      )}
    </section>
  );
}
