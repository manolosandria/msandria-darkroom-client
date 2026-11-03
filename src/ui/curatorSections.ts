// Curator's menu, by what each part is for: the site as a whole and its public sections,
// the palette library, the photographs and what is done with them, and the
// administration. Shared by Curator itself and the shortcut the header offers the
// administrator everywhere else.
export const curatorGroups = [
  { name: "Curator", sections: ["General", "Home", "Gallery", "Collections"] },
  { name: "Palettes", sections: ["Palettes"] },
  { name: "Photos", sections: ["Photos", "Upload", "Categories", "Variants"] },
  { name: "Admin", sections: ["Dashboard", "Comments", "Inbox"] },
] as const;

export type CuratorGroup = (typeof curatorGroups)[number];
export type CuratorSection = CuratorGroup["sections"][number];

export const curatorSections: readonly CuratorSection[] = curatorGroups.flatMap(
  (group) => group.sections,
);

export const curatorGroupOf = (section: CuratorSection): CuratorGroup =>
  curatorGroups.find((group) =>
    (group.sections as readonly CuratorSection[]).includes(section),
  )!;

// The tab Curator opened last in this browser tab, kept by Curator itself.
export const CURATOR_SECTION_KEY = "curatorSection";
