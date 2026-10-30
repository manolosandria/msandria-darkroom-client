export type GalleryVisitorOptions = {
  layouts: string[];
  crops: string[];
};
export type GalleryPalette = {
  id: string;
  name: string;
  background: string;
  text: string;
  accent: string;
  surface: string;
};
export const defaultVisitorOptions: GalleryVisitorOptions = {
  layouts: ["random", "uniform", "justified"],
  crops: ["mixed", "square", "rectangular"],
};
export const defaultGalleryPalettes: GalleryPalette[] = [
  {
    id: "archive",
    name: "Archive",
    background: "#ffffff",
    text: "#171717",
    accent: "#384e2b",
    surface: "#f5f6ef",
  },
  {
    id: "night",
    name: "Night",
    background: "#171b20",
    text: "#f0eee7",
    accent: "#a9c78a",
    surface: "#2b333b",
  },
  {
    id: "sand",
    name: "Sand",
    background: "#f4eee2",
    text: "#352f28",
    accent: "#85502d",
    surface: "#e9dec9",
  },
];
export const galleryLayoutLabels: Record<string, string> = {
  uniform: "Squares",
  random: "Random emphasis",
  justified: "Natural proportions",
};
export const galleryCropLabels: Record<string, string> = {
  mixed: "Combined views",
  square: "Square views",
  rectangular: "Rectangular views",
  portrait: "Portrait views",
  landscape: "Landscape views",
};
export type GalleryAppearance = {
  font: string;
  background: string;
  text: string;
  accent: string;
  surface: string;
  layout: string;
  tileSize: number;
  gap: number;
};
export type GalleryText = {
  kind: string;
  text: string;
  size: number;
  font: string;
};
export type GalleryCategoryStyle = {
  categoryId: string;
  group: string;
  customize: boolean;
  appearance: GalleryAppearance;
};
/** A department offers its categories, in this order, as one column of filters. */
export type GalleryDepartment = {
  id: string;
  name: string;
  categoryIds: string[];
};
export const galleryPageBlocks = ["heading", "filters", "photos"] as const;
export type GalleryPageBlock = (typeof galleryPageBlocks)[number];
/**
 * How the page splits into cards: each group is one card holding its blocks in
 * reading order, and every block appears exactly once.
 */
export type GalleryPageLayout = {
  groups: GalleryPageBlock[][];
  /** Where the filters go when they follow or precede the title directly. */
  filtersPlacement: "below" | "side";
  headingAlign: "start" | "center" | "end";
};
export const defaultGalleryPageLayout: GalleryPageLayout = {
  groups: [["heading", "filters"], ["photos"]],
  filtersPlacement: "side",
  headingAlign: "start",
};
export const galleryPageBlockLabels: Record<GalleryPageBlock, string> = {
  heading: "Title",
  filters: "Filters",
  photos: "Photographs",
};
export type GallerySettings = {
  version: number;
  /** Without it, the title and filters share a card and the photographs have theirs. */
  pageLayout?: GalleryPageLayout;
  visitorOptions?: GalleryVisitorOptions;
  palettes?: GalleryPalette[];
  /** Without it, categories are grouped by the built-in vocabulary. */
  departments?: GalleryDepartment[];
  blocks: GalleryText[];
  appearance: GalleryAppearance;
  categories: GalleryCategoryStyle[];
};
export const defaultGallerySettings: GallerySettings = {
  version: 1,
  visitorOptions: defaultVisitorOptions,
  palettes: defaultGalleryPalettes,
  blocks: [
    { kind: "eyebrow", text: "Explore the archive", size: 11, font: "sans" },
    { kind: "title", text: "Gallery", size: 80, font: "inherit" },
    {
      kind: "body",
      text: "A fresh perspective, twelve photographs at a time.",
      size: 17,
      font: "sans",
    },
  ],
  appearance: {
    font: "serif",
    background: "#ffffff",
    text: "#171717",
    accent: "#384e2b",
    surface: "#f5f6ef",
    layout: "random",
    tileSize: 220,
    gap: 12,
  },
  categories: [],
};
export const galleryFonts: Record<string, string> = {
  serif: "Georgia, serif",
  sans: "Arial, sans-serif",
  mono: "'Courier New', monospace",
};
export interface GallerySettingsRepository {
  get(): Promise<GallerySettings>;
  save(settings: GallerySettings): Promise<GallerySettings>;
}
