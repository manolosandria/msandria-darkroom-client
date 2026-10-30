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
export const welcomePositions = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
] as const;
export type WelcomePosition = (typeof welcomePositions)[number];
/** The Welcome panel when it sits over the photograph (`text-overlay`). */
export type WelcomePanel = {
  position: WelcomePosition;
  /**
   * Free placement: the panel's top-left corner as a share of the banner, 0–100.
   * Both or neither; without them the anchor decides.
   */
  x?: number;
  y?: number;
  /** Share of the banner's width, 25–90. */
  width: number;
  panel: "solid" | "glass" | "gradient" | "none";
  panelColor: string;
  textColor: string;
  /** Corner radius in pixels, 0–32. */
  radius: number;
};
export const defaultWelcomePanel: WelcomePanel = {
  position: "bottom-left",
  width: 50,
  panel: "solid",
  panelColor: "#000000",
  textColor: "#ffffff",
  radius: 8,
};
/**
 * A slide's own title, shown instead of the general one while the slide is on show.
 * Without link text there is no link. Its panel keeps the general panel's style.
 */
export type SlideHeading = {
  eyebrow: string;
  title: string;
  accentText: string;
  linkText: string;
  href: string;
  position: WelcomePosition;
  x?: number;
  y?: number;
  /** Share of the banner's width, 25–90. */
  width: number;
  /** Title size in pixels, 24–96. */
  fontSize: number;
};
export type BannerSlide = {
  photoId: string;
  text: string;
  href: string;
  heading?: SlideHeading;
};
/** What the preview changes when the Welcome panel is dragged or resized. */
export type WelcomePlacement = Pick<
  SlideHeading,
  "x" | "y" | "width" | "fontSize"
>;
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
  welcome?: WelcomePanel;
  slides?: BannerSlide[];
  photoCrops?: { photoId: string; desktop: string; mobile: string }[];
  version: number;
};
export interface HomeBannerRepository {
  get(): Promise<HomeBanner>;
  save(banner: HomeBanner): Promise<HomeBanner>;
}
