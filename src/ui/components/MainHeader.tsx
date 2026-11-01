"use client";

import "./navigation.css";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import SessionMenu from "./SessionMenu";
import { useSessionValue } from "./SessionProvider";
import { useCuratorNotifications } from "./CuratorNotifications";
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

export default function MainHeader() {
  const pathname = usePathname();
  const { user } = useSessionValue();
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
  const hideButton = useRef<HTMLButtonElement>(null);
  const revealButton = useRef<HTMLButtonElement>(null);
  const moveFocus = useRef(false);

  // The control just pressed disappears, so focus follows to its counterpart once the
  // other one can take it.
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    (hidden ? revealButton : hideButton).current?.focus();
  }, [hidden]);

  function toggle(next: boolean) {
    moveFocus.current = true;
    setAnimated(true);
    setHidden(next);
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
      data-animated={animated ? "true" : undefined}
    >
      <div className="site-header__fold" id={panelId} inert={hidden}>
        <div className="site-header__fold-inner">
          <header className="main-header">
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
            <div className="main-header__actions">
              <nav aria-label="Main navigation" className="main-header__nav">
                {navLinks}
              </nav>
              <div className="main-header__tools">
                <SessionMenu />
                <button
                  ref={hideButton}
                  type="button"
                  className="main-header__hide"
                  aria-label="Hide header"
                  aria-controls={panelId}
                  aria-expanded={!hidden}
                  title="Hide header"
                  onClick={() => toggle(true)}
                >
                  <Chevron direction="up" />
                </button>
              </div>
            </div>
          </header>
        </div>
      </div>
      {/* Folded, the header is only its logo, floating translucent in the corner; the
          menu opens under it on hover or keyboard focus, and the chevron pins the
          header back. Nothing of it takes a row of the page. */}
      <div className="site-header__dock" inert={!hidden}>
        {hidden && (
          <>
            <div className="site-header__dock-pill">
              <Link
                href="/"
                aria-label="Manolo Sandria — home"
                className="site-header__dock-logo"
              >
                <Image
                  src="/images/branding/manolo-logo-black.svg"
                  alt=""
                  width={384}
                  height={96}
                />
              </Link>
              <button
                ref={revealButton}
                type="button"
                className="site-header__reveal"
                aria-label={
                  canPublish && pending > 0
                    ? `Show header, ${pending} pending notifications`
                    : "Show header"
                }
                aria-controls={panelId}
                aria-expanded={!hidden}
                title="Show the header"
                onClick={() => toggle(false)}
              >
                <Chevron direction="down" />
                {canPublish && pending > 0 && (
                  <span
                    className="site-header__reveal-dot"
                    aria-hidden="true"
                  />
                )}
              </button>
            </div>
            <nav
              aria-label="Main navigation"
              className="site-header__dock-menu"
            >
              {navLinks}
            </nav>
          </>
        )}
      </div>
    </div>
  );
}
