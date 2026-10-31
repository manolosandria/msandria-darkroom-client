"use client";
import "./photoSectionBar.css";
import { useEffect, useId, useRef, useState } from "react";

export type SectionBarItem = {
  id: string;
  label: string;
  /** Pending work worth a count on the section's button, such as file issues. */
  badge?: number;
  /** Always shown: it holds fields the form cannot be saved without. */
  locked?: boolean;
};

const ICONS: Record<string, React.ReactNode> = {
  details: (
    <>
      <path d="M4 5h12M4 9h12M4 13h8" />
    </>
  ),
  visibility: (
    <>
      <path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10Z" />
      <circle cx="10" cy="10" r="2.4" />
    </>
  ),
  categories: (
    <>
      <path d="M3 3.5h6.2l7.3 7.3-5.7 5.7-7.3-7.3V3.5Z" />
      <circle cx="6.6" cy="7" r="1.1" />
    </>
  ),
  collections: (
    <>
      <rect x="2.5" y="6" width="11" height="10" rx="1.5" />
      <path d="M6 3.5h10a1.5 1.5 0 0 1 1.5 1.5v8" />
    </>
  ),
  variants: (
    <>
      <rect x="2.5" y="2.5" width="8" height="8" rx="1.5" />
      <rect x="9.5" y="9.5" width="8" height="8" rx="1.5" />
    </>
  ),
  frame: (
    <>
      <rect x="2.5" y="2.5" width="15" height="15" rx="1" />
      <rect x="6" y="6" width="8" height="8" />
    </>
  ),
  highlights: (
    <>
      <path d="M2.5 6.5v-4h4M13.5 2.5h4v4M17.5 13.5v4h-4M6.5 17.5h-4v-4" />
      <rect x="7" y="7" width="6" height="6" rx="0.5" />
    </>
  ),
  file: (
    <>
      <path d="M5 2.5h6.5L15.5 6.5v11H5Z" />
      <path d="M11.5 2.5v4h4" />
    </>
  ),
};

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      className="section-bar__icon"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/**
 * The inspector's map of its sections: one button per visible section to open and
 * scroll to it, expand/collapse for all of them, and a menu to hide the ones this
 * curator does not use.
 */
export function PhotoSectionBar({
  sections,
  current,
  open,
  hidden,
  onJump,
  onExpandAll,
  onCollapseAll,
  onHiddenChange,
  view = "scroll",
  onViewChange,
}: {
  sections: readonly SectionBarItem[];
  current: string;
  open: readonly string[];
  hidden: readonly string[];
  onJump: (id: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onHiddenChange: (hidden: string[]) => void;
  /** Tabs show one section at a time; scroll shows them all, as disclosures. */
  view?: "tabs" | "scroll";
  onViewChange?: (view: "tabs" | "scroll") => void;
}) {
  const visible = sections.filter((item) => !hidden.includes(item.id));
  const openCount = visible.filter((item) => open.includes(item.id)).length;
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const hiddenBadges = sections
    .filter((item) => hidden.includes(item.id))
    .reduce((sum, item) => sum + (item.badge ?? 0), 0);

  useEffect(() => {
    if (!menuOpen) return;
    function outside(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !menu.current?.contains(target) &&
        !menuButton.current?.contains(target)
      )
        setMenuOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [menuOpen]);

  function moveFocus(event: React.KeyboardEvent<HTMLUListElement>) {
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
    );
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % buttons.length
        : event.key === "ArrowLeft"
          ? (index - 1 + buttons.length) % buttons.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? buttons.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    buttons[next].focus();
  }

  function toggleHidden(id: string, show: boolean) {
    onHiddenChange(
      show
        ? hidden.filter((item) => item !== id)
        : sections
            .map((item) => item.id)
            .filter((item) => item === id || hidden.includes(item)),
    );
  }

  return (
    <div className="section-bar">
      <nav className="section-bar__nav" aria-label="Photo sections">
        <ul
          className="section-bar__grid"
          // Two even rows at most: eight sections make four columns, never a ragged wrap.
          style={
            {
              "--section-columns":
                visible.length <= 4
                  ? visible.length
                  : Math.ceil(visible.length / 2),
            } as React.CSSProperties
          }
          onKeyDown={moveFocus}
        >
          {visible.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                data-section={item.id}
                className={
                  open.includes(item.id)
                    ? "section-bar__tab section-bar__tab--open"
                    : "section-bar__tab"
                }
                aria-label={
                  (item.badge ?? 0) > 0
                    ? `${item.label}, ${item.badge} pending`
                    : undefined
                }
                aria-current={current === item.id ? "true" : undefined}
                onClick={() => onJump(item.id)}
              >
                {ICONS[item.id] && <Icon>{ICONS[item.id]}</Icon>}
                <span>{item.label}</span>
                {(item.badge ?? 0) > 0 && (
                  <span className="section-bar__badge">{item.badge}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div
        className="section-bar__tools"
        role="group"
        aria-label="Section display"
      >
        {onViewChange && (
          <div
            className="section-bar__view"
            role="group"
            aria-label="Show sections"
          >
            {(["tabs", "scroll"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => onViewChange(option)}
              >
                {option === "tabs" ? "One at a time" : "All in one scroll"}
              </button>
            ))}
          </div>
        )}
        {/* As tabs every shown section is open, so folding has nothing to do. */}
        {view === "scroll" && (
          <div className="section-bar__fold">
            <button
              type="button"
              aria-label="Expand all"
              title="Expand all sections"
              disabled={openCount === visible.length}
              onClick={onExpandAll}
            >
              <Icon>
                <path d="M5 4.5l5 4 5-4M5 11l5 4 5-4" />
              </Icon>
              <span>Expand</span>
            </button>
            <span
              className="section-bar__meter"
              aria-label={`${openCount} of ${visible.length} sections open`}
            >
              <span
                className="section-bar__meter-fill"
                style={{
                  width: `${visible.length ? (openCount / visible.length) * 100 : 0}%`,
                }}
              />
              <span className="section-bar__meter-text" aria-hidden="true">
                {openCount}/{visible.length}
              </span>
            </span>
            <button
              type="button"
              aria-label="Collapse all"
              title="Collapse all sections"
              disabled={openCount === 0}
              onClick={onCollapseAll}
            >
              <Icon>
                <path d="M5 8.5l5-4 5 4M5 15l5-4 5 4" />
              </Icon>
              <span>Collapse</span>
            </button>
          </div>
        )}
        <div className="section-bar__menu-anchor">
          <button
            ref={menuButton}
            type="button"
            className="section-bar__menu-button"
            aria-label={
              hidden.length > 0
                ? `Show or hide sections, ${hidden.length} hidden`
                : "Show or hide sections"
            }
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <Icon>
              <path d="M3 5.5h8M15 5.5h2M3 14.5h2M9 14.5h8" />
              <circle cx="13" cy="5.5" r="2" />
              <circle cx="7" cy="14.5" r="2" />
            </Icon>
            <span>Sections</span>
            {hidden.length > 0 && (
              <span
                className={
                  hiddenBadges > 0
                    ? "section-bar__hidden-count section-bar__hidden-count--alert"
                    : "section-bar__hidden-count"
                }
              >
                {hidden.length} hidden
              </span>
            )}
          </button>
          {menuOpen && (
            <div
              ref={menu}
              id={menuId}
              className="section-bar__menu"
              role="group"
              aria-label="Visible sections"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.stopPropagation();
                  setMenuOpen(false);
                  menuButton.current?.focus();
                }
              }}
              onBlur={(event) => {
                const next = event.relatedTarget as Node | null;
                if (
                  next &&
                  !menu.current?.contains(next) &&
                  !menuButton.current?.contains(next)
                )
                  setMenuOpen(false);
              }}
            >
              <p className="section-bar__menu-title">Show in the inspector</p>
              <ul>
                {sections.map((item) => {
                  const shown = !hidden.includes(item.id);
                  return (
                    <li key={item.id}>
                      <label
                        className={
                          item.locked
                            ? "section-bar__option section-bar__option--locked"
                            : "section-bar__option"
                        }
                      >
                        <input
                          type="checkbox"
                          checked={shown}
                          disabled={item.locked}
                          onChange={(event) =>
                            toggleHidden(item.id, event.target.checked)
                          }
                        />
                        <span className="section-bar__switch" aria-hidden="true" />
                        {ICONS[item.id] && <Icon>{ICONS[item.id]}</Icon>}
                        <span className="section-bar__option-label">
                          {item.label}
                        </span>
                        {item.locked ? (
                          <span className="section-bar__option-note">
                            Always shown
                          </span>
                        ) : (
                          (item.badge ?? 0) > 0 && (
                            <span className="section-bar__badge">
                              {item.badge}
                            </span>
                          )
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                className="section-bar__show-all"
                disabled={hidden.length === 0}
                onClick={() => onHiddenChange([])}
              >
                Show all sections
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
