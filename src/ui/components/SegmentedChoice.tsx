"use client";
import { KeyboardEvent, ReactNode, useRef } from "react";
import "./choiceMenu.css";

export type Segment<T extends string> = {
  value: T;
  label: string;
  icon: ReactNode;
};

/**
 * A few options as a row of drawings: each says what it is in a tooltip and to screen
 * readers, the chosen one is raised and lit, and one line under the row names the
 * current choice. Arrow keys move the choice, as in a radio group.
 */
export function SegmentedChoice<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: T;
  options: Segment<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const row = useRef<HTMLDivElement>(null);
  const current = options.find((option) => option.value === value);
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const by = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[
      event.key
    ];
    if (!by) return;
    event.preventDefault();
    const index = options.findIndex((option) => option.value === value);
    const next = options[(index + by + options.length) % options.length];
    onChange(next.value);
    row.current
      ?.querySelector<HTMLElement>(`[data-value="${next.value}"]`)
      ?.focus();
  }
  return (
    <div className="segmented-choice">
      <span className="segmented-choice__label">{label}</span>
      <div
        ref={row}
        role="radiogroup"
        aria-label={label}
        className="segmented-choice__row"
        onKeyDown={onKeyDown}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            data-value={option.value}
            aria-checked={option.value === value}
            aria-label={option.label}
            title={option.label}
            tabIndex={option.value === value ? 0 : -1}
            disabled={disabled}
            onClick={() => option.value !== value && onChange(option.value)}
          >
            {option.icon}
          </button>
        ))}
      </div>
      <span className="segmented-choice__current" aria-hidden="true">
        {current?.label}
      </span>
    </div>
  );
}
