import { describe, expect, it } from "vitest";
import {
  moveCategory,
  moveDepartment,
  newDepartment,
} from "../galleryDepartmentEdits";

const departments = [
  { id: "subjects", name: "Subjects", categoryIds: ["animal", "street", "people"] },
  { id: "color", name: "Color", categoryIds: ["bw"] },
];

describe("Gallery department edits", () => {
  it("reorders a category within its department", () => {
    expect(moveCategory(departments, "people", "subjects", 0)[0].categoryIds).toEqual([
      "people",
      "animal",
      "street",
    ]);
  });

  it("moves a category to another department or out of every one", () => {
    const moved = moveCategory(departments, "street", "color", 0);
    expect(moved[0].categoryIds).toEqual(["animal", "people"]);
    expect(moved[1].categoryIds).toEqual(["street", "bw"]);
    const appended = moveCategory(departments, "animal", "color");
    expect(appended[1].categoryIds).toEqual(["bw", "animal"]);
    const unsorted = moveCategory(departments, "bw", null);
    expect(unsorted.flatMap((department) => department.categoryIds)).not.toContain(
      "bw",
    );
  });

  it("reorders departments and ignores moves that change nothing", () => {
    expect(moveDepartment(departments, 1, 0).map((item) => item.id)).toEqual([
      "color",
      "subjects",
    ]);
    expect(moveDepartment(departments, 0, 0)).toBe(departments);
    expect(moveDepartment(departments, 5, 0)).toBe(departments);
  });

  it("names a new department without repeating an existing name", () => {
    const added = newDepartment([
      ...departments,
      { id: "x", name: "Department 3", categoryIds: [] },
    ]);
    expect(added.name).toBe("Department 4");
    expect(added.id).toMatch(/^d-[0-9a-f]{8}$/);
    expect(added.categoryIds).toEqual([]);
  });
});
