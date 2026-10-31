"use client";

/**
 * The tabs of a properties panel: one group of settings at a time instead of a long
 * scroll. The caller renders each panel with `propertyPanel(prefix, name, value)` so
 * tabs and panels name each other. Arrow keys move between tabs, Home and End jump to
 * the ends.
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
  return (
    <div
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
          onClick={() => onChange(name)}
        >
          {name}
        </button>
      ))}
    </div>
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
