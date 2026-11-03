"use client";
import "./galleryFilterBuilder.css";
import { CatalogCategory } from "@/src/domain/entities/Catalog";
import { GallerySettings } from "@/src/domain/entities/GallerySettings";
import {
  defaultFilterLayout,
  filterElementLabels,
  filterElements,
  FilterGroup,
  FilterLeaf,
  newFilterGroup,
  nextFilterId,
  placedPieces,
  placeFilterNode,
  pruneFilterLayout,
  removeFilterNode,
  dissolveFilterGroup,
  walkFilterLayout,
} from "@/src/domain/galleryFilterLayout";
import { galleryDepartments } from "./galleryCategoryGroups";

/**
 * Which pieces the filter bar shows, as switches; where they go is decided in the
 * preview, by dragging them (into or out of a container). A department switched on
 * shows its categories in the bar instead of in the Filters panel.
 */
// Pointing at a piece in the list (or focusing it) lights the same piece in the
// preview beside it, so each switch can be told by what it shows.
function spotlight(key: string, on: boolean) {
  document
    .querySelectorAll<HTMLElement>(`[data-filter-piece="${CSS.escape(key)}"]`)
    .forEach((element) => {
      if (on) element.setAttribute("data-spotlight", "");
      else element.removeAttribute("data-spotlight");
    });
}
const spotlightProps = (key: string) => ({
  onPointerEnter: () => spotlight(key, true),
  onPointerLeave: () => spotlight(key, false),
  onFocus: () => spotlight(key, true),
  onBlur: () => spotlight(key, false),
});

export function GalleryFilterPieces({
  categories,
  settings,
  disabled,
  onChange,
}: {
  categories: CatalogCategory[];
  settings: GallerySettings;
  disabled?: boolean;
  onChange: (layout: FilterGroup | undefined) => void;
}) {
  const departments = galleryDepartments(categories, settings);
  const layout = pruneFilterLayout(
    settings.filterLayout ?? defaultFilterLayout(),
    departments.map((department) => department.id),
  );
  const placed = placedPieces(layout);
  // A new piece joins the first container, where the curator can see it at once.
  const firstGroup =
    layout.children.find(
      (child): child is FilterGroup => child.type === "group",
    ) ?? layout;
  const containers = walkFilterLayout(layout)
    .map(({ node }) => node)
    .filter(
      (node): node is FilterGroup =>
        node.type === "group" && node.id !== layout.id,
    );
  const toggle = (leaf: FilterLeaf, key: string) => {
    if (placed.has(key)) {
      const found = walkFilterLayout(layout).find(
        ({ node }) =>
          node.type !== "group" &&
          (node.type === "department"
            ? `department:${node.departmentId}`
            : node.type) === key,
      );
      if (found) onChange(removeFilterNode(layout, found.node.id));
      return;
    }
    const fresh = { ...leaf, id: nextFilterId(layout, leaf.id) };
    onChange(
      placeFilterNode(layout, fresh, firstGroup.id, firstGroup.children.length),
    );
  };
  const pieces: { key: string; label: string; leaf: FilterLeaf }[] = [
    ...filterElements.map((type) => ({
      key: type,
      label: filterElementLabels[type],
      leaf: { id: type, type } as FilterLeaf,
    })),
    ...departments.map((department) => ({
      key: `department:${department.id}`,
      label: `${department.label} (in the bar)`,
      leaf: {
        id: `department-${department.id}`,
        type: "department" as const,
        departmentId: department.id,
      },
    })),
  ];
  return (
    <fieldset disabled={disabled} className="filter-pieces">
      <legend>Filter bar</legend>
      <p className="filter-pieces__hint">
        Choose what the bar shows. Then arrange it in the preview: drag any piece
        or container by its grip, in or out of a container, and drop it where the
        line shows.
      </p>
      <ul className="filter-pieces__list">
        {pieces.map(({ key, label, leaf }) => (
          <li key={key} {...spotlightProps(key)}>
            <label>
              <input
                type="checkbox"
                checked={placed.has(key)}
                onChange={() => toggle(leaf, key)}
              />
              {label}
            </label>
          </li>
        ))}
      </ul>
      {containers.length > 0 && (
        <ul className="filter-pieces__containers">
          {containers.map((group, index) => (
            <li key={group.id} {...spotlightProps(`container:${group.id}`)}>
              <span>{group.label || `Container ${index + 1}`}</span>
              <button
                type="button"
                onClick={() => onChange(dissolveFilterGroup(layout, group.id))}
                aria-label={`Remove ${group.label || `container ${index + 1}`}, keeping its pieces`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="filter-pieces__actions">
        <button
          type="button"
          onClick={() =>
            onChange(
              placeFilterNode(
                layout,
                newFilterGroup(nextFilterId(layout, "container"), {
                  surface: "card",
                }),
                layout.id,
                layout.children.length,
              ),
            )
          }
        >
          + Container
        </button>
        {settings.filterLayout && (
          <button type="button" onClick={() => onChange(undefined)}>
            Use the usual bar
          </button>
        )}
      </div>
    </fieldset>
  );
}
