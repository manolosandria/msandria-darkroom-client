import { CatalogCategory } from "@/src/domain/entities/Catalog";

// Presentation vocabulary until categories have an editable group in the catalog.
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

export function groupGalleryCategories(
  categories: CatalogCategory[],
  assignments: { categoryId: string; group: string }[] = [],
) {
  const groups = [
    ...vocabulary.map(({ label }) => ({
      label,
      categories: [] as CatalogCategory[],
    })),
    { label: "Other", categories: [] as CatalogCategory[] },
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
