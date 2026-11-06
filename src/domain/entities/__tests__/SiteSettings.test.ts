import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  defaultSiteSettings,
  headerThemeProperties,
  headerThemes,
  mixHex,
  withSiteDefaults,
} from "../SiteSettings";

const palette = {
  background: "#ffffff",
  text: "#171717",
  accent: "#384e2b",
  surface: "#f5f6ef",
};

describe("header themes", () => {
  it("derives the light tone from the surface and the dark one from the text", () => {
    const themes = headerThemes({ header: defaultSiteSettings.header, palette });
    expect(themes.light).toMatchObject({
      background: "#f5f6ef",
      text: "#171717",
      darkGround: false,
      custom: false,
    });
    expect(themes.dark).toMatchObject({
      background: "#171717",
      text: "#ffffff",
      darkGround: true,
      custom: false,
    });
    expect(themes.light.line).toBe(mixHex("#f5f6ef", "#171717", 0.14));
  });

  it("swaps a faint palette text for black or white", () => {
    const faint = { ...palette, surface: "#777777", text: "#888888" };
    const { light } = headerThemes({ header: defaultSiteSettings.header, palette: faint });
    expect(["#000000", "#ffffff"]).toContain(light.text);
    expect(contrastRatio(light.background, light.text)).toBeGreaterThanOrEqual(4.5);
    const pale = { ...palette, surface: "#dddddd", text: "#cccccc" };
    expect(
      headerThemes({ header: defaultSiteSettings.header, palette: pale }).light.text,
    ).toBe("#000000");
    const deep = { ...palette, surface: "#222222", text: "#333333" };
    expect(
      headerThemes({ header: defaultSiteSettings.header, palette: deep }).light.text,
    ).toBe("#ffffff");
  });

  it("keeps colors picked by hand as they are", () => {
    const header = {
      ...defaultSiteSettings.header,
      light: { background: "#eeeeee", text: "#dddddd" },
      dark: { background: "#202830", text: "#f0e0c0" },
    };
    const themes = headerThemes({ header, palette });
    expect(themes.light).toMatchObject({ text: "#dddddd", custom: true });
    expect(themes.dark).toMatchObject({ background: "#202830", custom: true });
    expect(headerThemeProperties({ header, palette })).toMatchObject({
      "--header-light-bg": "#eeeeee",
      "--header-light-logo": "none",
      "--header-dark-bg": "#202830",
      "--header-dark-logo": "invert(1)",
    });
  });

  it("measures contrast as WCAG does", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21);
    expect(contrastRatio("#ffffff", "#ffffff")).toBe(1);
  });
});

describe("withSiteDefaults", () => {
  it("reads the older style as tone and material", () => {
    for (const [style, tone, material] of [
      ["light", "light", "solid"],
      ["dark", "dark", "solid"],
      ["glass", "light", "glass"],
    ])
      expect(
        withSiteDefaults({
          header: { style, navAlign: "center", hideOnScroll: false },
        } as never).header,
      ).toEqual({ tone, material, navAlign: "center", hideOnScroll: false });
  });

  it("completes what is missing with the defaults", () => {
    expect(withSiteDefaults({})).toEqual(defaultSiteSettings);
    expect(
      withSiteDefaults({ header: { tone: "auto" } } as never).header,
    ).toEqual({ ...defaultSiteSettings.header, tone: "auto" });
  });
});
