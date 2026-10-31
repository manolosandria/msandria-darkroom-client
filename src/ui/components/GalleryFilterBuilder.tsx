"use client";
import { DragEvent, useRef, useState } from "react";
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
import "./galleryFilterBuilder.css";

type Drag = { node: FilterNode };

/**
 * Curator → Gallery → Filters: the filter bar built by dragging. Pieces (search, the
 * Filters button, reset, chosen filters, count, view and single departments) and
 * groups go into groups; a group is a row or a column, plain or a card, with its gap
 * and alignment. Everything dragged can also be moved with buttons, for the keyboard.
 * Off, the gallery keeps its usual bar.
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

  const renderNode = (
    node: FilterNode,
    parent: FilterGroup | null,
    index: number,
    depth: number,
  ) => {
    const isGroup = node.type === "group";
    const tools = parent && (
      <span className="filter-builder__tools">
        <button
          type="button"
          aria-label={`Move ${nameOf(node)} earlier`}
          disabled={index === 0}
          onClick={() => move(node, -1)}
        >
          ↑
        </button>
        <button
          type="button"
          aria-label={`Move ${nameOf(node)} later`}
          disabled={index === parent.children.length - 1}
          onClick={() => move(node, 1)}
        >
          ↓
        </button>
        {parent.id !== layout.id && (
          <button
            type="button"
            aria-label={`Move ${nameOf(node)} out of its group`}
            onClick={() => moveOut(node)}
          >
            ⇤
          </button>
        )}
        <button
          type="button"
          aria-label={`Remove ${nameOf(node)}`}
          onClick={() => remove(node)}
        >
          ×
        </button>
      </span>
    );
    if (!isGroup)
      return (
        <li
          key={node.id}
          className={`filter-builder__piece${over === `before:${node.id}` ? " is-over" : ""}`}
          draggable={!disabled}
          onDragStart={(event) => dragStart(event, node)}
          onDragOver={(event) =>
            parent && allowDrop(event, `before:${node.id}`)
          }
          onDrop={(event) => parent && dropOn(event, parent.id, index)}
        >
          <span className="filter-builder__grip" aria-hidden="true">
            ⠿
          </span>
          <span className="filter-builder__name">{nameOf(node)}</span>
          {tools}
        </li>
      );
    return (
      <li
        key={node.id}
        className={`filter-builder__group${selected === node.id ? " is-selected" : ""}${over === `into:${node.id}` ? " is-over" : ""}${node.surface === "card" ? " is-card" : ""}`}
        data-direction={node.direction}
        draggable={!disabled && Boolean(parent)}
        onDragStart={(event) => parent && dragStart(event, node)}
        onDragOver={(event) => allowDrop(event, `into:${node.id}`)}
        onDrop={(event) => dropOn(event, node.id, node.children.length)}
      >
        <div className="filter-builder__group-head">
          {parent && (
            <span className="filter-builder__grip" aria-hidden="true">
              ⠿
            </span>
          )}
          <button
            type="button"
            className="filter-builder__select"
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
        <ul className="filter-builder__children" data-depth={depth}>
          {node.children.map((child, childIndex) =>
            renderNode(child, node, childIndex, depth + 1),
          )}
          {!node.children.length && (
            <li className="filter-builder__empty">Drop pieces here</li>
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
        Drag pieces into the bar and between groups; a group is a row or a
        column, plain or as a card. A department placed here shows its
        categories in the bar and leaves the Filters panel.
      </p>
      <div className="filter-builder__layout">
        <div>
          <h4>Pieces</h4>
          <ul className="filter-builder__palette" aria-label="Available pieces">
            {available.map((piece) => (
              <li
                key={pieceKey(piece)}
                className="filter-builder__piece"
                draggable={!disabled}
                onDragStart={(event) => dragStart(event, piece)}
              >
                <span className="filter-builder__grip" aria-hidden="true">
                  ⠿
                </span>
                <span className="filter-builder__name">{nameOf(piece)}</span>
                <button
                  type="button"
                  aria-label={`Add ${nameOf(piece)} to ${selectedGroup.id === layout.id ? "the filter bar" : nameOf(selectedGroup)}`}
                  onClick={() =>
                    place(
                      piece,
                      selectedGroup.id,
                      selectedGroup.children.length,
                    )
                  }
                >
                  +
                </button>
              </li>
            ))}
            {!available.length && (
              <li className="filter-builder__empty">Every piece is placed.</li>
            )}
          </ul>
          <button
            type="button"
            className="filter-builder__add-group"
            disabled={depthOfSelected >= FILTER_LAYOUT_MAX_DEPTH}
            onClick={addGroup}
          >
            + New group
          </button>
        </div>
        <ul className="filter-builder__tree" aria-label="Filter bar structure">
          {renderNode(layout, null, 0, 1)}
        </ul>
      </div>
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
        <label>
          Align
          <select
            value={selectedGroup.align}
            onChange={(event) =>
              set({ align: event.target.value as FilterGroup["align"] })
            }
          >
            <option value="start">Start</option>
            <option value="center">Center</option>
            <option value="end">End</option>
            <option value="stretch">Stretch</option>
          </select>
        </label>
        <label>
          Distribute
          <select
            value={selectedGroup.justify}
            onChange={(event) =>
              set({ justify: event.target.value as FilterGroup["justify"] })
            }
          >
            <option value="start">From the start</option>
            <option value="center">Centered</option>
            <option value="end">To the end</option>
            <option value="between">Spread out</option>
          </select>
        </label>
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
