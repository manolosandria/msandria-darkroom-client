"use client";
import { DragEvent, KeyboardEvent, useRef, useState } from "react";
import { useLiveSort } from "../hooks/useLiveSort";
import { CatalogCategory } from "@/src/domain/entities/Catalog";
import {
  GalleryDepartment,
  GallerySettings,
} from "@/src/domain/entities/GallerySettings";
import { editableDepartments } from "./galleryCategoryGroups";
import {
  MAX_DEPARTMENTS,
  moveCategory,
  moveDepartment,
  newDepartment,
} from "../galleryDepartmentEdits";

type Drag = { kind: "category"; id: string } | null;
type Target = { department: string | null; index: number } | null;

/**
 * Arranges the departments of Gallery's browse bar: their order and names, and which
 * categories each offers in which order. Everything moves by dragging, and the same
 * moves are on the arrow keys of each grip. Unsorted categories close the bar as Other.
 */
export function GalleryDepartmentsEditor({
  categories,
  settings,
  disabled,
  onChange,
}: {
  categories: CatalogCategory[];
  settings: Pick<GallerySettings, "departments" | "categories">;
  disabled: boolean;
  /** `undefined` returns to the suggested grouping. */
  onChange: (departments: GalleryDepartment[] | undefined) => void;
}) {
  const names = new Map(
    categories.map((category) => [category.id, category.name]),
  );
  // Categories deleted from the catalog drop out here, and with the next save.
  const departments = editableDepartments(categories, settings).map(
    (department) => ({
      ...department,
      categoryIds: department.categoryIds.filter((id) => names.has(id)),
    }),
  );
  const placed = new Set(
    departments.flatMap((department) => department.categoryIds),
  );
  const unsorted = categories.filter((category) => !placed.has(category.id));
  const drag = useRef<Drag>(null);
  const [dragging, setDragging] = useState<Drag>(null);
  const [target, setTarget] = useState<Target>(null);
  const [message, setMessage] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const focusLater = (selector: string) =>
    requestAnimationFrame(() =>
      root.current?.querySelector<HTMLElement>(selector)?.focus(),
    );
  const nameOf = (departmentId: string | null) =>
    departments.find((department) => department.id === departmentId)?.name ??
    "Other";
  function placeCategory(
    categoryId: string,
    departmentId: string | null,
    index?: number,
  ) {
    const next = moveCategory(departments, categoryId, departmentId, index);
    onChange(next);
    const position =
      departmentId === null
        ? null
        : next
            .find((department) => department.id === departmentId)!
            .categoryIds.indexOf(categoryId) + 1;
    setMessage(
      `${names.get(categoryId)} moved to ${nameOf(departmentId)}${position ? `, position ${position}` : ""}.`,
    );
    focusLater(`[data-category-grip="${CSS.escape(categoryId)}"]`);
  }
  function shiftDepartment(from: number, to: number) {
    if (to < 0 || to >= departments.length) return;
    onChange(moveDepartment(departments, from, to));
    setMessage(`${departments[from].name} is now department ${to + 1}.`);
    focusLater(`[data-department-grip="${CSS.escape(departments[from].id)}"]`);
  }
  // Departments move by their grip; the others make room as one passes over them.
  const {
    order: sortOrder,
    dragging: sortDragging,
    attachList,
    attachItem,
    itemStyle,
    gripProps,
  } = useLiveSort({
    keys: departments.map((department) => department.id),
    onMove: shiftDepartment,
    disabled,
  });
  const onCategoryKey = (
    event: KeyboardEvent,
    categoryId: string,
    departmentIndex: number,
    index: number,
  ) => {
    const department = departments[departmentIndex];
    const handled = () => event.preventDefault();
    if (event.key === "ArrowLeft" && department && index > 0) {
      handled();
      placeCategory(categoryId, department.id, index - 1);
    } else if (
      event.key === "ArrowRight" &&
      department &&
      index < department.categoryIds.length - 1
    ) {
      handled();
      placeCategory(categoryId, department.id, index + 1);
    } else if (event.key === "ArrowUp") {
      // The unsorted tray sits after the last department.
      const previous =
        departmentIndex < 0 ? departments.length - 1 : departmentIndex - 1;
      if (previous < 0) return;
      handled();
      placeCategory(categoryId, departments[previous].id);
    } else if (event.key === "ArrowDown" && departmentIndex >= 0) {
      handled();
      const next = departments[departmentIndex + 1];
      placeCategory(categoryId, next ? next.id : null);
    }
  };
  const start = (event: DragEvent, value: Drag) => {
    drag.current = value;
    setDragging(value);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", value!.id);
  };
  const end = () => {
    drag.current = null;
    setDragging(null);
    setTarget(null);
  };
  const overCategory = (
    event: DragEvent,
    department: string | null,
    index: number,
  ) => {
    if (drag.current?.kind !== "category") return;
    event.preventDefault();
    event.stopPropagation();
    if (target?.department !== department || target.index !== index)
      setTarget({ department, index });
  };
  const dropCategory = (event: DragEvent) => {
    if (drag.current?.kind !== "category" || !target) return;
    event.preventDefault();
    event.stopPropagation();
    const id = drag.current.id;
    // A position inside its own department counts the list without the category.
    const current = departments.find((item) => item.id === target.department);
    const from = current?.categoryIds.indexOf(id) ?? -1;
    placeCategory(
      id,
      target.department,
      from >= 0 && from < target.index ? target.index - 1 : target.index,
    );
    end();
  };
  const chip = (
    categoryId: string,
    departmentIndex: number,
    index: number,
    zone: string | null,
  ) => (
    <li
      key={categoryId}
      className="gallery-departments-editor__chip"
      draggable={!disabled}
      data-dragging={
        (dragging?.kind === "category" && dragging.id === categoryId) ||
        undefined
      }
      data-drop-before={
        (target?.department === zone && target.index === index) || undefined
      }
      onDragStart={(event) => {
        event.stopPropagation();
        start(event, { kind: "category", id: categoryId });
      }}
      onDragEnd={end}
      onDragOver={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        overCategory(
          event,
          zone,
          event.clientX > box.left + box.width / 2 ? index + 1 : index,
        );
      }}
      onDrop={dropCategory}
    >
      <button
        type="button"
        className="gallery-departments-editor__grip"
        data-category-grip={categoryId}
        aria-label={`Move ${names.get(categoryId)}`}
        title="Drag, or use the arrow keys: ← → order, ↑ ↓ department"
        disabled={disabled}
        onKeyDown={(event) =>
          onCategoryKey(event, categoryId, departmentIndex, index)
        }
      >
        <span aria-hidden="true">⠿</span>
        {names.get(categoryId)}
      </button>
      {zone !== null && (
        <button
          type="button"
          className="gallery-departments-editor__unsort"
          aria-label={`Leave ${names.get(categoryId)} unsorted`}
          title="Leave unsorted"
          disabled={disabled}
          onClick={() => placeCategory(categoryId, null)}
        >
          ×
        </button>
      )}
    </li>
  );
  return (
    <fieldset
      className="gallery-departments-editor"
      disabled={disabled}
      data-dragging={dragging?.kind}
    >
      <legend>Filter departments</legend>
      <p className="gallery-departments-editor__help">
        The browse bar offers these departments in this order. Drag a department
        by its grip to reorder it, and drag categories to order them or move
        them to another department. Unsorted ones close the bar as Other.
      </p>
      <div ref={root} className="gallery-departments-editor__board">
        <ol ref={attachList} className="gallery-departments-editor__list">
          {sortOrder.map((departmentId, shownIndex) => {
            const departmentIndex = departments.findIndex(
              (item) => item.id === departmentId,
            );
            const department = departments[departmentIndex];
            const visible = department.categoryIds;
            const grip = gripProps(department.id);
            return (
              <li
                key={department.id}
                ref={attachItem(department.id)}
                style={itemStyle(department.id)}
                className="gallery-departments-editor__department"
                data-dragging={sortDragging === department.id || undefined}
                data-drop-target={
                  (dragging?.kind === "category" &&
                    target?.department === department.id) ||
                  undefined
                }
                onDragOver={(event) =>
                  overCategory(event, department.id, visible.length)
                }
                onDrop={dropCategory}
              >
                <div className="gallery-departments-editor__head">
                  <button
                    type="button"
                    className="gallery-departments-editor__grip"
                    data-department-grip={department.id}
                    aria-label={`Move department ${department.name}`}
                    title="Drag, or use ↑ ↓"
                    {...grip}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") grip.onKeyDown(event);
                      else if (
                        event.key === "ArrowUp" ||
                        event.key === "ArrowDown"
                      ) {
                        event.preventDefault();
                        shiftDepartment(
                          departmentIndex,
                          departmentIndex + (event.key === "ArrowUp" ? -1 : 1),
                        );
                      }
                    }}
                  >
                    <span aria-hidden="true">⠿</span>
                    <span className="gallery-departments-editor__number">
                      {shownIndex + 1}
                    </span>
                  </button>
                  <input
                    aria-label={`Name of department ${departmentIndex + 1}`}
                    value={department.name}
                    maxLength={40}
                    required
                    onChange={(event) =>
                      onChange(
                        departments.map((item) =>
                          item.id === department.id
                            ? { ...item, name: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <span className="gallery-departments-editor__count">
                    {visible.length}
                  </span>
                  <button
                    type="button"
                    className="gallery-departments-editor__remove"
                    aria-label={`Remove department ${department.name}`}
                    title="Remove department; its categories become unsorted"
                    onClick={() => {
                      onChange(
                        departments.filter((item) => item.id !== department.id),
                      );
                      setMessage(
                        `${department.name} removed; its categories are unsorted.`,
                      );
                    }}
                  >
                    ×
                  </button>
                </div>
                <ul
                  className="gallery-departments-editor__chips"
                  aria-label={`Categories in ${department.name}`}
                >
                  {visible.map((id, index) =>
                    chip(id, departmentIndex, index, department.id),
                  )}
                  {visible.length === 0 && (
                    <li className="gallery-departments-editor__empty">
                      Drop categories here
                    </li>
                  )}
                </ul>
              </li>
            );
          })}
        </ol>
        <div
          className="gallery-departments-editor__unsorted"
          data-drop-target={
            (dragging?.kind === "category" && target?.department === null) ||
            undefined
          }
          onDragOver={(event) => overCategory(event, null, unsorted.length)}
          onDrop={dropCategory}
        >
          <p>
            Unsorted <small>shown as Other</small>
          </p>
          <ul
            aria-label="Unsorted categories"
            className="gallery-departments-editor__chips"
          >
            {unsorted.map((category, index) =>
              chip(category.id, -1, index, null),
            )}
            {unsorted.length === 0 && (
              <li className="gallery-departments-editor__empty">
                Every category has a department
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="gallery-departments-editor__actions">
        <button
          type="button"
          disabled={departments.length >= MAX_DEPARTMENTS}
          onClick={() => {
            const added = newDepartment(departments);
            onChange([...departments, added]);
            focusLater(
              `[aria-label="Name of department ${departments.length + 1}"]`,
            );
          }}
        >
          + Add department
        </button>
        {settings.departments && (
          <button type="button" onClick={() => onChange(undefined)}>
            Use suggested departments
          </button>
        )}
      </div>
      <p className="gallery-sr-only" aria-live="polite">
        {message}
      </p>
    </fieldset>
  );
}
