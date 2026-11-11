"use client";
import { usePathname } from "next/navigation";
import { SocialLinkList } from "./SocialLinkList";
import { useSiteSettings } from "./SiteSettingsProvider";

// Screens that fill the window, where a footer would only be scrolled into by accident.
const withoutFooter = ["/curator", "/photo/", "/upload", "/manage", "/moderate"];

/**
 * A quiet line at the very end of the public pages with the owner's profiles
 * elsewhere, after the photographs rather than beside them. It is not drawn when the
 * general settings have no links.
 */
export function SiteFooter() {
  const pathname = usePathname() ?? "/";
  const { settings } = useSiteSettings();
  if (!settings.socialLinks.length) return null;
  if (withoutFooter.some((path) => pathname.startsWith(path))) return null;
  return (
    <footer className="site-footer">
      <SocialLinkList links={settings.socialLinks} />
    </footer>
  );
}
