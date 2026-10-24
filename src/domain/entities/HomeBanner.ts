export const defaultHomeBanner = {
  eyebrow: "MANOLO SANDRIA / PHOTOGRAPHY",
  title: "A moment.",
  accentText: "Another way of seeing.",
  linkText: "Explore the gallery",
  backgroundColor: "#f0f0e9",
  textColor: "#293126",
  accentColor: "#778267",
  surfaceColor: "#20251e",
  font: "serif",
  layout: "text-left",
  shape: "square",
  textAlign: "left",
  fontSize: 72,
  imageMode: "highlight",
  desktopCrop: "landscape",
  mobileCrop: "portrait",
  version: 1,
} as const;
export type HomeBanner = {
  eyebrow: string;
  title: string;
  accentText: string;
  linkText: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  surfaceColor: string;
  font: string;
  layout: string;
  shape: string;
  textAlign: string;
  fontSize: number;
  imageMode?: string;
  desktopCrop?: string;
  mobileCrop?: string;
  navigation?: string;
  controlsPosition?: string;
  bannerHeight?: number;
  overlayOpacity?: number;
  slides?: {photoId:string; text:string; href:string}[];
  photoCrops?: { photoId: string; desktop: string; mobile: string }[];
  version: number;
};
export interface HomeBannerRepository {
  get(): Promise<HomeBanner>;
  save(banner: HomeBanner): Promise<HomeBanner>;
}
