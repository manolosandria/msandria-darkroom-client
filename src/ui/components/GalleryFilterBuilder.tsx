"use client";
import { CSSProperties, DragEvent, ReactNode, useRef, useState } from "react";
import { CatalogCategory } from "@/src/domain/entities/Catalog";
import { GallerySettings } from "@/src/domain/entities/GallerySettings";
import {
  FILTER_LAYOUT_MAX_DEPTH,
  FilterGroup,
  FilterLeaf,
  FilterNode,
  defaultFilterLayout,
  filterElementLabels,
  filterElements,
  findFilterNode,
  newFilterGroup,
  nextFilterId,
  pieceKey,
  placeFilterNode,
  placedPieces,
  pruneFilterLayout,
  removeFilterNode,
  updateFilterGroup,
  walkFilterLayout,
} from "@/src/domain/galleryFilterLayout";
import { galleryDepartments } from "./galleryCategoryGroups";
import { galleryOptionIcons } from "./GalleryVisitorControls";
import "./galleryFilters.css";
import "./galleryFilterBuilder.css";
import { SegmentedChoice } from "./SegmentedChoice";
import { choiceIcons } from "./choiceIcons";

type Drag = { node: FilterNode };

/**
 * Curator → Gallery → Filters: the filter bar built by dragging. Pieces (search, the
 * Filters button, reset, chosen filters, count, view and single departments) and
 * groups go into groups; a group is a row or a column, plain or a card, with its gap
 * and alignment. The bar is edited as it will look: groups are laid out with their own
 * direction, gap and card, and every piece is drawn as the gallery's own control.
 * Everything dragged can also be moved with buttons, for the keyboard. Off, the
 * gallery keeps its usual bar.
 */
export function GalleryFilterBuilder({
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
  const layout = settings.filterLayout
    ? pruneFilterLayout(
        settings.filterLayout,
        departments.map((department) => department.id),
      )
    : undefined;
  const [selected, setSelected] = useState("root");
  const [announcement, setAnnouncement] = useState("");
  const drag = useRef<Drag | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const departmentName = (id: string) =>
    departments.find((department) => department.id === id)?.label ?? id;
  const nameOf = (node: FilterNode) =>
    node.type === "group"
      ? node.label || (node.direction === "row" ? "Row" : "Column")
      : node.type === "department"
        ? `Department: ${departmentName(node.departmentId)}`
        : filterElementLabels[node.type];

  if (!layout)
    return (
      <fieldset disabled={disabled} className="filter-builder">
        <legend>Filter bar</legend>
        <p>
          The gallery shows its usual bar: search, Filters and reset, then the
          chosen filters and the count.
        </p>
        <button
          type="button"
          className="filter-builder__start"
          onClick={() => {
            onChange(defaultFilterLayout());
            setSelected("root");
          }}
        >
          Arrange the filter bar
        </button>
      </fieldset>
    );

  const placed = placedPieces(layout);
  const available: FilterLeaf[] = [
    ...filterElements
      .filter((type) => !placed.has(type))
      .map((type) => ({ id: type, type })),
    ...departments
      .filter((department) => !placed.has(`department:${department.id}`))
      .map((department) => ({
        id: `department-${department.id}`,
        type: "department" as const,
        departmentId: department.id,
      })),
  ];
  const selectedGroup = (() => {
    const found = findFilterNode(layout, selected);
    return found?.node.type === "group" ? found.node : layout;
  })();

  const commit = (next: FilterGroup, message: string) => {
    if (next === layout) {
      setAnnouncement("That does not fit there.");
      return;
    }
    onChange(next);
    setAnnouncement(message);
  };
  const place = (node: FilterNode, groupId: string, index: number) => {
    const fresh = findFilterNode(layout, node.id)
      ? node
      : { ...node, id: nextFilterId(layout, node.id) };
    commit(
      placeFilterNode(layout, fresh, groupId, index),
      `${nameOf(node)} placed.`,
    );
  };
  const addGroup = () => {
    const group = newFilterGroup(nextFilterId(layout, "group"));
    const next = placeFilterNode(
      layout,
      group,
      selectedGroup.id,
      selectedGroup.children.length,
    );
    commit(next, "New row added.");
    if (next !== layout) setSelected(group.id);
  };
  const move = (node: FilterNode, step: -1 | 1) => {
    const found = findFilterNode(layout, node.id);
    if (!found?.parent) return;
    const index = found.index + step;
    if (index < 0 || index >= found.parent.children.length) return;
    commit(
      placeFilterNode(
        layout,
        node,
        found.parent.id,
        step > 0 ? index + 1 : index,
      ),
      `${nameOf(node)} moved.`,
    );
  };
  const moveOut = (node: FilterNode) => {
    const found = findFilterNode(layout, node.id);
    const parent = found?.parent && findFilterNode(layout, found.parent.id);
    if (!parent?.parent) return;
    commit(
      placeFilterNode(layout, node, parent.parent.id, parent.index + 1),
      `${nameOf(node)} moved out of its group.`,
    );
  };
  const remove = (node: FilterNode) => {
    commit(removeFilterNode(layout, node.id), `${nameOf(node)} removed.`);
    if (walkFilterLayout(node).some((entry) => entry.node.id === selected))
      setSelected("root");
  };

  const dragStart = (event: DragEvent, node: FilterNode) => {
    drag.current = { node };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", node.id);
    event.stopPropagation();
  };
  // Over a piece, the drop goes before or after it, by which half the pointer is in.
  const overPiece = (
    event: DragEvent,
    parent: FilterGroup,
    index: number,
  ): number => {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const after =
      parent.direction === "row"
        ? event.clientX > box.left + box.width / 2
        : event.clientY > box.top + box.height / 2;
    return after ? index + 1 : index;
  };
  const dropOn = (event: DragEvent, groupId: string, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    setOver(null);
    const dragged = drag.current;
    drag.current = null;
    if (dragged) place(dragged.node, groupId, index);
  };
  const allowDrop = (event: DragEvent, key: string) => {
    if (!drag.current) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    if (over !== key) setOver(key);
  };

  const departmentOf = (id: string) =>
    departments.find((department) => department.id === id);
  // The gallery's own control for each piece, drawn and not usable.
  const replica = (node: FilterLeaf): ReactNode => {
    if (node.type === "department") {
      const department = departmentOf(node.departmentId);
      const shown = department?.categories ?? [];
      return (
        <span className="gallery-browse__inline">
          <span className="gallery-browse__heading">
            {department?.label ?? node.departmentId}
          </span>
          {shown.slice(0, 3).map((category, i) => (
            <span
              key={category.id}
              className="gallery-browse__inline-option"
              aria-pressed={i === 0}
            >
              {category.name}
            </span>
          ))}
          {shown.length > 3 && (
            <span className="filter-canvas__more">+{shown.length - 3}</span>
          )}
        </span>
      );
    }
    const stroke = {
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.6,
    } as const;
    switch (node.type) {
      case "search":
        return (
          <span className="gallery-search">
            <span className="gallery-search__field">
              <svg viewBox="0 0 20 20" width="18" height="18" {...stroke}>
                <circle cx="8.5" cy="8.5" r="5.5" />
                <path d="M13 13l4.5 4.5" />
              </svg>
              <input readOnly tabIndex={-1} placeholder="Search the archive" />
            </span>
          </span>
        );
      case "filters":
        return (
          <span className="gallery-browse__toggle">
            <svg viewBox="0 0 20 20" width="16" height="16" {...stroke}>
              <path d="M3 5h14M6 10h8M8.5 15h3" />
            </svg>
            <span>Filters</span>
            <svg
              className="gallery-department__caret"
              viewBox="0 0 12 12"
              width="10"
              height="10"
              {...stroke}
            >
              <path d="M2 4l4 4 4-4" />
            </svg>
          </span>
        );
      case "reset":
        return (
          <span className="gallery-browse__reset">
            <svg viewBox="0 0 20 20" width="18" height="18" {...stroke}>
              <path d="M4 10a6 6 0 1 0 2-4.5" />
              <path d="M4 3v3.5h3.5" />
            </svg>
          </span>
        );
      case "chips": {
        const first = departments[0];
        const samples = first?.categories.slice(0, 2) ?? [];
        return (
          <span className="gallery-browse__chips">
            {samples.length ? (
              samples.map((category) => (
                <span key={category.id} className="filter-canvas__chip">
                  <small>{first.label}</small>
                  {category.name}
                  <span>×</span>
                </span>
              ))
            ) : (
              <span className="filter-canvas__chip">
                <small>Subjects</small>
                Birds
                <span>×</span>
              </span>
            )}
          </span>
        );
      }
      case "count":
        return <span className="gallery-filter-count">128 photographs</span>;
      case "view":
        return (
          <span className="gallery-browse__view-inline">
            {["justified", "uniform", "random"].map((option, i) => (
              <span
                key={option}
                className={`filter-canvas__view${i === 0 ? " is-on" : ""}`}
              >
                <svg viewBox="0 0 20 20" width="18" height="18" {...stroke}>
                  {galleryOptionIcons[option]}
                </svg>
              </span>
            ))}
          </span>
        );
    }
  };
  const groupStyle = (node: FilterGroup): CSSProperties => ({
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
  });

  const renderNode = (
    node: FilterNode,
    parent: FilterGroup | null,
    index: number,
    depth: number,
  ) => {
    const tools = parent && (
      <span className="filter-canvas__tools">
        <button
          type="button"
          aria-label={`Move ${nameOf(node)} earlier`}
          title="Earlier"
          disabled={index === 0}
          onClick={() => move(node, -1)}
        >
          {parent.direction === "row" ? "←" : "↑"}
        </button>
        <button
          type="button"
          aria-label={`Move ${nameOf(node)} later`}
          title="Later"
          disabled={index === parent.children.length - 1}
          onClick={() => move(node, 1)}
        >
          {parent.direction === "row" ? "→" : "↓"}
        </button>
        {parent.id !== layout.id && (
          <button
            type="button"
            aria-label={`Move ${nameOf(node)} out of its group`}
            title="Out of the group"
            onClick={() => moveOut(node)}
          >
            ⇤
          </button>
        )}
        <button
          type="button"
          className="filter-canvas__remove"
          aria-label={`Remove ${nameOf(node)}`}
          title="Remove"
          onClick={() => remove(node)}
        >
          ×
        </button>
      </span>
    );
    // Where a drop would land, drawn as a line before or after this item.
    const drop = parent
      ? over === `at:${parent.id}:${index}`
        ? " is-drop-before"
        : over === `at:${parent.id}:${index + 1}`
          ? " is-drop-after"
          : ""
      : "";
    if (node.type !== "group")
      return (
        <li
          key={node.id}
          className={`filter-canvas__piece${node.grow ? " is-grow" : ""}${drop}`}
          data-direction={parent?.direction}
          draggable={!disabled}
          onDragStart={(event) => dragStart(event, node)}
          onDragOver={(event) =>
            parent &&
            allowDrop(
              event,
              `at:${parent.id}:${overPiece(event, parent, index)}`,
            )
          }
          onDrop={(event) =>
            parent && dropOn(event, parent.id, overPiece(event, parent, index))
          }
        >
          <span className="filter-canvas__label">
            <span className="filter-canvas__grip" aria-hidden="true">
              ⠿
            </span>
            {nameOf(node)}
          </span>
          <span className="filter-canvas__replica" aria-hidden="true" inert>
            {replica(node)}
          </span>
          {tools}
        </li>
      );
    return (
      <li
        key={node.id}
        className={`filter-canvas__group${selected === node.id ? " is-selected" : ""}${over === `into:${node.id}` ? " is-over" : ""}${node.surface === "card" ? " is-card" : ""}${node.grow ? " is-grow" : ""}${drop}`}
        data-direction={parent?.direction}
        draggable={!disabled && Boolean(parent)}
        onDragStart={(event) => parent && dragStart(event, node)}
        onDragOver={(event) => allowDrop(event, `into:${node.id}`)}
        onDrop={(event) => dropOn(event, node.id, node.children.length)}
      >
        <div className="filter-canvas__head">
          {parent && (
            <span className="filter-canvas__grip" aria-hidden="true">
              ⠿
            </span>
          )}
          <button
            type="button"
            className="filter-canvas__select"
            aria-pressed={selected === node.id}
            onClick={() => setSelected(node.id)}
          >
            {parent ? nameOf(node) : "Filter bar"}
            <small>
              {node.direction === "row" ? "row" : "column"} · gap {node.gap}
              {node.surface === "card" ? " · card" : ""}
            </small>
          </button>
          {tools}
        </div>
        {node.label && (
          <span className="gallery-browse__group-label">{node.label}</span>
        )}
        <ul
          className="filter-canvas__children"
          data-depth={depth}
          style={groupStyle(node)}
        >
          {node.children.map((child, childIndex) =>
            renderNode(child, node, childIndex, depth + 1),
          )}
          {!node.children.length && (
            <li className="filter-canvas__empty">Drop pieces here</li>
          )}
        </ul>
      </li>
    );
  };

  const set = (patch: Partial<FilterGroup>) =>
    onChange(updateFilterGroup(layout, selectedGroup.id, patch));
  const depthOfSelected =
    walkFilterLayout(layout).find((entry) => entry.node.id === selectedGroup.id)
      ?.depth ?? 1;

  return (
    <fieldset disabled={disabled} className="filter-builder">
      <legend>Filter bar</legend>
      <p className="filter-builder__intro">
        This is the bar as visitors will see it. Drag a piece onto it, or move
        pieces and groups by their names; click a group to set its direction,
        gap and card. A department placed here shows its categories in the bar
        and leaves the Filters panel.
      </p>
      <div className="filter-builder__tray">
        <h4>Pieces</h4>
        <ul className="filter-builder__palette" aria-label="Available pieces">
          {available.map((piece) => (
            <li
              key={pieceKey(piece)}
              className="filter-canvas__piece is-spare"
              draggable={!disabled}
              onDragStart={(event) => dragStart(event, piece)}
              title={`Drag ${nameOf(piece)} into the bar`}
            >
              <span className="filter-canvas__label">
                <span className="filter-canvas__grip" aria-hidden="true">
                  ⠿
                </span>
                {nameOf(piece)}
              </span>
              <span className="filter-canvas__replica" aria-hidden="true" inert>
                {replica(piece)}
              </span>
              <button
                type="button"
                className="filter-canvas__add"
                aria-label={`Add ${nameOf(piece)} to ${selectedGroup.id === layout.id ? "the filter bar" : nameOf(selectedGroup)}`}
                title="Add to the chosen group"
                onClick={() =>
                  place(piece, selectedGroup.id, selectedGroup.children.length)
                }
              >
                +
              </button>
            </li>
          ))}
          {!available.length && (
            <li className="filter-canvas__empty">Every piece is placed.</li>
          )}
        </ul>
        <button
          type="button"
          className="filter-builder__new-group plasma"
          disabled={depthOfSelected >= FILTER_LAYOUT_MAX_DEPTH}
          onClick={addGroup}
        >
          + New group
        </button>
      </div>
      <ul
        className="filter-canvas gallery-browse gallery-browse--arranged"
        aria-label="Filter bar structure"
        style={{
          background: settings.appearance.surface,
          color: settings.appearance.text,
        }}
      >
        {renderNode(layout, null, 0, 1)}
      </ul>
      <div
        className="filter-builder__properties"
        role="group"
        aria-label="Group properties"
      >
        <h4>
          {selectedGroup.id === layout.id
            ? "Filter bar"
            : nameOf(selectedGroup)}
        </h4>
        <div
          className="filter-builder__choice"
          role="group"
          aria-label="Direction"
        >
          {(["row", "column"] as const).map((direction) => (
            <button
              key={direction}
              type="button"
              aria-pressed={selectedGroup.direction === direction}
              onClick={() => set({ direction })}
            >
              {direction === "row" ? "Row" : "Column"}
            </button>
          ))}
        </div>
        <label>
          Gap · {selectedGroup.gap}px
          <input
            type="range"
            min={0}
            max={48}
            value={selectedGroup.gap}
            onChange={(event) => set({ gap: Number(event.target.value) })}
          />
        </label>
        <SegmentedChoice<FilterGroup["align"]>
          label="Align"
          value={selectedGroup.align}
          onChange={(align) => set({ align })}
          options={[
            { value: "start", label: "Start", icon: choiceIcons.crossStart },
            { value: "center", label: "Center", icon: choiceIcons.crossCenter },
            { value: "end", label: "End", icon: choiceIcons.crossEnd },
            {
              value: "stretch",
              label: "Stretch",
              icon: choiceIcons.crossStretch,
            },
          ]}
        />
        <SegmentedChoice<FilterGroup["justify"]>
          label="Distribute"
          value={selectedGroup.justify}
          onChange={(justify) => set({ justify })}
          options={[
            {
              value: "start",
              label: "From the start",
              icon: choiceIcons.mainStart,
            },
            {
              value: "center",
              label: "Centered",
              icon: choiceIcons.mainCenter,
            },
            { value: "end", label: "To the end", icon: choiceIcons.mainEnd },
            {
              value: "between",
              label: "Spread out",
              icon: choiceIcons.mainBetween,
            },
          ]}
        />
        <label className="filter-builder__check">
          <input
            type="checkbox"
            checked={selectedGroup.wrap}
            onChange={(event) => set({ wrap: event.target.checked })}
          />
          Wrap onto more lines
        </label>
        <label className="filter-builder__check">
          <input
            type="checkbox"
            checked={selectedGroup.surface === "card"}
            onChange={(event) =>
              set({ surface: event.target.checked ? "card" : "none" })
            }
          />
          Show as a card
        </label>
        <label>
          Label
          <input
            maxLength={40}
            value={selectedGroup.label ?? ""}
            placeholder="None"
            // An empty label is no label: JSON leaves the undefined key out.
            onChange={(event) =>
              set({ label: event.target.value || undefined })
            }
          />
        </label>
      </div>
      <div className="filter-builder__footer">
        <button
          type="button"
          onClick={() => {
            onChange(defaultFilterLayout());
            setSelected("root");
          }}
        >
          Start over
        </button>
        <button
          type="button"
          onClick={() => {
            onChange(undefined);
            setSelected("root");
          }}
        >
          Use the usual bar
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </fieldset>
  );
}
