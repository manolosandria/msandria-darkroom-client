import { galleryFonts } from "./GallerySettings";

/** Light, dark, or whichever the visitor's system is set to. */
export type SiteHeaderTone = "light" | "dark" | "auto";
export type SiteHeaderMaterial = "solid" | "glass";
/** One tone of the header picked by hand; without it, the palette decides. */
export type SiteHeaderColors = { background: string; text: string };
export type SiteNavAlign = "start" | "center" | "end";
export type SiteFont = "serif" | "sans" | "mono";

/** The look shared by every page, edited in Curator → Sections → General. */
export type SiteSettings = {
  header: {
    tone: SiteHeaderTone;
    material: SiteHeaderMaterial;
    navAlign: SiteNavAlign;
    // Scrolling down hides the header and leaves the floating logo with the menu.
    hideOnScroll: boolean;
    light?: SiteHeaderColors;
    dark?: SiteHeaderColors;
  };
  headingFont: SiteFont;
  bodyFont: SiteFont;
  palette: { background: string; text: string; accent: string; surface: string };
  version: number;
};

/** What the site looked like before it could be configured. */
export const defaultSiteSettings: SiteSettings = {
  header: {
    tone: "light",
    material: "solid",
    navAlign: "end",
    hideOnScroll: true,
  },
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

// Before tone and material, the header had a single `style`.
const legacyStyles: Record<string, Pick<SiteSettings["header"], "tone" | "material">> = {
  light: { tone: "light", material: "solid" },
  dark: { tone: "dark", material: "solid" },
  glass: { tone: "light", material: "glass" },
};

/** Loaded settings completed with the defaults, an older `style` read as tone and material. */
export function withSiteDefaults(loaded: Partial<SiteSettings>): SiteSettings {
  const { style, ...header } = (loaded.header ?? {}) as Partial<
    SiteSettings["header"]
  > & { style?: string };
  return {
    ...defaultSiteSettings,
    ...loaded,
    header: {
      ...defaultSiteSettings.header,
      ...(style ? legacyStyles[style] : undefined),
      ...header,
    },
  };
}

/** Everything a header needs to paint one tone. */
export type HeaderTheme = {
  background: string;
  text: string;
  line: string;
  hover: string;
  // A dark ground turns the black logo white.
  darkGround: boolean;
  // Where the colors came from: the palette, or the curator's own choice.
  custom: boolean;
};

const channels = (hex: string) =>
  [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));

export function luminance(hex: string) {
  const [r, g, b] = channels(hex).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colors, from 1 to 21. */
export function contrastRatio(a: string, b: string) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/** `share` of `over` laid on `under`. */
export function mixHex(under: string, over: string, share: number) {
  const a = channels(under);
  const b = channels(over);
  return `#${a
    .map((value, index) =>
      Math.round(value + (b[index] - value) * share)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** The least contrast the header's links may have against its ground. */
export const headerMinimumContrast = 4.5;

function theme(colors: SiteHeaderColors, custom: boolean): HeaderTheme {
  let { text } = colors;
  const { background } = colors;
  // The palette's own text may be too faint on its ground: then black or white wins.
  if (!custom && contrastRatio(background, text) < headerMinimumContrast)
    text =
      contrastRatio(background, "#ffffff") >= contrastRatio(background, "#000000")
        ? "#ffffff"
        : "#000000";
  return {
    background,
    text,
    line: mixHex(background, text, 0.14),
    hover: mixHex(background, text, 0.08),
    darkGround: luminance(background) < 0.2,
    custom,
  };
}

/**
 * The header's two tones. Each comes from the main palette (light: its surface and
 * text; dark: its text as the ground and its background as the words) unless the
 * curator picked it by hand.
 */
export function headerThemes(settings: Pick<SiteSettings, "header" | "palette">) {
  const { palette, header } = settings;
  return {
    light: header.light
      ? theme(header.light, true)
      : theme({ background: palette.surface, text: palette.text }, false),
    dark: header.dark
      ? theme(header.dark, true)
      : theme({ background: palette.text, text: palette.background }, false),
  };
}

/** The two tones as the custom properties the header's styles read. */
export function headerThemeProperties(
  settings: Pick<SiteSettings, "header" | "palette">,
): Record<string, string> {
  const themes = headerThemes(settings);
  const properties: Record<string, string> = {};
  for (const tone of ["light", "dark"] as const) {
    const value = themes[tone];
    properties[`--header-${tone}-bg`] = value.background;
    properties[`--header-${tone}-text`] = value.text;
    properties[`--header-${tone}-line`] = value.line;
    properties[`--header-${tone}-hover`] = value.hover;
    properties[`--header-${tone}-logo`] = value.darkGround ? "invert(1)" : "none";
  }
  return properties;
}
