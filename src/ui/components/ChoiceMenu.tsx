"use client";
import {
  KeyboardEvent,
  ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import "./choiceMenu.css";

export type Choice<T extends string> = {
  value: T;
  label: string;
  /** A second, quieter line under the label. */
  description?: string;
  /** A small drawing shown before the label, on the button too. */
  icon?: ReactNode;
  /** A color dot (or several, for a palette) before the label. */
  swatch?: string | string[];
  /** Shows the label in this font stack, for choosing a typeface. */
  font?: string;
  disabled?: boolean;
};

/**
 * A designed replacement for a native select: the button shows the chosen option with
 * its drawing or colors, and opens a card of options to point at, each lit under the
 * pointer and the chosen one ticked. Keyboard follows the select-only combobox
 * pattern: arrows, Home and End move, Enter or Space picks, Escape closes, and typing
 * jumps to an option starting with those letters. It sits inside a `<label>` or takes
 * `ariaLabel`, so it is named like the select it replaces.
 */
export function ChoiceMenu<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
  placeholder = "Choose…",
  className = "",
}: {
  value: T;
  options: Choice<T>[];
  onChange: (value: T) => void;
  ariaLabel?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [above, setAbove] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const chosen = options.find((option) => option.value === value);
  const chosenIndex = options.findIndex((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  // Opens upwards when the window has no room under the button.
  useLayoutEffect(() => {
    if (!open || !root.current) return;
    const box = root.current.getBoundingClientRect();
    const below = window.innerHeight - box.bottom;
    setAbove(below < 280 && box.top > below);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    list.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [open, active]);

  const enabled = (index: number) => !options[index]?.disabled;
  function step(from: number, by: number) {
    for (let i = 1; i <= options.length; i++) {
      const next = (from + by * i + options.length * i) % options.length;
      if (enabled(next)) return next;
    }
    return from;
  }
  function show(at = chosenIndex >= 0 ? chosenIndex : step(-1, 1)) {
    setActive(at);
    setOpen(true);
  }
  function pick(index: number) {
    if (!enabled(index)) return;
    setOpen(false);
    if (options[index].value !== value) onChange(options[index].value);
  }
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const keys: Record<string, () => void> = {
      ArrowDown: () => (open ? setActive(step(active, 1)) : show()),
      ArrowUp: () => (open ? setActive(step(active, -1)) : show()),
      Home: () => open && setActive(step(-1, 1)),
      End: () => open && setActive(step(options.length, -1)),
      Enter: () => (open ? pick(active) : show()),
      " ": () => (open ? pick(active) : show()),
      Escape: () => setOpen(false),
      Tab: () => setOpen(false),
    };
    if (keys[event.key]) {
      typed.current.text = "";
      if (event.key !== "Tab" && (event.key !== "Escape" || open))
        event.preventDefault();
      keys[event.key]();
      return;
    }
    if (event.key.length !== 1 || event.metaKey || event.ctrlKey) return;
    const now = Date.now();
    typed.current = {
      text:
        (now - typed.current.at > 700 ? "" : typed.current.text) + event.key,
      at: now,
    };
    const match = options.findIndex(
      (option, index) =>
        enabled(index) &&
        option.label.toLowerCase().startsWith(typed.current.text.toLowerCase()),
    );
    if (match < 0) return;
    if (open) setActive(match);
    else if (options[match].value !== value) onChange(options[match].value);
  }

  return (
    <div
      ref={root}
      className={`choice-menu${open ? " is-open" : ""}${above ? " opens-up" : ""} ${className}`}
    >
      <button
        type="button"
        role="combobox"
        className="choice-menu__button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        {chosen && <Mark option={chosen} />}
        <span
          className="choice-menu__value"
          style={chosen?.font ? { fontFamily: chosen.font } : undefined}
        >
          {chosen?.label ?? placeholder}
        </span>
        <svg
          className="choice-menu__chevron"
          viewBox="0 0 12 12"
          width="12"
          height="12"
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
      {open && (
        <ul
          ref={list}
          id={`${id}-list`}
          role="listbox"
          aria-label={ariaLabel}
          className="choice-menu__list"
          // Inside a <label>, a click would also reach the label and toggle the
          // button it names; the menu handles its own clicks.
          onClick={(event) => event.preventDefault()}
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${id}-${index}`}
              data-index={index}
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled || undefined}
              aria-labelledby={`${id}-${index}-label`}
              aria-describedby={
                option.description ? `${id}-${index}-note` : undefined
              }
              className={`choice-menu__option${index === active ? " is-active" : ""}`}
              onPointerEnter={() => enabled(index) && setActive(index)}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => pick(index)}
            >
              <Mark option={option} />
              <span className="choice-menu__text">
                <span
                  id={`${id}-${index}-label`}
                  style={option.font ? { fontFamily: option.font } : undefined}
                >
                  {option.label}
                </span>
                {option.description && (
                  <small id={`${id}-${index}-note`}>{option.description}</small>
                )}
              </span>
              <svg
                className="choice-menu__tick"
                viewBox="0 0 16 16"
                width="14"
                height="14"
                aria-hidden="true"
              >
                <path
                  d="m3.5 8.5 3 3 6-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Mark<T extends string>({ option }: { option: Choice<T> }) {
  if (option.icon)
    return (
      <span className="choice-menu__icon" aria-hidden="true">
        {option.icon}
      </span>
    );
  if (!option.swatch) return null;
  const colors = Array.isArray(option.swatch) ? option.swatch : [option.swatch];
  return (
    <span className="choice-menu__swatch" aria-hidden="true">
      {colors.map((color, index) => (
        <i key={index} style={{ background: color }} />
      ))}
    </span>
  );
}
