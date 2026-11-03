"use client";
import "./curatorPill.css";
import Link from "next/link";
import { ReactNode, useEffect, useRef, useState } from "react";
import {
  CURATOR_SECTION_KEY,
  curatorGroups,
  CuratorSection,
  curatorSections,
} from "@/src/ui/curatorSections";

/**
 * Curator folded into one floating pill, like the site's docked logo: it names the group
 * and the tab, and pointing at it, tabbing into it or pressing it opens every group
 * under it. Lit (the plasma of the open group) inside Curator; off everywhere else,
 * where it is the administrator's way back in.
 */
export function CuratorPill({
  lit,
  group,
  tab,
  badge = 0,
  renderItem,
}: {
  lit: boolean;
  group: string;
  tab: string;
  badge?: number;
  /** One section in the menu; `close` folds the menu after a choice. */
  renderItem: (section: CuratorSection, close: () => void) => ReactNode;
}) {
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
      className={`curator-pill${open ? " is-open" : ""}`}
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
        aria-label={`Curator sections: ${group}, ${tab}`}
        onClick={() => setOpen(!open)}
      >
        <span className="curator-pill__group">{group}</span>
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
        aria-label="Curator sections"
      >
        {curatorGroups.map((item) => (
          <div key={item.name} className="curator-pill__list">
            <span className="curator-pill__label">{item.name}</span>
            {item.sections.map((section) => renderItem(section, close))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The administrator's way back into Curator from any other page: the same pill, off,
 * naming the tab Curator had open, with every section as a link.
 */
export function CuratorShortcut({ pending = 0 }: { pending?: number }) {
  const [last, setLast] = useState<string>("Dashboard");
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(CURATOR_SECTION_KEY);
      if (stored && curatorSections.includes(stored as CuratorSection))
        queueMicrotask(() => setLast(stored));
    } catch {
      /* Without storage the shortcut names the Dashboard. */
    }
  }, []);
  return (
    <CuratorPill
      lit={false}
      group="Curator"
      tab={last}
      badge={pending}
      renderItem={(section, close) => (
        <Link
          key={section}
          href={`/curator?section=${section}`}
          onClick={close}
        >
          {section}
        </Link>
      )}
    />
  );
}
