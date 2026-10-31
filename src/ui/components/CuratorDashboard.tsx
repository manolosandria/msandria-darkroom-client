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
    open?: Destination;
  }[] = [
    {
      label: "Comments to moderate",
      value: "comments",
      hint: "Awaiting approval",
      open: "Comments",
    },
    {
      label: "Unread messages",
      value: "inbox",
      hint: "From the contact form",
      open: "Inbox",
    },
    {
      label: "Photos to re-export",
      value: "unoptimizedPhotos",
      hint: "Optimization notices pending",
      open: "Photos",
    },
    {
      label: "Storage tasks",
      value: "storageTasks",
      hint: "Retries in the storage journal",
    },
    { label: "Photographs", value: "photos", hint: "In the archive" },
    { label: "Accounts", value: "accounts", hint: "Signed up visitors" },
  ];
  return (
    <main className="upload-workspace curator-dashboard">
      <div className="upload-container">
        <div className="upload-heading">
          <span className="upload-eyebrow">THE DARKROOM / DASHBOARD</span>
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
                  <span className="curator-dashboard__value">{value}</span>
                  <span className="curator-dashboard__label">{tile.label}</span>
                  <span className="curator-dashboard__hint">{tile.hint}</span>
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
