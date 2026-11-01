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
import { CuratorBackdropPicker, useCuratorBackdrop } from "./CuratorBackdrop";
import "./curatorLayout.css";
import "./curatorTheme.css";

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
  const backdrop = useCuratorBackdrop();
  // The group whose menu was opened by a press (touch has no hover); pointing at a
  // group or tabbing into it opens its menu too.
  const [open, setOpen] = useState<string | null>(null);
  // Scrolled away from the menu, a bubble in the corner stands in for it. The menu is
  // mounted again when the account changes, so it is watched through its ref.
  const [nav, setNav] = useState<HTMLElement | null>(null);
  const [away, setAway] = useState(false);
  useEffect(() => {
    if (!nav || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) =>
      setAway(!entry.isIntersecting),
    );
    observer.observe(nav);
    return () => observer.disconnect();
  }, [nav]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as Element).closest?.(".curator-tabs__group"))
        setOpen(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const pendingIn = (group: (typeof curatorGroups)[number]) =>
    group.sections.reduce((total, name) => total + countOf(name), 0);
  const item = (name: Section) => (
    <button
      key={name}
      type="button"
      aria-current={section === name ? "page" : undefined}
      onClick={() => {
        show(name);
        setOpen(null);
      }}
    >
      {name}
      {!!countOf(name) && (
        <span className="curator-badge">{countOf(name)}</span>
      )}
    </button>
  );
  return (
    <EditingBoundary>
      <ClassificationCatalogBoundary key={user?.getId() ?? "anonymous"}>
        <div className="curator-workspace" data-backdrop={backdrop.value}>
          <nav
            ref={setNav}
            aria-label="Curator sections"
            className="curator-tabs"
          >
            {curatorGroups.map((group) => {
              const active = group === current;
              const pendingCount = pendingIn(group);
              if (group.sections.length === 1)
                return (
                  <button
                    key={group.name}
                    type="button"
                    className={`curator-tabs__trigger${active ? " is-active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => show(group.sections[0])}
                  >
                    {group.name}
                  </button>
                );
              return (
                <div
                  key={group.name}
                  role="group"
                  aria-label={group.name}
                  className={`curator-tabs__group${active ? " is-active" : ""}${open === group.name ? " is-open" : ""}`}
                  onPointerLeave={(event) => {
                    if (event.pointerType === "mouse") setOpen(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setOpen(null);
                  }}
                >
                  <button
                    type="button"
                    className={`curator-tabs__trigger${active ? " is-active" : ""}`}
                    aria-haspopup="true"
                    aria-expanded={open === group.name}
                    onClick={() => {
                      if (!active)
                        show(lastIn[group.name] ?? group.sections[0]);
                      setOpen(open === group.name ? null : group.name);
                    }}
                  >
                    <span className="curator-tabs__group-name">
                      {group.name}
                    </span>
                    {active && (
                      <span className="curator-tabs__current">{section}</span>
                    )}
                    {!!pendingCount && (
                      <span className="curator-badge">{pendingCount}</span>
                    )}
                    <svg
                      className="curator-tabs__chevron"
                      viewBox="0 0 12 12"
                      width="10"
                      height="10"
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
                  <div className="curator-tabs__menu">
                    {group.sections.map(item)}
                  </div>
                </div>
              );
            })}
            <CuratorBackdropPicker state={backdrop} />
          </nav>
          {away && (
            <div className="curator-bubble">
              <span className="curator-bubble__face" tabIndex={0}>
                <span aria-hidden="true">☰</span>
                {section}
              </span>
              <div
                className="curator-bubble__menu"
                role="navigation"
                aria-label="Curator sections (shortcut)"
              >
                {curatorGroups.map((group) => (
                  <div key={group.name} className="curator-bubble__group">
                    <span className="curator-bubble__label">{group.name}</span>
                    {group.sections.map(item)}
                  </div>
                ))}
              </div>
            </div>
          )}
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
          <CuratorSaveBar state={saveBar} />
        </div>
      </ClassificationCatalogBoundary>
    </EditingBoundary>
  );
}
