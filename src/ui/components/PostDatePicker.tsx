"use client";

import { useId, useRef, useState } from "react";
import { PostIcon } from "./PostIcon";

const pad = (value: number) => String(value).padStart(2, "0");
const dateValue = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Local publication time, without the operating system's date/time popup. */
export function PostDatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date(value || Date.now()));
  const trigger = useRef<HTMLButtonElement>(null);
  const calendar = useRef<HTMLDivElement>(null);
  const selected = value ? new Date(value) : null;
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
  const select = (date: Date) =>
    onChange(`${dateValue(date)}T${value.split("T")[1] || "12:00"}`);
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <div className="post-studio__field post-date">
      <span id={`${id}-label`}>Publication date</span>
      <button
        ref={trigger}
        type="button"
        className="post-date__trigger"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => {
          if (!open) setMonth(new Date(value || Date.now()));
          setOpen(!open);
        }}
      >
        <PostIcon name="calendar" />
        <span id={`${id}-value`}>
          {selected
            ? selected.toLocaleString("en", {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : "When published"}
        </span>
        <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div
          id={`${id}-panel`}
          className="post-date__panel"
          role="group"
          aria-label="Choose publication date"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          }}
        >
          <div className="post-date__month">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              ‹
            </button>
            <strong aria-live="polite">
              {month.toLocaleDateString("en", {
                month: "long",
                year: "numeric",
              })}
            </strong>
            <button
              type="button"
              aria-label="Next month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              ›
            </button>
          </div>
          <div className="post-date__week" aria-hidden="true">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div
            className="post-date__days"
            ref={calendar}
            onKeyDown={(event) => {
              const offsets: Record<string, number> = {
                ArrowLeft: -1,
                ArrowRight: 1,
                ArrowUp: -7,
                ArrowDown: 7,
              };
              const target = event.target as HTMLButtonElement;
              if (!target.dataset.date || offsets[event.key] === undefined)
                return;
              event.preventDefault();
              const next = new Date(`${target.dataset.date}T12:00`);
              next.setDate(next.getDate() + offsets[event.key]);
              if (
                next.getMonth() !== month.getMonth() ||
                next.getFullYear() !== month.getFullYear()
              )
                setMonth(next);
              requestAnimationFrame(() =>
                calendar.current
                  ?.querySelector<HTMLButtonElement>(
                    `[data-date="${dateValue(next)}"]`,
                  )
                  ?.focus(),
              );
            }}
          >
            {days.map((day) => {
              const key = dateValue(day);
              return (
                <button
                  type="button"
                  key={key}
                  data-date={key}
                  data-outside={day.getMonth() !== month.getMonth()}
                  aria-pressed={key === value.split("T")[0]}
                  aria-current={
                    key === dateValue(new Date()) ? "date" : undefined
                  }
                  aria-label={day.toLocaleDateString("en", {
                    dateStyle: "full",
                  })}
                  onClick={() => {
                    select(day);
                    setMonth(day);
                  }}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
          <div className="post-date__time">
            <span>Local time</span>
            <label>
              <span className="sr-only">Publication hour</span>
              <select
                value={value.slice(11, 13) || "12"}
                onChange={(event) =>
                  onChange(
                    `${value.slice(0, 10) || dateValue(new Date())}T${event.target.value}:${value.slice(14, 16) || "00"}`,
                  )
                }
              >
                {Array.from({ length: 24 }, (_, hour) => (
                  <option key={hour}>{pad(hour)}</option>
                ))}
              </select>
            </label>
            <span>:</span>
            <label>
              <span className="sr-only">Publication minute</span>
              <select
                value={value.slice(14, 16) || "00"}
                onChange={(event) =>
                  onChange(
                    `${value.slice(0, 10) || dateValue(new Date())}T${value.slice(11, 13) || "12"}:${event.target.value}`,
                  )
                }
              >
                {Array.from({ length: 60 }, (_, minute) => (
                  <option key={minute}>{pad(minute)}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="post-date__footer">
            <button type="button" onClick={() => select(new Date())}>
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                onChange("");
                close();
              }}
            >
              When published
            </button>
            <button type="button" onClick={close}>
              Done
            </button>
          </div>
        </div>
      )}
      <small>
        {value
          ? "Your local time. A future date schedules the post."
          : "The date is set when you publish."}
      </small>
    </div>
  );
}
