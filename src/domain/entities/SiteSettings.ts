import { galleryFonts } from "./GallerySettings";

export type SiteHeaderStyle = "light" | "dark" | "glass";
export type SiteNavAlign = "start" | "center" | "end";
export type SiteFont = "serif" | "sans" | "mono";

/** The look shared by every page, edited in Curator → Sections → General. */
export type SiteSettings = {
  header: {
    style: SiteHeaderStyle;
    navAlign: SiteNavAlign;
    // Scrolling down hides the header and leaves the floating logo with the menu.
    hideOnScroll: boolean;
  };
  headingFont: SiteFont;
  bodyFont: SiteFont;
  palette: { background: string; text: string; accent: string; surface: string };
  version: number;
};

/** What the site looked like before it could be configured. */
export const defaultSiteSettings: SiteSettings = {
  header: { style: "light", navAlign: "end", hideOnScroll: true },
  headingFont: "serif",
  bodyFont: "sans",
  palette: {
    background: "#ffffff",
    text: "#171717",
    accent: "#384e2b",
    surface: "#f5f6ef",
  },
  version: 1,
};

export const siteFonts: Record<SiteFont, string> = galleryFonts as Record<
  SiteFont,
  string
>;

export interface SiteSettingsRepository {
  get(): Promise<SiteSettings>;
  save(settings: SiteSettings): Promise<SiteSettings>;
}
