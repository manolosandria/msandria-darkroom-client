"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  defaultSiteSettings,
  SiteSettings,
  siteFonts,
} from "@/src/domain/entities/SiteSettings";
import { manageSiteSettings } from "@/src/infrastructure/siteSettingsServices";
import type { ManageSiteSettings } from "@/src/application/use-cases/ManageSiteSettings";

type SiteSettingsValue = {
  settings: SiteSettings;
  // Takes what Curator just saved, so the page follows without asking again.
  adopt: (settings: SiteSettings) => void;
};

const SiteSettingsContext = createContext<SiteSettingsValue>({
  settings: defaultSiteSettings,
  adopt: () => {},
});

/** The site's palette and fonts as custom properties on the root element. */
export function applySiteSettings(settings: SiteSettings, root: HTMLElement) {
  const { palette } = settings;
  root.style.setProperty("--site-background", palette.background);
  root.style.setProperty("--site-text", palette.text);
  root.style.setProperty("--site-accent", palette.accent);
  root.style.setProperty("--site-surface", palette.surface);
  root.style.setProperty("--site-heading-font", siteFonts[settings.headingFont]);
  root.style.setProperty("--site-body-font", siteFonts[settings.bodyFont]);
}

/**
 * Loads the general settings once for the whole page. Until they arrive, and if they
 * cannot be loaded, the site keeps its original look.
 */
export function SiteSettingsProvider({
  children,
  service = manageSiteSettings,
}: {
  children: React.ReactNode;
  service?: Pick<ManageSiteSettings, "get">;
}) {
  const [settings, setSettings] = useState(defaultSiteSettings);
  const [source] = useState(() => service);
  useEffect(() => {
    let live = true;
    source
      .get()
      .then((loaded) => {
        if (live) setSettings({ ...defaultSiteSettings, ...loaded });
      })
      .catch(() => {
        /* The original look stays. */
      });
    return () => {
      live = false;
    };
  }, [source]);
  useEffect(() => {
    applySiteSettings(settings, document.documentElement);
  }, [settings]);
  const value = useMemo(() => ({ settings, adopt: setSettings }), [settings]);
  return (
    <SiteSettingsContext.Provider value={value}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export const useSiteSettings = () => useContext(SiteSettingsContext);
