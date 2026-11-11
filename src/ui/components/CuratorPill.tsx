"use client";
import "./curatorPill.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";
import { curatorGroups, CuratorSection } from "@/src/ui/curatorSections";
import { SocialLinkList } from "./SocialLinkList";
import { useSiteSettings } from "./SiteSettingsProvider";
import {
  requestCuratorSection,
  useCuratorSection,
} from "@/src/ui/curatorChannel";

// The site's own pages, offered first in the menu so the pill can stand in for the
// header's links once the header is folded.
const sitePages: [string, string][] = [
  ["/", "Home"],
  ["/gallery", "Gallery"],
  ["/collections", "Collections"],
  ["/contact", "Contact"],
];
// What the pill calls the page it is on, outside Curator.
function pageName(pathname: string | null) {
  const path = pathname ?? "/";
  const page = sitePages.find(([href]) =>
    href === "/" ? path === "/" : path.startsWith(href),
  );
  if (page) return page[1];
  if (path.startsWith("/photo/")) return "Photo";
  if (path.startsWith("/profile/")) return "Profile";
  if (path.startsWith("/account")) return "Account";
  return "Menu";
}

/**
 * The page menu beside the account in the header's corner: the name of the page or
 * Curator tab on show, and pointing at it, tabbing into it or pressing it opens the
 * site's pages and, for the administrator, every Curator group under it. Inside
 * Curator it is lit (the moving plasma) and, on wide screens, says CURATOR first.
 */
export function CuratorPill({
  lit,
  group,
  tab,
  badge = 0,
  renderItem,
  footer,
}: {
  lit: boolean;
  /** The eyebrow before the name; none outside Curator. */
  group?: string;
  tab: string;
  badge?: number;
  /** One section in the menu; without it the menu lists the site's pages only. */
  renderItem?: (section: CuratorSection, close: () => void) => ReactNode;
  /** A last action under the lists. */
  footer?: (close: () => void) => ReactNode;
}) {
  const pathname = usePathname();
  const { settings } = useSiteSettings();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const close = () => setOpen(false);
  return (
    <div
      ref={root}
      className={`curator-pill${open ? " is-open" : ""}${renderItem ? "" : " is-visitor"}`}
      data-lit={lit ? "" : undefined}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        className="curator-pill__face"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`${renderItem ? "Curator and site pages" : "Site pages"}: ${tab}`}
        onClick={() => setOpen(!open)}
      >
        {group && <span className="curator-pill__group">{group}</span>}
        <span className="curator-pill__tab">{tab}</span>
        {badge > 0 && <span className="curator-badge">{badge}</span>}
        <svg
          className="curator-pill__hint"
          viewBox="0 0 12 12"
          width="10"
          height="10"
          aria-hidden="true"
        >
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <div
        className="curator-pill__menu"
        role="navigation"
        aria-label={renderItem ? "Curator sections" : "Site pages"}
      >
        {/* Each list is a group of its own: Site and Curator both have a Gallery. */}
        <div className="curator-pill__list" role="group" aria-label="Site">
          <span className="curator-pill__label" aria-hidden="true">
            Site
          </span>
          {sitePages.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              onClick={close}
            >
              {label}
            </Link>
          ))}
          {/* The owner's profiles elsewhere, beside Contact, for phones and a folded header. */}
          <SocialLinkList
            links={settings.socialLinks}
            className="curator-pill__social"
            size={18}
          />
        </div>
        {renderItem &&
          curatorGroups.map((item) => (
          <div
            key={item.name}
            className="curator-pill__list"
            role="group"
            aria-label={item.name}
          >
            <span className="curator-pill__label" aria-hidden="true">
              {item.name}
            </span>
            {item.sections.map((section) => renderItem(section, close))}
          </div>
        ))}
        {footer?.(close)}
      </div>
    </div>
  );
}

/**
 * The pill in the header's corner, for everyone. Inside Curator it is lit, names the
 * open tab and switches tabs in place; elsewhere it names the page. The administrator's
 * menu adds every Curator group, linking into Curator from other pages.
 */
export function CuratorShortcut({
  pending = 0,
  admin = true,
}: {
  pending?: number;
  admin?: boolean;
}) {
  const pathname = usePathname();
  const open = useCuratorSection();
  const inCurator = admin && Boolean(pathname?.startsWith("/curator"));
  if (!admin)
    return <CuratorPill lit={false} tab={pageName(pathname)} />;
  return (
    <CuratorPill
      lit={inCurator}
      group={inCurator ? "Curator" : undefined}
      tab={inCurator ? (open ?? "Curator") : pageName(pathname)}
      badge={pending}
      renderItem={(section, close) =>
        inCurator ? (
          <button
            key={section}
            type="button"
            aria-current={open === section ? "page" : undefined}
            onClick={() => {
              requestCuratorSection(section);
              close();
            }}
          >
            {section}
          </button>
        ) : (
          <Link
            key={section}
            href={`/curator?section=${section}`}
            onClick={close}
          >
            {section}
          </Link>
        )
      }
    />
  );
}
