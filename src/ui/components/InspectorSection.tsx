"use client";
import "./photoStudio.css";
import { useState } from "react";

/** One collapsible block of a studio inspector, opened and closed from outside too. */
export function InspectorSection({
  id,
  label,
  summary,
  open,
  lazy = false,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  summary?: React.ReactNode;
  open: boolean;
  lazy?: boolean;
  onToggle: (open: boolean) => void;
  children: React.ReactNode;
}) {
  // A lazy section mounts on first opening and then stays, keeping what it loaded.
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  return (
    <details
      id={id}
      className="inspector-section"
      open={open}
      onToggle={(event) => {
        if (event.currentTarget.open !== open)
          onToggle(event.currentTarget.open);
      }}
    >
      <summary>
        <span>{label}</span>
        {summary !== undefined && (
          <span className="inspector-section__summary">{summary}</span>
        )}
      </summary>
      <div className="inspector-section__body">
        {(!lazy || opened) && children}
      </div>
    </details>
  );
}
