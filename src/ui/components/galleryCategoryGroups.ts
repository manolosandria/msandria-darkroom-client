import { CatalogCategory } from "@/src/domain/entities/Catalog";
import {
  GalleryDepartment,
  GallerySettings,
} from "@/src/domain/entities/GallerySettings";

// Presentation vocabulary for galleries whose curator has not arranged departments.
// Unknown names stay visible in Other rather than being assigned a meaning.
const vocabulary = [
  {
    label: "Subjects",
    names: [
      "animal",
      "animals",
      "people",
      "portrait",
      "portraits",
      "architecture",
      "landscape",
      "landscapes",
      "nature",
      "wildlife",
      "plants",
      "street",
    ],
  },
  {
    label: "Color & treatment",
    names: [
      "color",
      "colour",
      "black and white",
      "black & white",
      "b&w",
      "monochrome",
      "red",
      "orange",
      "yellow",
      "green",
      "blue",
      "purple",
      "pink",
      "warm",
      "cool",
    ],
  },
  {
    label: "Themes",
    names: [
      "solitude",
      "movement",
      "daily life",
      "memory",
      "travel",
      "urban",
      "abstract",
    ],
  },
];

export const OTHER_DEPARTMENT = "Other";

export type GalleryDepartmentView = {
  id: string;
  label: string;
  categories: CatalogCategory[];
};

const slug = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "department";

export function groupGalleryCategories(
  categories: CatalogCategory[],
  assignments: { categoryId: string; group: string }[] = [],
): GalleryDepartmentView[] {
  const groups = [
    ...vocabulary.map(({ label }) => ({
      id: slug(label),
      label,
      categories: [] as CatalogCategory[],
    })),
    { id: "other", label: OTHER_DEPARTMENT, categories: [] as CatalogCategory[] },
  ];
  for (const category of categories) {
    const assigned = assignments.find(
      (item) => item.categoryId === category.id,
    );
    const assignedIndex = groups.findIndex(
      (group) => group.label === assigned?.group,
    );
    const index =
      assignedIndex >= 0
        ? assignedIndex
        : vocabulary.findIndex((group) =>
            group.names.includes(category.name.trim().toLowerCase()),
          );
    groups[index < 0 ? groups.length - 1 : index].categories.push(category);
  }
  return groups.filter((group) => group.categories.length > 0);
}

/**
 * The departments the gallery offers, in order, each with its categories in order.
 * Categories the curator left out of every department close the list under Other.
 */
export function galleryDepartments(
  categories: CatalogCategory[],
  settings: Pick<GallerySettings, "departments" | "categories">,
): GalleryDepartmentView[] {
  if (!settings.departments)
    return groupGalleryCategories(categories, settings.categories);
  const byId = new Map(categories.map((category) => [category.id, category]));
  const placed = new Set<string>();
  const departments = settings.departments.map((department) => ({
    id: department.id,
    label: department.name,
    categories: department.categoryIds.flatMap((id) => {
      const category = byId.get(id);
      if (!category || placed.has(id)) return [];
      placed.add(id);
      return [category];
    }),
  }));
  const rest = categories.filter((category) => !placed.has(category.id));
  return [
    ...departments,
    // Saved ids are generated, so this one never meets a curator's department.
    { id: "_unsorted", label: OTHER_DEPARTMENT, categories: rest },
  ].filter((department) => department.categories.length > 0);
}

/** Editable departments: the saved ones, or the built-in grouping as a start. */
export function editableDepartments(
  categories: CatalogCategory[],
  settings: Pick<GallerySettings, "departments" | "categories">,
): GalleryDepartment[] {
  if (settings.departments)
    return settings.departments.map((department) => ({
      ...department,
      categoryIds: [...department.categoryIds],
    }));
  return groupGalleryCategories(categories, settings.categories)
    .filter((group) => group.label !== OTHER_DEPARTMENT)
    .map((group) => ({
      id: group.id,
      name: group.label,
      categoryIds: group.categories.map((category) => category.id),
    }));
}
