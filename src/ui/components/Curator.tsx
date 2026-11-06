"use client";

import { useEffect, useState } from "react";
import GalleryEditor from "./GalleryEditor";
import PaletteManager from "./PaletteManager";
import SiteGeneralEditor from "./SiteGeneralEditor";
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
import { useCuratorBackdrop } from "./CuratorBackdrop";
import "./curatorLayout.css";
import "./curatorTheme.css";
import {
  announceCuratorSection,
  announceCuratorTabs,
  useCuratorRequests,
  useCuratorTabsRequests,
} from "@/src/ui/curatorChannel";
import {
  CURATOR_SECTION_KEY,
  curatorGroupOf,
  curatorGroups,
  CuratorSection,
  curatorSections,
} from "@/src/ui/curatorSections";

type Section = CuratorSection;
const sections = curatorSections;
// Earlier names, so a remembered tab still opens.
const renamed: Record<string, Section> = { Moderation: "Comments" };
const groupOf = curatorGroupOf;

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
    // The pill in the header's corner names it.
    announceCuratorSection(name);
    setLastIn((previous) => ({ ...previous, [groupOf(name).name]: name }));
    if (remember)
      try {
        sessionStorage.setItem(CURATOR_SECTION_KEY, name);
      } catch {
        /* Keep the current tab in memory. */
      }
    setVisited((previous) =>
      previous.includes(name) ? previous : [...previous, name],
    );
  };
  useEffect(() => {
    try {
      // A link may name the tab (`/curator?section=Dashboard`); otherwise the last one.
      const asked = new URLSearchParams(window.location.search).get("section");
      const stored = asked ?? sessionStorage.getItem(CURATOR_SECTION_KEY) ?? "";
      const remembered = renamed[stored] ?? stored;
      if (sections.includes(remembered as Section))
        queueMicrotask(() => show(remembered as Section, false));
    } catch {
      /* Storage may be unavailable; the workspace still works in memory. */
    }
    // Only on the first render: afterwards the choice is the curator's.
  }, []);
  // The pill in the header's corner opens the tabs too.
  useCuratorRequests((name) => {
    if (sections.includes(name)) show(name);
  });
  useEffect(() => {
    announceCuratorSection(section);
    return () => announceCuratorSection(null);
    // Announced once on arrival; `show` announces every change after it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // The pill beside the account is Curator's menu, so its own row of tabs starts
  // folded everywhere; the pill's last line brings it back (a row on wide screens, a
  // centered column on narrow ones), and its arrow folds it again.
  const [menuShown, setMenuShown] = useState(false);
  useEffect(() => announceCuratorTabs(menuShown), [menuShown]);
  useEffect(() => () => announceCuratorTabs(true), []);
  useCuratorTabsRequests(() => setMenuShown(true));
  // The group whose menu was opened by a press (touch has no hover); pointing at a
  // group or tabbing into it opens its menu too.
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (
        !(event.target as Element).closest?.(".curator-tabs__group")
      )
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
            id="curator-tabs"
            aria-label="Curator sections"
            className="curator-tabs"
            hidden={!menuShown}
            onClick={(event) => {
              // On narrow screens, choosing a tab folds the menu again.
              if (
                (event.target as Element).closest(".curator-tabs__menu button, .curator-tabs__trigger[aria-current]") &&
                window.matchMedia?.("(max-width: 899px)").matches
              )
                setMenuShown(false);
            }}
          >
            {curatorGroups.map((group) => {
              const active = group === current;
              const pendingCount = pendingIn(group);
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
            <FoldArrow folded={false} onClick={() => setMenuShown(false)} />
          </nav>
          <div className="curator-panel" hidden={section !== "Upload"}>
            <UploadPanel />
          </div>
          {panel("Photos", <ManagePhotos />)}
          {panel("Collections", <ManageCollections only="Collections" />)}
          {panel("Categories", <ManageCollections only="Categories" />)}
          {panel("Variants", <ManageCollections variants />)}
          {panel("General", <SiteGeneralEditor />)}
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

// At the far right of the tabs' row, it folds them into the pill; beside the pill, it
// brings them back.
function FoldArrow({
  folded,
  onClick,
}: {
  folded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="curator-fold"
      aria-expanded={!folded}
      aria-controls="curator-tabs"
      aria-label={folded ? "Show the tabs" : "Hide the tabs"}
      title={folded ? "Show the tabs" : "Hide the tabs"}
      onClick={onClick}
    >
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
        <path
          d={folded ? "M5 7.5l5 5 5-5" : "M5 12.5 10 7.5l5 5"}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
