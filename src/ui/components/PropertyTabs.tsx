"use client";
import { useEffect, useRef, useState } from "react";
import { propertyTabIcons } from "./propertyTabIcons";
import "./curatorTheme.css";

// Names too long for a sixth of a narrow column.
const shortNames: Record<string, string> = {
  Typography: "Type",
  Composition: "Layout",
  Introduction: "Intro",
};

/**
 * The tabs of a properties panel: one group of settings at a time instead of a long
 * scroll. The caller renders each panel with `propertyPanel(prefix, name, value)` so
 * tabs and panels name each other. Arrow keys move between tabs, Home and End jump to
 * the ends. Each tab shows its drawing over its name, in one segmented row.
 */
export function PropertyTabs<T extends string>({
  label,
  idPrefix,
  tabs,
  value,
  onChange,
}: {
  label: string;
  idPrefix: string;
  tabs: readonly T[];
  value: T;
  onChange: (tab: T) => void;
}) {
  const move = (next: T) => {
    onChange(next);
    document.getElementById(`${idPrefix}-tab-${next}`)?.focus();
  };
  // On a phone the page flows, and once the tabs scroll out of view they wait folded
  // on the left edge: pressing the handle unfolds them, and choosing one brings the
  // controls back into view.
  const list = useRef<HTMLDivElement>(null);
  const [away, setAway] = useState(false);
  const [unfolded, setUnfolded] = useState(false);
  useEffect(() => {
    const node = list.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const narrow = window.matchMedia?.("(max-width: 899px)");
    const observer = new IntersectionObserver(
      ([entry]) => {
        const gone = !entry.isIntersecting && Boolean(narrow?.matches);
        setAway(gone);
        if (!gone) setUnfolded(false);
      },
      // Below the floating logo and account.
      { rootMargin: "-72px 0px 0px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const choose = (name: T) => {
    onChange(name);
    setUnfolded(false);
    const top =
      (list.current?.getBoundingClientRect().top ?? 0) + window.scrollY;
    window.scrollTo({ top: Math.max(0, top - 80), behavior: "smooth" });
  };
  return (
    <>
      {away && (
        <nav
          className={`property-tabs-aside${unfolded ? " is-open" : ""}`}
          aria-label={`${label} (shortcut)`}
        >
          <button
            type="button"
            className="property-tabs-aside__handle"
            aria-expanded={unfolded}
            aria-label={`${label}: ${value}`}
            title={value}
            onClick={() => setUnfolded(!unfolded)}
          >
            {propertyTabIcons[value]}
          </button>
          {unfolded && (
            <div className="property-tabs-aside__list">
              {tabs.map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-current={value === name ? "true" : undefined}
                  onClick={() => choose(name)}
                >
                  {propertyTabIcons[name]}
                  <span>{name}</span>
                </button>
              ))}
            </div>
          )}
        </nav>
      )}
      <div
        ref={list}
        role="tablist"
        aria-label={label}
        className="property-tabs"
        onKeyDown={(event) => {
          const index = tabs.indexOf(value);
          const target =
            event.key === "ArrowRight"
              ? tabs[(index + 1) % tabs.length]
              : event.key === "ArrowLeft"
                ? tabs[(index - 1 + tabs.length) % tabs.length]
                : event.key === "Home"
                  ? tabs[0]
                  : event.key === "End"
                    ? tabs[tabs.length - 1]
                    : undefined;
          if (!target) return;
          event.preventDefault();
          move(target);
        }}
      >
        {tabs.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${name}`}
            aria-controls={`${idPrefix}-panel-${name}`}
            aria-selected={value === name}
            tabIndex={value === name ? 0 : -1}
            aria-label={name}
            title={name}
            onClick={() => onChange(name)}
          >
            {propertyTabIcons[name]}
            <span aria-hidden="true">{shortNames[name] ?? name}</span>
          </button>
        ))}
      </div>
    </>
  );
}

/** The attributes of the panel a tab controls; hidden panels keep their state. */
export function propertyPanel(idPrefix: string, name: string, value: string) {
  return {
    role: "tabpanel",
    id: `${idPrefix}-panel-${name}`,
    "aria-labelledby": `${idPrefix}-tab-${name}`,
    hidden: value !== name,
  } as const;
}
