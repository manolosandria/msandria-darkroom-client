"use client";

import { useEffect, useState } from "react";
import GalleryEditor from "./GalleryEditor";
import PaletteManager from "./PaletteManager";
import HomeBannerEditor from "./HomeBannerEditor";
import UploadPanel from "./UploadPanel";
import ManagePhotos from "./ManagePhotos";
import ManageCollections from "./ManageCollections";
import CommentModeration from "./CommentModeration";
import ContactInbox from "./ContactInbox";
import CuratorDashboard from "./CuratorDashboard";
import { CuratorSaveBar, useCuratorSaveBar } from "./CuratorSaveBar";
import { useCuratorNotifications } from "./CuratorNotifications";
import { EditingBoundary } from "./EditingWorkspace";
import { ClassificationCatalogBoundary } from "./ClassificationCatalog";
import { useSessionValue } from "./SessionProvider";
import "./curatorLayout.css";

// The menu, by what each part is for: the public sections of the site, the palette
// library, the photographs and what is done with them, and the administration.
export const curatorGroups = [
  { name: "Sections", sections: ["Home", "Gallery", "Collections"] },
  { name: "Palettes", sections: ["Palettes"] },
  { name: "Photos", sections: ["Photos", "Upload", "Categories", "Variants"] },
  { name: "Admin", sections: ["Dashboard", "Comments", "Inbox"] },
] as const;
type Section = (typeof curatorGroups)[number]["sections"][number];
const sections: readonly Section[] = curatorGroups.flatMap(
  (group) => group.sections,
);
// Earlier names, so a remembered tab still opens.
const renamed: Record<string, Section> = { Moderation: "Comments" };
const groupOf = (section: Section) =>
  curatorGroups.find((group) =>
    (group.sections as readonly Section[]).includes(section),
  )!;

export default function Curator() {
  const { user } = useSessionValue();
  const [section, setSection] = useState<Section>("Upload");
  const [visited, setVisited] = useState<Section[]>(["Upload"]);
  // The tab last open in each group, so a group opens where it was left.
  const [lastIn, setLastIn] = useState<Record<string, Section>>({});
  const counts = useCuratorNotifications();
  const saveBar = useCuratorSaveBar();
  const show = (name: Section, remember = true) => {
    setSection(name);
    setLastIn((previous) => ({ ...previous, [groupOf(name).name]: name }));
    if (remember)
      try {
        sessionStorage.setItem("curatorSection", name);
      } catch {
        /* Keep the current tab in memory. */
      }
    setVisited((previous) =>
      previous.includes(name) ? previous : [...previous, name],
    );
  };
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("curatorSection") ?? "";
      const remembered = renamed[stored] ?? stored;
      if (sections.includes(remembered as Section))
        queueMicrotask(() => show(remembered as Section, false));
    } catch {
      /* Storage may be unavailable; the workspace still works in memory. */
    }
    // Only on the first render: afterwards the choice is the curator's.
  }, []);
  const countOf = (name: Section) =>
    name === "Comments"
      ? (counts?.comments ?? 0)
      : name === "Inbox"
        ? (counts?.inbox ?? 0)
        : 0;
  const panel = (name: Section, content: React.ReactNode, keep = true) =>
    (keep ? visited.includes(name) : section === name) && (
      <div className="curator-panel" hidden={section !== name}>
        {content}
      </div>
    );
  const current = groupOf(section);
  return (
    <EditingBoundary>
      <ClassificationCatalogBoundary key={user?.getId() ?? "anonymous"}>
        <div className="curator-workspace">
          <nav aria-label="Curator sections" className="curator-tabs">
            {curatorGroups.map((group) => {
              const active = group === current;
              const pendingCount = group.sections.reduce(
                (total, name) => total + countOf(name),
                0,
              );
              const single = group.sections.length === 1;
              return (
                <div
                  key={group.name}
                  role="group"
                  aria-label={group.name}
                  className={`curator-tabs__group${active ? " is-open" : ""}`}
                >
                  {(single || !active) && (
                    <button
                      type="button"
                      className="curator-tabs__group-name"
                      aria-current={single && active ? "page" : undefined}
                      aria-expanded={single ? undefined : false}
                      onClick={() =>
                        show(lastIn[group.name] ?? group.sections[0])
                      }
                    >
                      {group.name}
                      {!active && !!pendingCount && (
                        <span className="curator-badge">{pendingCount}</span>
                      )}
                    </button>
                  )}
                  {!single && active && (
                    <>
                      <span
                        className="curator-tabs__group-label"
                        aria-hidden="true"
                      >
                        {group.name}
                      </span>
                      {group.sections.map((name) => (
                        <button
                          key={name}
                          type="button"
                          aria-current={section === name ? "page" : undefined}
                          onClick={() => show(name)}
                        >
                          {name}
                          {!!countOf(name) && (
                            <span className="curator-badge">
                              {countOf(name)}
                            </span>
                          )}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              );
            })}
          </nav>
          <CuratorSaveBar edge="top" state={saveBar} />
          <div className="curator-panel" hidden={section !== "Upload"}>
            <UploadPanel />
          </div>
          {panel("Photos", <ManagePhotos />)}
          {panel("Collections", <ManageCollections only="Collections" />)}
          {panel("Categories", <ManageCollections only="Categories" />)}
          {panel("Variants", <ManageCollections variants />)}
          {panel("Home", <HomeBannerEditor />)}
          {panel("Palettes", <PaletteManager />)}
          {panel("Gallery", <GalleryEditor />)}
          {panel("Dashboard", <CuratorDashboard onOpen={show} />, false)}
          {panel("Comments", <CommentModeration />, false)}
          {panel("Inbox", <ContactInbox />, false)}
          <CuratorSaveBar edge="bottom" state={saveBar} />
        </div>
      </ClassificationCatalogBoundary>
    </EditingBoundary>
  );
}
