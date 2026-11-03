"use client";

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";

/** Three bars, the usual sign for "the menu is here". */
export function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The menu as a sheet over the page, closed by Escape, a press outside or a link. */
export function MenuSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const sheet = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    sheet.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="menu-sheet" onClick={onClose}>
      <nav
        ref={sheet}
        aria-label="Main navigation"
        className="menu-sheet__panel"
        onClick={(event) => {
          // A link closes it; any other press inside keeps it open.
          if (!(event.target as Element).closest("a")) event.stopPropagation();
        }}
      >
        {children}
      </nav>
    </div>
  );
}

export type EdgePlace = { edge: "left" | "right" | "top" | "bottom"; at: number };
const KEY = "menuButtonPlace";
const fallback: EdgePlace = { edge: "right", at: 88 };

function readPlace(): EdgePlace {
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    if (
      value &&
      ["left", "right", "top", "bottom"].includes(value.edge) &&
      typeof value.at === "number"
    )
      return { edge: value.edge, at: Math.min(95, Math.max(5, value.at)) };
  } catch {
    /* A remembered place is a convenience. */
  }
  return fallback;
}

/** The nearest window edge to a point, and where along it, as a share. */
export function nearestEdge(
  x: number,
  y: number,
  width: number,
  height: number,
): EdgePlace {
  const distances = { left: x, right: width - x, top: y, bottom: height - y };
  const edge = (Object.keys(distances) as EdgePlace["edge"][]).reduce(
    (best, side) => (distances[side] < distances[best] ? side : best),
  );
  const along = edge === "left" || edge === "right" ? y / height : x / width;
  return { edge, at: Math.min(95, Math.max(5, Math.round(along * 100))) };
}

/**
 * A round menu button that floats on an edge of the window (bottom right at first).
 * Dragged, it follows the pointer and settles on the nearest edge, where it stays from
 * page to page; a press without dragging opens the menu.
 */
export function MenuButton({
  onOpen,
  badge,
  from,
}: {
  onOpen: () => void;
  badge?: boolean;
  /** Where the header's three bars were: the button flies from there to its edge. */
  from?: DOMRect | null;
}) {
  const button = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const element = button.current;
    if (
      !from ||
      !element?.animate ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const to = element.getBoundingClientRect();
    if (!to.width) return;
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    // Only the movement: the button keeps its own placement transform.
    element.animate(
      [
        { translate: `${dx}px ${dy}px`, scale: from.width / to.width },
        { translate: "0 0", scale: 1 },
      ],
      { duration: 520, easing: "cubic-bezier(.22,.8,.24,1)" },
    );
    // Each time the header leaves and hands over a new starting point.
  }, [from]);
  const [place, setPlace] = useState<EdgePlace>(fallback);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const dragged = useRef(false);
  useEffect(() => {
    queueMicrotask(() => setPlace(readPlace()));
  }, []);
  const style: React.CSSProperties = drag
    ? { left: drag.x, top: drag.y, transform: "translate(-50%, -50%)" }
    : place.edge === "left" || place.edge === "right"
      ? { [place.edge]: 12, top: `${place.at}%`, transform: "translateY(-50%)" }
      : { [place.edge]: 12, left: `${place.at}%`, transform: "translateX(-50%)" };
  return (
    <button
      ref={button}
      type="button"
      className={`menu-button${drag ? " is-dragging" : ""}`}
      aria-label="Open the menu"
      title="Menu (drag to move it to another edge)"
      style={style}
      onPointerDown={(event) => {
        start.current = { x: event.clientX, y: event.clientY, moved: false };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const origin = start.current;
        if (!origin) return;
        if (
          !origin.moved &&
          Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < 6
        )
          return;
        origin.moved = true;
        setDrag({ x: event.clientX, y: event.clientY });
      }}
      onPointerUp={(event) => {
        const origin = start.current;
        start.current = null;
        dragged.current = !!origin?.moved;
        if (!origin?.moved) return;
        const next = nearestEdge(
          event.clientX,
          event.clientY,
          window.innerWidth,
          window.innerHeight,
        );
        setDrag(null);
        setPlace(next);
        try {
          window.localStorage.setItem(KEY, JSON.stringify(next));
        } catch {
          /* It stays for this page. */
        }
      }}
      onPointerCancel={() => {
        start.current = null;
        setDrag(null);
      }}
      onClick={() => {
        // The click that ends a drag does not open the menu.
        if (dragged.current) dragged.current = false;
        else onOpen();
      }}
    >
      <MenuIcon />
      {badge && <span className="site-header__reveal-dot" aria-hidden="true" />}
    </button>
  );
}
