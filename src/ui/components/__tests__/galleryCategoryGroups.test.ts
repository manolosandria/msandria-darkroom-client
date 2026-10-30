import { describe, expect, it } from "vitest";
import {
  editableDepartments,
  galleryDepartments,
} from "../galleryCategoryGroups";

const categories = [
  { id: "animal", name: "Animal" },
  { id: "bw", name: "Black and white" },
  { id: "rain", name: "Rain" },
  { id: "street", name: "Street" },
];

describe("Gallery departments", () => {
  it("groups by the built-in vocabulary until the curator arranges departments", () => {
    const groups = galleryDepartments(categories, { categories: [] });
    expect(groups.map((group) => group.label)).toEqual([
      "Subjects",
      "Color & treatment",
      "Other",
    ]);
    expect(groups[0].categories.map((category) => category.id)).toEqual([
      "animal",
      "street",
    ]);
  });

  it("follows the curator's order and closes with the unsorted categories", () => {
    const groups = galleryDepartments(categories, {
      categories: [],
      departments: [
        { id: "mood", name: "Mood", categoryIds: ["rain", "gone", "street"] },
        { id: "empty", name: "Empty", categoryIds: [] },
        { id: "again", name: "Again", categoryIds: ["street"] },
      ],
    });
    expect(
      groups.map((group) => [
        group.label,
        group.categories.map((category) => category.id),
      ]),
    ).toEqual([
      ["Mood", ["rain", "street"]],
      ["Other", ["animal", "bw"]],
    ]);
  });

  it("starts editing from the suggested grouping, without Other", () => {
    expect(editableDepartments(categories, { categories: [] })).toEqual([
      { id: "subjects", name: "Subjects", categoryIds: ["animal", "street"] },
      { id: "color-treatment", name: "Color & treatment", categoryIds: ["bw"] },
    ]);
    const departments = [{ id: "a", name: "A", categoryIds: ["rain"] }];
    const copy = editableDepartments(categories, { categories: [], departments });
    expect(copy).toEqual(departments);
    expect(copy[0].categoryIds).not.toBe(departments[0].categoryIds);
  });
});
