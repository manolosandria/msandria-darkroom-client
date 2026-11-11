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
import {
  defaultFilterLayout,
  filterElementLabels,
  FilterGroup,
  FilterNode,
  filterPieceKey,
  placedPieces,
} from "@/src/domain/galleryFilterLayout";
import { useFilterArrange } from "@/src/ui/hooks/useFilterArrange";
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
  layout: savedLayout,
  onArrange,
  extraColumn,
  extraChips = [],
  onReset,
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
  /**
   * The bar as arranged in Curator. Without it, search, Filters and reset share the
   * first line and the chosen filters and count the second.
   */
  layout?: FilterGroup;
  /**
   * In Curator's preview: the pieces and containers carry grips and can be dragged
   * into place; the new tree comes back here.
   */
  onArrange?: (layout: FilterGroup) => void;
  /** Another department for the panel, after the categories' (camera and exposure). */
  extraColumn?: ReactNode;
  /** Choices made outside the categories, as chips beside theirs. */
  extraChips?: {
    key: string;
    department: string;
    label: string;
    onRemove: () => void;
  }[];
  /** Clears what the categories do not hold, with the reset. */
  onReset?: () => void;
}) {
  // Arranging starts from the usual bar when there is no tree yet.
  const layout = savedLayout ?? (onArrange ? defaultFilterLayout() : undefined);
  const arrange = useFilterArrange(layout, onArrange);
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLElement>(null);
  const toggleButton = useRef<HTMLButtonElement>(null);
  const allDepartments = galleryDepartments(categories, settings);
  const placed = layout ? placedPieces(layout) : new Set<string>();
  // A department or View placed in the bar leaves the panel.
  const departments = allDepartments.filter(
    (department) => !placed.has(`department:${department.id}`),
  );
  const panelDisplay = placed.has("view") ? undefined : display;
  const chosen = departments.flatMap((department) =>
    department.categories
      .filter((category) => selected.includes(category.id))
      .map((category) => ({ category, department: department.label })),
  );
  const total = selected.length + extraChips.length;
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
  const hasPanel =
    departments.length > 0 || Boolean(panelDisplay) || Boolean(extraColumn);
  const toggleEl = hasPanel && (
    <button
      ref={toggleButton}
      type="button"
      className="gallery-browse__toggle"
      aria-expanded={open}
      aria-controls={panelId}
      data-active={total > 0 || undefined}
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
      {total > 0 && (
        <span className="gallery-department__badge">{total}</span>
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
  const resetEl = (
    <button
      type="button"
      className="gallery-browse__reset"
      aria-label="Clear all filters"
      title="Clear all filters"
      disabled={total === 0}
      onClick={() => {
        onChange([]);
        onReset?.();
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
  );
  const chipsEl = chosen.length + extraChips.length > 0 && (
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
      {extraChips.map((chip) => (
        <li key={chip.key}>
          <button
            type="button"
            aria-label={`Remove filter ${chip.department} ${chip.label}`}
            onClick={chip.onRemove}
          >
            <small>{chip.department}</small>
            {chip.label}
            <span aria-hidden="true">×</span>
          </button>
        </li>
      ))}
    </ul>
  );
  const departmentEl = (departmentId: string) => {
    const department = allDepartments.find((item) => item.id === departmentId);
    if (!department) return null;
    return (
      <div
        className="gallery-browse__inline"
        role="group"
        aria-label={department.label}
      >
        <span className="gallery-browse__heading">{department.label}</span>
        {department.categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className="gallery-browse__inline-option"
            aria-pressed={selected.includes(category.id)}
            onClick={() => toggle(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>
    );
  };
  // While arranging, every node says where a drop would land.
  const arrangeProps = (node: FilterNode) =>
    arrange.active
      ? {
          "data-filter-node": node.id,
          // What the list of pieces in Curator calls it, to light it from there.
          "data-filter-piece": filterPieceKey(node),
          "data-drop":
            arrange.drop?.targetId === node.id ? arrange.drop.mode : undefined,
          "data-dragged": arrange.dragging === node.id || undefined,
        }
      : {};
  const grip = (node: FilterNode, label: string) =>
    arrange.active &&
    node.id !== layout?.id && (
      <span
        className="gallery-browse__grip"
        data-filter-grip={node.id}
        title={`Drag ${label}`}
        aria-hidden="true"
      >
        ⠿ {label}
      </span>
    );
  const nodeEl = (node: FilterNode): ReactNode => {
    const grow = node.grow ? " is-grow" : "";
    if (node.type === "group")
      return (
        <div
          key={node.id}
          {...arrangeProps(node)}
          className={`gallery-browse__group${node.surface === "card" ? " is-card" : ""}${grow}`}
          data-direction={node.direction}
          style={{
            flexDirection: node.direction,
            gap: node.gap,
            alignItems:
              node.align === "start" || node.align === "end"
                ? `flex-${node.align}`
                : node.align,
            justifyContent:
              node.justify === "between"
                ? "space-between"
                : node.justify === "center"
                  ? "center"
                  : `flex-${node.justify}`,
            flexWrap: node.wrap ? "wrap" : "nowrap",
          }}
        >
          {grip(node, node.label || "Container")}
          {node.label && (
            <span className="gallery-browse__group-label">{node.label}</span>
          )}
          {node.children.map(nodeEl)}
        </div>
      );
    const view = display && (
      <div
        className="gallery-browse__view-inline"
        role="group"
        aria-label="View"
      >
        {display}
      </div>
    );
    const content =
      node.type === "department"
        ? departmentEl(node.departmentId)
        : {
            search,
            filters: toggleEl,
            reset: resetEl,
            chips: chipsEl,
            count,
            view,
          }[node.type];
    if (!content) return null;
    const label =
      node.type === "department"
        ? (allDepartments.find((item) => item.id === node.departmentId)
            ?.label ?? "Department")
        : filterElementLabels[node.type];
    return (
      <div
        key={node.id}
        {...arrangeProps(node)}
        className={`gallery-browse__piece${grow}`}
      >
        {grip(node, label)}
        {content}
      </div>
    );
  };
  return (
    <section
      ref={root}
      className={`gallery-browse${layout ? " gallery-browse--arranged" : ""}${arrange.active ? " is-arranging" : ""}`}
      data-dragging={arrange.dragging ? "true" : undefined}
      {...arrange.handlers}
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
      {layout ? (
        nodeEl(layout)
      ) : (
        <div className="gallery-browse__bar">
          {search}
          {toggleEl}
          {resetEl}
        </div>
      )}
      {hasPanel && (
        <div
          id={panelId}
          className="gallery-browse__panel"
          hidden={!open}
          role="region"
          aria-label="Filters and view"
        >
          {(departments.length > 0 || extraColumn) && (
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
              {extraColumn}
            </div>
          )}
          {panelDisplay && (
            <div
              className="gallery-browse__view"
              role="group"
              aria-label="View"
            >
              <p className="gallery-browse__heading">View</p>
              {panelDisplay}
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
      {!layout && (chosen.length + extraChips.length > 0 || count) && (
        <div className="gallery-browse__meta">
          {chipsEl}
          {count}
        </div>
      )}
    </section>
  );
}
