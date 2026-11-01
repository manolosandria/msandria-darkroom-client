"use client";
import { useEffect, useState } from "react";
import { CuratorDashboard as Summary } from "@/src/domain/repositories/ContactRepository";
import { manageContact } from "@/src/infrastructure/contactServices";

type Destination = "Comments" | "Inbox" | "Photos";
const loadDashboard = () => manageContact.dashboard();

// What waits for the administrator, at a glance: each tile opens the tab where it is
// dealt with. Refreshes with the notifications (`curator:refresh`) and on focus.
export default function CuratorDashboard({
  onOpen,
  load = loadDashboard,
}: {
  onOpen: (section: Destination) => void;
  load?: () => Promise<Summary>;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = () =>
      void load()
        .then((value) => {
          if (!active) return;
          setSummary(value);
          setError("");
        })
        .catch((failure: unknown) => {
          if (active)
            setError(
              failure instanceof Error
                ? failure.message
                : "The dashboard could not be loaded.",
            );
        });
    refresh();
    window.addEventListener("curator:refresh", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener("curator:refresh", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);
  const tiles: {
    label: string;
    value: keyof Summary;
    hint: string;
    icon: string;
    open?: Destination;
  }[] = [
    {
      label: "Comments to moderate",
      value: "comments",
      hint: "Awaiting approval",
      icon: "M4 4h12v8H9l-4 3v-3H4zM7 7.5h6M7 9.5h4",
      open: "Comments",
    },
    {
      label: "Unread messages",
      value: "inbox",
      hint: "From the contact form",
      icon: "M3 11l2.5-6h9L17 11v5H3zM3 11h4l1 2h4l1-2h4",
      open: "Inbox",
    },
    {
      label: "Photos to re-export",
      value: "unoptimizedPhotos",
      hint: "Optimization notices pending",
      icon: "M4 10a6 6 0 0 1 10.5-4M16 10a6 6 0 0 1-10.5 4M14 3v3h-3M6 17v-3h3",
      open: "Photos",
    },
    {
      label: "Storage tasks",
      value: "storageTasks",
      hint: "Retries in the storage journal",
      icon: "M4 5c0-1.1 2.7-2 6-2s6 .9 6 2-2.7 2-6 2-6-.9-6-2zM4 5v10c0 1.1 2.7 2 6 2s6-.9 6-2V5M4 10c0 1.1 2.7 2 6 2s6-.9 6-2",
    },
    {
      label: "Photographs",
      value: "photos",
      hint: "In the archive",
      icon: "M3 5h14v10H3zM3 13l4-4 3 3 2-2 5 5M13 8h.01",
    },
    {
      label: "Accounts",
      value: "accounts",
      hint: "Signed up visitors",
      icon: "M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 17a6 6 0 0 1 12 0",
    },
  ];
  return (
    <main className="upload-workspace curator-dashboard">
      <div className="upload-container">
        <div className="upload-heading">
          <span className="upload-eyebrow">CURATOR / DASHBOARD</span>
          <h1>What needs you.</h1>
        </div>
        {error && <p role="alert">{error}</p>}
        {!summary && !error && <p role="status">Loading dashboard…</p>}
        {summary && (
          <ul className="curator-dashboard__tiles">
            {tiles.map((tile) => {
              const value = summary[tile.value];
              const body = (
                <>
                  <span className="curator-dashboard__icon" aria-hidden="true">
                    <svg
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d={tile.icon} />
                    </svg>
                  </span>
                  <span className="curator-dashboard__value">{value}</span>
                  <span className="curator-dashboard__label">{tile.label}</span>
                  <span className="curator-dashboard__hint">{tile.hint}</span>
                  {tile.open && value > 0 && (
                    <span className="curator-dashboard__open" aria-hidden="true">
                      Open →
                    </span>
                  )}
                </>
              );
              return (
                <li
                  key={tile.value}
                  className={
                    tile.open && value > 0 ? "is-pending" : undefined
                  }
                >
                  {tile.open ? (
                    <button type="button" onClick={() => onOpen(tile.open!)}>
                      {body}
                    </button>
                  ) : (
                    <div>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
