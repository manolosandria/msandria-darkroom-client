"use client";

import { useEffect, useState } from "react";
import GalleryEditor from "./GalleryEditor";
import HomeBannerEditor from "./HomeBannerEditor";
import UploadPanel from "./UploadPanel";
import ManagePhotos from "./ManagePhotos";
import ManageCollections from "./ManageCollections";
import CommentModeration from "./CommentModeration";
import ContactInbox from "./ContactInbox";
import { useCuratorNotifications } from "./CuratorNotifications";
import { EditingBoundary } from "./EditingWorkspace";

const sections = [
  "Home",
  "Gallery",
  "Upload",
  "Photos",
  "Collections",
  "Variants",
  "Moderation",
  "Inbox",
] as const;
type Section = (typeof sections)[number];

export default function Curator() {
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
      <div className="curator-workspace">
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
        <div hidden={section !== "Upload"}>
          <UploadPanel />
        </div>
        {visited.includes("Photos") && (
          <div hidden={section !== "Photos"}>
            <ManagePhotos />
          </div>
        )}
        {visited.includes("Collections") && (
          <div hidden={section !== "Collections"}>
            <ManageCollections />
          </div>
        )}
        {visited.includes("Variants") && (
          <div hidden={section !== "Variants"}>
            <ManageCollections variants />
          </div>
        )}
        {visited.includes("Home") && (
          <div hidden={section !== "Home"}>
            <HomeBannerEditor />
          </div>
        )}
        {visited.includes("Gallery") && (
          <div hidden={section !== "Gallery"}>
            <GalleryEditor />
          </div>
        )}
        {section === "Moderation" && <CommentModeration />}
        {section === "Inbox" && <ContactInbox />}
      </div>
    </EditingBoundary>
  );
}
