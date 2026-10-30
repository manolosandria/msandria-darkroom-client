import { GalleryDepartment } from "@/src/domain/entities/GallerySettings";

export const MAX_DEPARTMENTS = 12;

/**
 * Moves a category into a department at a position, or out of every department when
 * `departmentId` is null. The position counts the department's categories without it.
 */
export function moveCategory(
  departments: GalleryDepartment[],
  categoryId: string,
  departmentId: string | null,
  index = Number.MAX_SAFE_INTEGER,
): GalleryDepartment[] {
  return departments.map((department) => {
    const rest = department.categoryIds.filter((id) => id !== categoryId);
    if (department.id !== departmentId) return { ...department, categoryIds: rest };
    const at = Math.max(0, Math.min(index, rest.length));
    return {
      ...department,
      categoryIds: [...rest.slice(0, at), categoryId, ...rest.slice(at)],
    };
  });
}

/** Moves the department at `from` to position `to`, keeping the others in order. */
export function moveDepartment(
  departments: GalleryDepartment[],
  from: number,
  to: number,
): GalleryDepartment[] {
  if (from === to || !departments[from]) return departments;
  const next = [...departments];
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved);
  return next;
}

export function newDepartment(existing: GalleryDepartment[]): GalleryDepartment {
  let number = existing.length + 1;
  while (existing.some((department) => department.name === `Department ${number}`))
    number += 1;
  return {
    id: `d-${crypto.randomUUID().slice(0, 8)}`,
    name: `Department ${number}`,
    categoryIds: [],
  };
}
