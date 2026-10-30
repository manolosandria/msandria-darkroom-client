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
import { useCuratorNotifications } from "./CuratorNotifications";
import { EditingBoundary } from "./EditingWorkspace";
import { ClassificationCatalogBoundary } from "./ClassificationCatalog";
import { useSessionValue } from "./SessionProvider";
import "./curatorLayout.css";

const sections = [
  "Home",
  "Gallery",
  "Palettes",
  "Upload",
  "Photos",
  "Collections",
  "Variants",
  "Moderation",
  "Inbox",
] as const;
type Section = (typeof sections)[number];

export default function Curator() {
  const { user } = useSessionValue();
  const [section, setSection] = useState<Section>("Upload");
  const [visited, setVisited] = useState<Section[]>(["Upload"]);
  const counts = useCuratorNotifications();
  useEffect(() => {
    try {
      const remembered = sessionStorage.getItem("curatorSection");
      if (sections.includes(remembered as Section))
        queueMicrotask(() => {
          setSection(remembered as Section);
          setVisited((previous) =>
            previous.includes(remembered as Section)
              ? previous
              : [...previous, remembered as Section],
          );
        });
    } catch {
      /* Storage may be unavailable; the workspace still works in memory. */
    }
  }, []);
  return (
    <EditingBoundary>
      <ClassificationCatalogBoundary key={user?.getId() ?? "anonymous"}><div className="curator-workspace">
        <nav aria-label="Curator sections" className="curator-tabs">
          {sections.map((name) => {
            const count =
              name === "Moderation"
                ? counts?.comments
                : name === "Inbox"
                  ? counts?.inbox
                  : 0;
            return (
              <button
                key={name}
                type="button"
                aria-current={section === name ? "page" : undefined}
                onClick={() => {
                  setSection(name);
                  try {
                    sessionStorage.setItem("curatorSection", name);
                  } catch {
                    /* Keep the current tab in memory. */
                  }
                  setVisited((previous) =>
                    previous.includes(name) ? previous : [...previous, name],
                  );
                }}
              >
                {name}
                {!!count && <span className="curator-badge">{count}</span>}
              </button>
            );
          })}
        </nav>
        <div className="curator-panel" hidden={section !== "Upload"}>
          <UploadPanel />
        </div>
        {visited.includes("Photos") && (
          <div className="curator-panel" hidden={section !== "Photos"}>
            <ManagePhotos />
          </div>
        )}
        {visited.includes("Collections") && (
          <div className="curator-panel" hidden={section !== "Collections"}>
            <ManageCollections />
          </div>
        )}
        {visited.includes("Variants") && (
          <div className="curator-panel" hidden={section !== "Variants"}>
            <ManageCollections variants />
          </div>
        )}
        {visited.includes("Home") && (
          <div className="curator-panel" hidden={section !== "Home"}>
            <HomeBannerEditor />
          </div>
        )}
        {visited.includes("Palettes") && (
          <div className="curator-panel" hidden={section !== "Palettes"}>
            <PaletteManager />
          </div>
        )}
        {visited.includes("Gallery") && (
          <div className="curator-panel" hidden={section !== "Gallery"}>
            <GalleryEditor />
          </div>
        )}
        {section === "Moderation" && (
          <div className="curator-panel">
            <CommentModeration />
          </div>
        )}
        {section === "Inbox" && (
          <div className="curator-panel">
            <ContactInbox />
          </div>
        )}
      </div></ClassificationCatalogBoundary>
    </EditingBoundary>
  );
}
