"use client";

import "./navigation.css";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import SessionMenu from "./SessionMenu";
import { CuratorShortcut } from "./CuratorPill";
import { useSessionValue } from "./SessionProvider";
import { useCuratorNotifications } from "./CuratorNotifications";
import { useSiteSettings } from "./SiteSettingsProvider";
import { MenuButton, MenuIcon, MenuSheet } from "./MobileMenu";
import { useHeaderVisibility } from "@/src/ui/hooks/useHeaderVisibility";

function Chevron({ direction }: { direction: "up" | "down" }) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path
        d={direction === "up" ? "M5 12.5 10 7.5l5 5" : "M5 7.5l5 5 5-5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Whether the page has scrolled past the given element's height. */
function useScrolledPast(element: HTMLElement | null, enabled: boolean) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    if (!enabled || !element) return;
    const check = () => setPast(window.scrollY > element.offsetHeight);
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [element, enabled]);
  return enabled && past;
}

export default function MainHeader() {
  const pathname = usePathname();
  const { user } = useSessionValue();
  const { settings } = useSiteSettings();
  const notifications = useCuratorNotifications();
  const pending = (notifications?.comments ?? 0) + (notifications?.inbox ?? 0);
  // Offered to the administrator only, and only as a shortcut: the API turns down a
  // publish from anyone else, whatever the header chose to show.
  const canPublish = user?.isAdmin() ?? false;

  const [hidden, setHidden] = useHeaderVisibility();
  // A remembered choice applies without motion on arrival; only the visitor's own
  // toggle animates.
  const [animated, setAnimated] = useState(false);
  const panelId = useId();
  const toggleButton = useRef<HTMLButtonElement>(null);
  const [fold, setFold] = useState<HTMLDivElement | null>(null);
  const [corner, setCorner] = useState<HTMLDivElement | null>(null);
  const [cornerWidth, setCornerWidth] = useState(0);
  const scrolled = useScrolledPast(
    fold,
    settings.header.hideOnScroll && !hidden,
  );
  // Folded by hand or scrolled out of view: the logo floats with the menu on the left
  // and the account stays in the top-right corner.
  const docked = hidden || scrolled;
  // Phones open the links from a sheet: the header's three bars or the floating button.
  const [sheetOpen, setSheetOpen] = useState(false);
  // Where the three bars sat when the header left, so the floating button flies from
  // there and the visitor sees where the menu went.
  const burger = useRef<HTMLButtonElement>(null);
  const [burgerAt, setBurgerAt] = useState<DOMRect | null>(null);
  const wasDocked = useRef(docked);
  useLayoutEffect(() => {
    if (docked && !wasDocked.current) {
      // Measured now, before the header moves away; handed over right after.
      const box = burger.current?.getBoundingClientRect() ?? null;
      queueMicrotask(() => setBurgerAt(box && box.width ? box : null));
    }
    wasDocked.current = docked;
  }, [docked]);

  // The corner floats over the header's row, which leaves it room.
  useEffect(() => {
    if (!corner || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      setCornerWidth(corner.offsetWidth);
      // Curator's menu row, outside the header, leaves the same room.
      document.documentElement.style.setProperty(
        "--site-corner-width",
        `${corner.offsetWidth}px`,
      );
    });
    observer.observe(corner);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--site-corner-width");
    };
  }, [corner]);

  function toggle() {
    setAnimated(true);
    if (docked) {
      setHidden(false);
      if (scrolled) window.scrollTo({ top: 0, behavior: "smooth" });
    } else setHidden(true);
    // The same control stays where it was; a keyboard press keeps focus on it.
    if (document.activeElement !== toggleButton.current)
      toggleButton.current?.focus();
  }

  const links: [string, string][] = [
    ["/", "Home"],
    ["/gallery", "Gallery"],
    ["/collections", "Collections"],
    ...(canPublish ? ([["/curator", "Curator"]] as [string, string][]) : []),
    ["/contact", "Contact"],
  ];
  const navLinks = links.map(([href, label]) => (
    <Link
      key={href}
      href={href}
      aria-current={pathname === href ? "page" : undefined}
    >
      {label}
      {href === "/curator" && pending > 0 && (
        <span
          className="curator-badge"
          aria-label={`${pending} pending notifications`}
        >
          {pending}
        </span>
      )}
    </Link>
  ));

  return (
    <div
      className="site-header"
      data-hidden={hidden ? "true" : "false"}
      data-docked={docked ? "true" : undefined}
      data-sticky={settings.header.hideOnScroll ? undefined : "true"}
      data-style={settings.header.style}
      data-animated={animated ? "true" : undefined}
      style={{ "--corner-width": `${cornerWidth}px` } as React.CSSProperties}
    >
      <div className="site-header__fold" id={panelId} inert={hidden} ref={setFold}>
        <div className="site-header__fold-inner">
          <header
            className="main-header"
            data-align={settings.header.navAlign}
          >
            <Link
              href="/"
              aria-label="Manolo Sandria — home"
              className="main-header__brand"
            >
              <Image
                src="/images/branding/manolo-logo-black.svg"
                alt="Manolo Sandria Fotografía"
                width={384}
                height={96}
                className="w-64 max-w-full xl:w-96 h-auto py-2 md:py-0"
              />
            </Link>
            <nav aria-label="Main navigation" className="main-header__nav">
              {navLinks}
            </nav>
            <button
              ref={burger}
              type="button"
              className="main-header__burger"
              aria-label="Open the menu"
              aria-expanded={sheetOpen}
              onClick={() => setSheetOpen(true)}
            >
              <MenuIcon />
            </button>
          </header>
        </div>
      </div>
      {/* The account and the fold control, always in the top-right corner: in the
          header's row while it shows, floating once it is gone. */}
      <div className="site-header__corner" ref={setCorner}>
        {/* The administrator always has Curator folded at hand; inside Curator its
            own pill, lit, takes over. */}
        {canPublish && !pathname?.startsWith("/curator") && (
          <CuratorShortcut pending={pending} />
        )}
        <SessionMenu />
        <button
          ref={toggleButton}
          type="button"
          className="main-header__hide"
          aria-label={
            docked
              ? canPublish && pending > 0
                ? `Show header, ${pending} pending notifications`
                : "Show header"
              : "Hide header"
          }
          aria-controls={panelId}
          aria-expanded={!docked}
          title={docked ? "Show the header" : "Hide header"}
          onClick={toggle}
        >
          <Chevron direction={docked ? "down" : "up"} />
          {docked && canPublish && pending > 0 && (
            <span className="site-header__reveal-dot" aria-hidden="true" />
          )}
        </button>
      </div>
      {/* Docked, the header is only its logo, floating translucent in the top-left
          corner; the menu opens under it on hover or keyboard focus. */}
      <div className="site-header__dock" inert={!docked}>
        {docked && (
          <>
            <Link
              href="/"
              aria-label="Manolo Sandria — home"
              className="site-header__dock-pill"
            >
              <Image
                src="/images/branding/manolo-logo-black.svg"
                alt=""
                width={384}
                height={96}
                className="site-header__dock-logo"
              />
              <span className="site-header__dock-hint" aria-hidden="true">
                <Chevron direction="down" />
              </span>
            </Link>
            <nav
              aria-label="Main navigation"
              className="site-header__dock-menu"
            >
              {navLinks}
            </nav>
          </>
        )}
      </div>
      {docked && (
        <MenuButton
          from={burgerAt}
          onOpen={() => setSheetOpen(true)}
          badge={canPublish && pending > 0}
        />
      )}
      <MenuSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        {navLinks}
      </MenuSheet>
    </div>
  );
}
